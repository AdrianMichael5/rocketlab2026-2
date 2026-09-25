import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db.base import Base
from app.db.session import enable_sqlite_foreign_keys, get_db
from app.main import app
from app.movies.models import DimMovie, DimReview

CONCURRENT_POSTS = 20


@pytest.fixture
async def file_engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    # Banco em arquivo: cada sessão usa a própria conexão, como em produção
    # (o banco em memória dos outros testes compartilha uma conexão só).
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'concorrencia.db'}")
    enable_sqlite_foreign_keys(engine)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def file_client(file_engine: AsyncEngine) -> AsyncIterator[httpx.AsyncClient]:
    factory = async_sessionmaker(bind=file_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        session.add(DimMovie(sk_movie_id="m1", id_filme="1", titulo="Filme"))
        await session.commit()

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def test_concurrent_reviews_are_all_saved_and_counted(
    file_client: httpx.AsyncClient, file_engine: AsyncEngine
) -> None:
    payload = {"nome": "Ana", "nota": 8, "comentario": "Bom."}

    responses = await asyncio.gather(
        *(
            file_client.post("/api/v1/movies/m1/reviews", json=payload)
            for _ in range(CONCURRENT_POSTS)
        )
    )

    assert [r.status_code for r in responses] == [201] * CONCURRENT_POSTS
    async with file_engine.connect() as conn:
        summary = (await conn.execute(select(DimReview.__table__))).mappings().one()
    assert summary["qtd_avaliacoes_usuarios"] == CONCURRENT_POSTS
    assert summary["nota_media_usuarios"] == 8
