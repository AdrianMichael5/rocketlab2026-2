import csv
from collections.abc import AsyncIterator
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.base import Base
from app.movies.models import DimMovie, DimReview, FactMoviePerformance
from scripts.seed import (
    SeedError,
    clean_sinopse,
    null_if_empty,
    seed,
    to_date,
    to_decimal,
    to_int,
)
from tests.db import build_memory_engine

CSV_FIXTURES: dict[str, list[list[str]]] = {
    "dim_genres.csv": [["nome_genero", "sk_genre_id"], ["Horror", "g1"], ["Drama", "g2"]],
    "dim_companies.csv": [["nome_produtora", "sk_company_id"], ["Universal Pictures", "c1"]],
    "dim_people.csv": [
        ["nome_pessoa", "tipo_pessoa", "sk_person_id"],
        ["Ana Diretora", "Diretor", "p1"],
        ["Bruno Ator", "Ator", "p2"],
    ],
    "dim_movies.csv": [
        [
            "sk_movie_id",
            "id_filme",
            "titulo",
            "data_lancamento",
            "ano_lancamento",
            "duracao_minutos",
            "status_filme",
            "sinopse",
            "url_poster",
            "url_backdrop",
        ],
        [
            "m1",
            "14564",
            "Rings",
            "2017-02-01",
            "2017",
            "0",
            "Lançado",
            '"Julia discovers a ""movie within the movie"" nobody saw."',
            "/poster.jpg",
            "",
        ],
        ["m2", "99", "Sem Avaliação", "2020-02-17", "2020", "94", "Planejado", "Texto.", "", ""],
    ],
    "bridge_movie_genre.csv": [["sk_movie_id", "sk_genre_id"], ["m1", "g1"], ["m2", "g2"]],
    "bridge_movie_company.csv": [["sk_movie_id", "sk_company_id"], ["m1", "c1"]],
    "bridge_movie_person.csv": [["sk_movie_id", "sk_person_id"], ["m1", "p1"], ["m2", "p2"]],
    "fact_movies_performance.csv": [
        [
            "sk_movie_id",
            "orcamento_usd",
            "receita_usd",
            "lucro_usd",
            "orcamento_brl",
            "receita_brl",
            "lucro_brl",
            "popularidade",
            "nota_tmdb",
            "qtd_tmdb",
            "nota_imdb",
            "qtd_imdb",
        ],
        ["m1", "", "83080890.0", "0.0", "", "261480485.1", "0.0", "24.584", "4.966", "2375.0",
         "4.5", "46286.0"],
        ["m2", "", "", "0.0", "", "", "0.0", "", "", "", "", ""],
    ],
    "movies_reviews.csv": [
        ["sk_movie_review_id", "sk_movie_id", "nome", "nota", "comentario"],
        ["r1", "m1", "Henrique", "8.0", "Muito bom."],
        ["r2", "m1", "Maria", "6.0", "Razoável."],
    ],
    # Presente nos dados reais, mas propositalmente ignorado pelo seed.
    "dim_reviews.csv": [
        ["sk_review_id", "sk_movie_id", "qtd_avaliacoes_usuarios", "nota_media_usuarios"],
        ["m1", "m1", "99", "0.9"],
    ],
}


def write_csv_fixtures(data_dir: Path, overrides: dict[str, list[list[str]]] | None = None) -> None:
    for filename, rows in {**CSV_FIXTURES, **(overrides or {})}.items():
        with (data_dir / filename).open("w", newline="", encoding="utf-8") as file:
            csv.writer(file).writerows(rows)


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    memory_engine = build_memory_engine()
    async with memory_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield memory_engine
    await memory_engine.dispose()


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    write_csv_fixtures(tmp_path)
    return tmp_path


async def count_rows(engine: AsyncEngine) -> dict[str, int]:
    async with engine.connect() as conn:
        return {
            name: (await conn.execute(select(func.count()).select_from(table))).scalar_one()
            for name, table in Base.metadata.tables.items()
        }


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('"Texto entre aspas."', "Texto entre aspas."),
        ('"Só no início.', "Só no início."),
        ('Só no fim."', "Só no fim."),
        ('Um ""filme"" dentro.', 'Um "filme" dentro.'),
        # Regressão: frase entre aspas no fim/início não pode perder a própria aspa.
        ('"Called ""X""', 'Called "X"'),
        ('"Continuing his ""legendary adventures""', 'Continuing his "legendary adventures"'),
        ('"""Marie is dangerous""', '"Marie is dangerous"'),
        ('"The letter ""M"""', 'The letter "M"'),
        ('"""Laughumentary"" about comedians."', '"Laughumentary" about comedians.'),
        ("Sem aspas.", "Sem aspas."),
        ("", None),
        ('""', None),
    ],
)
def test_clean_sinopse_removes_extra_quotes(raw: str, expected: str | None) -> None:
    assert clean_sinopse(raw) == expected


def test_scalar_converters_map_empty_strings_to_none() -> None:
    assert null_if_empty("") is None
    assert null_if_empty("x") == "x"
    assert to_int("2375.0") == 2375
    assert to_int("0") == 0
    assert to_int("") is None
    assert to_date("2017-02-01") == date(2017, 2, 1)
    assert to_date("") is None
    assert to_decimal("261480485.1") == Decimal("261480485.1")
    assert to_decimal("") is None


async def test_seed_loads_all_tables_and_rebuilds_dim_reviews(
    engine: AsyncEngine, data_dir: Path
) -> None:
    counts = await seed(engine, data_dir)

    assert counts == {
        "dim_genres": 2,
        "dim_companies": 1,
        "dim_people": 2,
        "dim_movies": 2,
        "bridge_movie_genre": 2,
        "bridge_movie_company": 1,
        "bridge_movie_person": 2,
        "fact_movies_performance": 2,
        "movie_reviews": 2,
        "dim_reviews": 1,
    }
    async with engine.connect() as conn:
        summary = (await conn.execute(select(DimReview.__table__))).mappings().one()
        movie = (
            await conn.execute(select(DimMovie.__table__).where(DimMovie.sk_movie_id == "m1"))
        ).mappings().one()
        fact = (
            await conn.execute(
                select(FactMoviePerformance.__table__).where(
                    FactMoviePerformance.sk_movie_id == "m1"
                )
            )
        ).mappings().one()

    assert summary["sk_review_id"] == "m1"
    assert summary["sk_movie_id"] == "m1"
    assert summary["qtd_avaliacoes_usuarios"] == 2
    assert summary["nota_media_usuarios"] == pytest.approx(7.0)
    assert movie["sinopse"] == 'Julia discovers a "movie within the movie" nobody saw.'
    assert movie["data_lancamento"] == date(2017, 2, 1)
    assert movie["duracao_minutos"] == 0
    assert movie["url_backdrop"] is None
    assert fact["qtd_tmdb"] == 2375
    assert fact["orcamento_usd"] is None
    assert fact["receita_brl"] == Decimal("261480485.10")


async def test_seed_rounds_dim_reviews_average_to_two_decimals(
    engine: AsyncEngine, tmp_path: Path
) -> None:
    # (9.8 + 2.4 + 4.4) / 3 = 5.5333…; mesmo arredondamento da API de avaliações.
    write_csv_fixtures(
        tmp_path,
        {
            "movies_reviews.csv": [
                ["sk_movie_review_id", "sk_movie_id", "nome", "nota", "comentario"],
                ["r1", "m1", "Henrique", "9.8", "Ótimo."],
                ["r2", "m1", "Lucas", "2.4", "Ruim."],
                ["r3", "m1", "Maria", "4.4", "Fraco."],
            ]
        },
    )

    await seed(engine, tmp_path)

    async with engine.connect() as conn:
        summary = (await conn.execute(select(DimReview.__table__))).mappings().one()
    assert summary["qtd_avaliacoes_usuarios"] == 3
    assert summary["nota_media_usuarios"] == 5.53


async def test_seed_logs_progress_per_table(
    engine: AsyncEngine, data_dir: Path, caplog: pytest.LogCaptureFixture, monkeypatch
) -> None:
    monkeypatch.setattr("scripts.seed.CHUNK_SIZE", 1)
    monkeypatch.setattr("scripts.seed.PROGRESS_EVERY_ROWS", 1)

    with caplog.at_level("INFO", logger="scripts.seed"):
        await seed(engine, data_dir)

    assert "  dim_people: 1 linhas..." in caplog.messages
    assert any(message.startswith("dim_people: 2 linhas em") for message in caplog.messages)
    assert "dim_reviews: 1 linhas recalculadas a partir de movie_reviews" in caplog.messages


async def test_seed_twice_is_idempotent(engine: AsyncEngine, data_dir: Path) -> None:
    await seed(engine, data_dir)
    first_counts = await count_rows(engine)

    await seed(engine, data_dir)

    assert await count_rows(engine) == first_counts


async def test_seed_rejects_unexpected_header_and_keeps_previous_data(
    engine: AsyncEngine, data_dir: Path
) -> None:
    await seed(engine, data_dir)
    previous_counts = await count_rows(engine)
    write_csv_fixtures(
        data_dir,
        {"movies_reviews.csv": [["sk_movie_review_id", "sk_movie_id", "autor", "nota"]]},
    )

    with pytest.raises(SeedError, match="movies_reviews.csv"):
        await seed(engine, data_dir)

    assert await count_rows(engine) == previous_counts


async def test_seed_fails_when_csv_is_missing(engine: AsyncEngine, data_dir: Path) -> None:
    (data_dir / "dim_people.csv").unlink()

    with pytest.raises(SeedError, match="dim_people.csv"):
        await seed(engine, data_dir)


async def test_seed_requires_migrated_schema(data_dir: Path) -> None:
    empty_engine = build_memory_engine()
    try:
        with pytest.raises(SeedError, match="alembic upgrade head"):
            await seed(empty_engine, data_dir)
    finally:
        await empty_engine.dispose()
