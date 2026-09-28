import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings
from app.db.base import Base
from app.movies import models  # noqa: F401  Registra os modelos ORM.
from app.movies.search import SEARCH_TABLE, include_in_autogenerate

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


BEFORE_SEARCH_INDEX = "0003_stats_covering_indexes"


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "migrated.db"


@pytest.fixture
def alembic_config(db_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Config]:
    """Config do Alembic apontando para um banco SQLite em arquivo vazio."""

    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    get_settings.cache_clear()
    # Sem alembic.ini: evita que fileConfig reconfigure o logging dos outros testes.
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    try:
        yield config
    finally:
        get_settings.cache_clear()


@pytest.fixture
def migrated_db(alembic_config: Config, db_path: Path) -> Path:
    """Banco SQLite em arquivo com `alembic upgrade head` aplicado."""

    command.upgrade(alembic_config, "head")
    return db_path


def table_names(db_path: Path) -> set[str]:
    with closing(sqlite3.connect(db_path)) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        return {row[0] for row in rows}


def search(db_path: Path, match: str) -> list[str]:
    with closing(sqlite3.connect(db_path)) as conn:
        rows = conn.execute(
            f"SELECT sk_movie_id FROM {SEARCH_TABLE} WHERE {SEARCH_TABLE} MATCH ? "
            "ORDER BY sk_movie_id",
            (match,),
        )
        return [row[0] for row in rows]


def test_migrations_match_orm_models(migrated_db: Path) -> None:
    engine = create_engine(f"sqlite:///{migrated_db.as_posix()}")
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(
                conn, opts={"include_name": include_in_autogenerate}
            )
            diff = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()

    assert diff == []


def test_migrations_create_covering_indexes_for_stats(migrated_db: Path) -> None:
    engine = create_engine(f"sqlite:///{migrated_db.as_posix()}")
    try:
        inspector = inspect(engine)
        reviews = {ix["name"]: ix["column_names"] for ix in inspector.get_indexes("movie_reviews")}
        fact = {
            ix["name"]: ix["column_names"]
            for ix in inspector.get_indexes("fact_movies_performance")
        }
    finally:
        engine.dispose()

    assert reviews == {"ix_movie_reviews_sk_movie_id_nota": ["sk_movie_id", "nota"]}
    assert fact == {"ix_fact_movies_performance_notas": ["sk_movie_id", "nota_imdb", "nota_tmdb"]}


def test_upgrade_populates_search_index_from_existing_movies(
    alembic_config: Config, db_path: Path
) -> None:
    command.upgrade(alembic_config, BEFORE_SEARCH_INDEX)
    with closing(sqlite3.connect(db_path)) as conn:
        conn.executescript(
            """
            INSERT INTO dim_movies (sk_movie_id, id_filme, titulo) VALUES
                ('m1', '1', 'O Poderoso Chefão'), ('m2', '2', 'Sem Créditos');
            INSERT INTO dim_people (sk_person_id, nome_pessoa, tipo_pessoa) VALUES
                ('d1', 'Francis Coppola', 'Diretor'),
                ('a1', 'Marlon Brando', 'Ator'),
                ('r1', 'Mario Puzo', 'Roteirista');
            INSERT INTO bridge_movie_person (sk_movie_id, sk_person_id) VALUES
                ('m1', 'd1'), ('m1', 'a1'), ('m1', 'r1');
            """
        )

    command.upgrade(alembic_config, "head")

    assert search(db_path, '"chefao"*') == ["m1"]
    assert search(db_path, '"COPP"*') == ["m1"]
    assert search(db_path, '"brando"*') == ["m1"]
    assert search(db_path, '"puzo"*') == []
    assert search(db_path, '"creditos"*') == ["m2"]


def test_downgrade_drops_search_index(alembic_config: Config, db_path: Path) -> None:
    command.upgrade(alembic_config, "head")
    assert SEARCH_TABLE in table_names(db_path)

    command.downgrade(alembic_config, BEFORE_SEARCH_INDEX)

    assert not {name for name in table_names(db_path) if name.startswith(SEARCH_TABLE)}
