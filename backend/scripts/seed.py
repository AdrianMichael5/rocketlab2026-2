"""Carga inicial dos CSVs de backend/data/ no banco.

Uso (a partir de backend/, com o schema já migrado via `alembic upgrade head`):

    python -m scripts.seed

O seed é idempotente: limpa todas as tabelas (em ordem reversa de dependência) e
recarrega tudo em uma única transação. Se qualquer etapa falhar, nada é alterado.
dim_reviews.csv é ignorado: dim_reviews é recalculada a partir de movie_reviews.
"""

import asyncio
import csv
import logging
import sys
import time
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from itertools import islice
from pathlib import Path
from typing import Any

from sqlalchemy import Table, delete, func, insert, inspect, select
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import enable_sqlite_foreign_keys
from app.movies.models import (
    DimCompany,
    DimGenre,
    DimMovie,
    DimPerson,
    DimReview,
    FactMoviePerformance,
    MovieReview,
    bridge_movie_company,
    bridge_movie_genre,
    bridge_movie_person,
)
from app.reviews.schemas import CASAS_MEDIA

logger = logging.getLogger("scripts.seed")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CHUNK_SIZE = 5000
PROGRESS_EVERY_ROWS = 100_000
# Sinopses chegam a ~1000 caracteres; folga generosa sobre o limite padrão do csv.
CSV_FIELD_SIZE_LIMIT = 1024 * 1024

CsvRow = dict[str, str]
DbRow = dict[str, Any]


class SeedError(Exception):
    """Falha esperada do seed (arquivo ausente, cabeçalho divergente, schema ausente)."""


# --- Conversões de valores ------------------------------------------------------------


def null_if_empty(value: str) -> str | None:
    return value if value != "" else None


def to_int(value: str) -> int | None:
    """Converte inteiros, inclusive os que vêm como float no CSV ("2375.0")."""

    return int(float(value)) if value != "" else None


def to_float(value: str) -> float | None:
    return float(value) if value != "" else None


def to_decimal(value: str) -> Decimal | None:
    return Decimal(value) if value != "" else None


def to_date(value: str) -> date | None:
    return date.fromisoformat(value) if value != "" else None


def clean_sinopse(value: str) -> str | None:
    """Remove aspas extras no início/fim e desfaz aspas duplicadas no meio do texto.

    As pontas são removidas antes de desfazer as duplicadas: se fosse o contrário, uma
    frase citada no fim (`...""X""`) perderia a própria aspa de fechamento.
    """

    text = value.removeprefix('"').removesuffix('"').replace('""', '"').strip()
    return text or None


# --- Conversões de linhas -------------------------------------------------------------


def convert_text_row(row: CsvRow) -> DbRow:
    return {column: null_if_empty(value) for column, value in row.items()}


def convert_movie(row: CsvRow) -> DbRow:
    return {
        "sk_movie_id": row["sk_movie_id"],
        "id_filme": row["id_filme"],
        "titulo": row["titulo"],
        "data_lancamento": to_date(row["data_lancamento"]),
        "ano_lancamento": to_int(row["ano_lancamento"]),
        # 0 significa duração desconhecida; mantido como no CSV (tratado na API).
        "duracao_minutos": to_int(row["duracao_minutos"]),
        "status_filme": null_if_empty(row["status_filme"]),
        "sinopse": clean_sinopse(row["sinopse"]),
        "url_poster": null_if_empty(row["url_poster"]),
        "url_backdrop": null_if_empty(row["url_backdrop"]),
    }


MONEY_COLUMNS: tuple[str, ...] = (
    "orcamento_usd",
    "receita_usd",
    "lucro_usd",
    "orcamento_brl",
    "receita_brl",
    "lucro_brl",
)


def convert_performance(row: CsvRow) -> DbRow:
    return {
        "sk_movie_id": row["sk_movie_id"],
        **{column: to_decimal(row[column]) for column in MONEY_COLUMNS},
        "popularidade": to_float(row["popularidade"]),
        "nota_tmdb": to_float(row["nota_tmdb"]),
        "qtd_tmdb": to_int(row["qtd_tmdb"]),
        "nota_imdb": to_float(row["nota_imdb"]),
        "qtd_imdb": to_int(row["qtd_imdb"]),
    }


def convert_review(row: CsvRow) -> DbRow:
    return {
        "sk_movie_review_id": row["sk_movie_review_id"],
        "sk_movie_id": row["sk_movie_id"],
        "nome": row["nome"],
        "nota": float(row["nota"]),
        "comentario": row["comentario"],
    }


@dataclass(frozen=True)
class CsvSource:
    filename: str
    table: Table
    convert: Callable[[CsvRow], DbRow]


# Ordem de carga respeita as chaves estrangeiras: dimensões → bridges → fato → avaliações.
SOURCES: tuple[CsvSource, ...] = (
    CsvSource("dim_genres.csv", DimGenre.__table__, convert_text_row),
    CsvSource("dim_companies.csv", DimCompany.__table__, convert_text_row),
    CsvSource("dim_people.csv", DimPerson.__table__, convert_text_row),
    CsvSource("dim_movies.csv", DimMovie.__table__, convert_movie),
    CsvSource("bridge_movie_genre.csv", bridge_movie_genre, convert_text_row),
    CsvSource("bridge_movie_company.csv", bridge_movie_company, convert_text_row),
    CsvSource("bridge_movie_person.csv", bridge_movie_person, convert_text_row),
    CsvSource("fact_movies_performance.csv", FactMoviePerformance.__table__, convert_performance),
    CsvSource("movies_reviews.csv", MovieReview.__table__, convert_review),
)

DIM_REVIEWS: Table = DimReview.__table__
MOVIE_REVIEWS: Table = MovieReview.__table__

# dim_reviews depende de dim_movies, então é limpa antes dela (logo após movie_reviews).
TABLES_IN_DELETE_ORDER: tuple[Table, ...] = (
    MOVIE_REVIEWS,
    DIM_REVIEWS,
    *(source.table for source in reversed(SOURCES[:-1])),
)


# --- Leitura dos CSVs -----------------------------------------------------------------


def expected_csv_columns(table: Table) -> set[str]:
    """Colunas que o CSV precisa trazer (as com default no servidor são opcionais)."""

    return {column.name for column in table.columns if column.server_default is None}


def validate_header(filename: str, fieldnames: Iterable[str] | None, table: Table) -> None:
    received = set(fieldnames or ())
    expected = expected_csv_columns(table)
    if received != expected:
        raise SeedError(
            f"{filename}: cabeçalho não corresponde à tabela {table.name}. "
            f"Faltando: {sorted(expected - received)}; inesperadas: {sorted(received - expected)}"
        )


def read_csv(path: Path, table: Table) -> Iterator[CsvRow]:
    if not path.is_file():
        raise SeedError(f"Arquivo não encontrado: {path.name} (esperado em {path.parent})")
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        validate_header(path.name, reader.fieldnames, table)
        yield from reader


def chunked(rows: Iterable[DbRow], size: int) -> Iterator[list[DbRow]]:
    iterator = iter(rows)
    while chunk := list(islice(iterator, size)):
        yield chunk


# --- Etapas do seed -------------------------------------------------------------------


async def ensure_schema(conn: AsyncConnection) -> None:
    existing = await conn.run_sync(lambda sync_conn: set(inspect(sync_conn).get_table_names()))
    missing = sorted({table.name for table in TABLES_IN_DELETE_ORDER} - existing)
    if missing:
        raise SeedError(
            f"Tabelas ausentes no banco: {missing}. Rode `alembic upgrade head` antes do seed."
        )


async def clear_tables(conn: AsyncConnection) -> None:
    for table in TABLES_IN_DELETE_ORDER:
        await conn.execute(delete(table))
    logger.info("Tabelas limpas (%d)", len(TABLES_IN_DELETE_ORDER))


async def load_source(conn: AsyncConnection, source: CsvSource, data_dir: Path) -> int:
    started = time.perf_counter()
    converted_rows = map(source.convert, read_csv(data_dir / source.filename, source.table))
    total = 0
    next_progress = PROGRESS_EVERY_ROWS
    for chunk in chunked(converted_rows, CHUNK_SIZE):
        await conn.execute(insert(source.table), chunk)
        total += len(chunk)
        if total >= next_progress:
            logger.info("  %s: %s linhas...", source.table.name, f"{total:,}")
            next_progress += PROGRESS_EVERY_ROWS
    elapsed = time.perf_counter() - started
    logger.info("%s: %s linhas em %.1fs", source.table.name, f"{total:,}", elapsed)
    return total


async def rebuild_review_summary(conn: AsyncConnection) -> int:
    """Recalcula dim_reviews (COUNT/AVG) a partir de movie_reviews.

    Só filmes com avaliação recebem linha; sk_review_id = sk_movie_id, como no CSV original.
    """

    summary = select(
        MOVIE_REVIEWS.c.sk_movie_id.label("sk_review_id"),
        MOVIE_REVIEWS.c.sk_movie_id,
        func.count(),
        # Mesmo arredondamento usado pela API ao recalcular após criar/remover avaliação.
        func.round(func.avg(MOVIE_REVIEWS.c.nota), CASAS_MEDIA),
    ).group_by(MOVIE_REVIEWS.c.sk_movie_id)
    await conn.execute(delete(DIM_REVIEWS))
    await conn.execute(
        insert(DIM_REVIEWS).from_select(
            ["sk_review_id", "sk_movie_id", "qtd_avaliacoes_usuarios", "nota_media_usuarios"],
            summary,
        )
    )
    total = (await conn.execute(select(func.count()).select_from(DIM_REVIEWS))).scalar_one()
    logger.info("dim_reviews: %s linhas recalculadas a partir de movie_reviews", f"{total:,}")
    return total


async def seed(engine: AsyncEngine, data_dir: Path = DATA_DIR) -> dict[str, int]:
    """Executa o seed completo em uma única transação e retorna as contagens por tabela."""

    csv.field_size_limit(CSV_FIELD_SIZE_LIMIT)
    counts: dict[str, int] = {}
    async with engine.begin() as conn:
        await ensure_schema(conn)
        await clear_tables(conn)
        for source in SOURCES:
            counts[source.table.name] = await load_source(conn, source, data_dir)
        counts[DIM_REVIEWS.name] = await rebuild_review_summary(conn)
    return counts


async def main() -> None:
    configure_logging()
    engine = create_async_engine(get_settings().database_url, echo=False)
    enable_sqlite_foreign_keys(engine)
    started = time.perf_counter()
    try:
        counts = await seed(engine)
    finally:
        await engine.dispose()
    logger.info(
        "Seed concluído: %s linhas em %.1fs",
        f"{sum(counts.values()):,}",
        time.perf_counter() - started,
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SeedError as exc:
        logger.error("Seed abortado: %s", exc)
        sys.exit(1)
