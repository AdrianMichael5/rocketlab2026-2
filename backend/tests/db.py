from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import enable_sqlite_foreign_keys
from app.movies import models  # noqa: F401  Registra os modelos ORM.
from app.movies.search import CREATE_SEARCH_TABLE


def build_memory_engine() -> AsyncEngine:
    """Engine SQLite em memória compartilhada entre conexões, com FKs ativas."""

    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    enable_sqlite_foreign_keys(engine)
    return engine


async def create_schema(engine: AsyncEngine) -> None:
    """Cria as tabelas do metadata e o índice FTS, que só existe nas migrações."""

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(CREATE_SEARCH_TABLE)
