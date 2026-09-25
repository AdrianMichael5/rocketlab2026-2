from collections.abc import AsyncIterator
from decimal import Decimal

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.movies.models import (
    DimCompany,
    DimGenre,
    DimMovie,
    DimPerson,
    DimReview,
    FactMoviePerformance,
    MovieReview,
)
from tests.db import build_memory_engine


@pytest.fixture
async def db_engine() -> AsyncIterator[AsyncEngine]:
    memory_engine = build_memory_engine()
    async with memory_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield memory_engine
    await memory_engine.dispose()


@pytest.fixture
def session_factory(db_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=db_engine, expire_on_commit=False, autoflush=False)


@pytest.fixture
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[httpx.AsyncClient]:
    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.pop(get_db, None)


def build_catalog() -> list[DimMovie]:
    """Monta um catálogo pequeno cobrindo filmes completos, vazios e empates de nota."""

    drama = DimGenre(sk_genre_id="g-drama", nome_genero="Drama")
    crime = DimGenre(sk_genre_id="g-crime", nome_genero="Crime")
    horror = DimGenre(sk_genre_id="g-horror", nome_genero="Horror")
    paramount = DimCompany(sk_company_id="c1", nome_produtora="Paramount")
    zoetrope = DimCompany(sk_company_id="c2", nome_produtora="American Zoetrope")
    atores = [
        DimPerson(sk_person_id=f"a{i:02d}", nome_pessoa=f"Ator {i:02d}", tipo_pessoa="Ator")
        for i in range(12, 0, -1)
    ]
    diretores = [
        DimPerson(sk_person_id="d1", nome_pessoa="Francis Coppola", tipo_pessoa="Diretor"),
        DimPerson(sk_person_id="d2", nome_pessoa="Co Diretor", tipo_pessoa="Diretor"),
    ]
    roteirista = DimPerson(sk_person_id="r1", nome_pessoa="Mario Puzo", tipo_pessoa="Roteirista")

    poderoso = DimMovie(
        sk_movie_id="m1",
        id_filme="238",
        titulo="O Poderoso Chefão",
        ano_lancamento=1972,
        duracao_minutos=175,
        status_filme="Lançado",
        sinopse="Uma família mafiosa.",
        url_poster="/chefao.jpg",
        url_backdrop="/chefao-bg.jpg",
        genres=[drama, crime],
        companies=[paramount, zoetrope],
        people=[*atores, *diretores, roteirista],
        performance=FactMoviePerformance(
            orcamento_usd=Decimal("6000000.00"),
            receita_usd=Decimal("245066411.00"),
            lucro_usd=Decimal("239066411.00"),
            popularidade=41.1,
            nota_tmdb=8.7,
            qtd_tmdb=18000,
            nota_imdb=9.2,
            qtd_imdb=2000000,
        ),
        reviews_summary=DimReview(qtd_avaliacoes_usuarios=2, nota_media_usuarios=9.0),
        reviews=[
            MovieReview(nome="Ana", nota=10, comentario="Obra-prima."),
            MovieReview(nome="Beto", nota=8, comentario="Muito bom."),
        ],
    )
    sem_nada = DimMovie(sk_movie_id="m2", id_filme="2", titulo="Sem Nada")
    literal = DimMovie(
        sk_movie_id="m3",
        id_filme="3",
        titulo="Chefão 100% Real_Test",
        ano_lancamento=1999,
        genres=[drama],
        reviews_summary=DimReview(qtd_avaliacoes_usuarios=1, nota_media_usuarios=6.0),
    )
    alien = DimMovie(
        sk_movie_id="m4",
        id_filme="4",
        titulo="Alien",
        ano_lancamento=1979,
        url_poster="/alien.jpg",
        genres=[horror],
        reviews_summary=DimReview(qtd_avaliacoes_usuarios=5, nota_media_usuarios=9.0),
    )
    bravo = DimMovie(sk_movie_id="m5", id_filme="5", titulo="bravo", ano_lancamento=2010)
    return [poderoso, sem_nada, literal, alien, bravo]


@pytest.fixture
async def catalog(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        session.add_all(build_catalog())
        await session.commit()
