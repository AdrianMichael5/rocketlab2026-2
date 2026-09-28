from collections.abc import Iterator
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

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


@pytest.fixture
def migrated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """Banco SQLite em arquivo com `alembic upgrade head` aplicado."""

    db_path = tmp_path / "migrated.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    get_settings.cache_clear()
    # Sem alembic.ini: evita que fileConfig reconfigure o logging dos outros testes.
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    try:
        command.upgrade(config, "head")
        yield db_path
    finally:
        get_settings.cache_clear()


def test_migrations_match_orm_models(migrated_db: Path) -> None:
    engine = create_engine(f"sqlite:///{migrated_db.as_posix()}")
    try:
        with engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
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
