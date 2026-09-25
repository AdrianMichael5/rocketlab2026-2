from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.session import enable_sqlite_foreign_keys


def build_memory_engine() -> AsyncEngine:
    """Engine SQLite em memória compartilhada entre conexões, com FKs ativas."""

    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    enable_sqlite_foreign_keys(engine)
    return engine
