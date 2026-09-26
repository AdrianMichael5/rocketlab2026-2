import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.movies.models import DimGenre, DimMovie

GENRES_URL = "/api/v1/genres"


async def test_list_genres_is_empty_without_genres(client: httpx.AsyncClient) -> None:
    response = await client.get(GENRES_URL)

    assert response.status_code == 200
    assert response.json() == []


async def test_list_genres_returns_used_genre_names_sorted_case_insensitive(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    async with session_factory() as session:
        acao = DimGenre(sk_genre_id="g-acao", nome_genero="ação")
        drama = DimGenre(sk_genre_id="g-drama", nome_genero="Drama")
        comedia = DimGenre(sk_genre_id="g-comedia", nome_genero="Comédia")
        session.add_all(
            [
                DimMovie(sk_movie_id="m1", id_filme="1", titulo="Um", genres=[drama, acao]),
                DimMovie(sk_movie_id="m2", id_filme="2", titulo="Dois", genres=[drama, comedia]),
            ]
        )
        await session.commit()

    response = await client.get(GENRES_URL)

    assert response.status_code == 200
    # Sem duplicatas (Drama está em dois filmes) e sem diferenciar caixa na ordem.
    assert response.json() == ["ação", "Comédia", "Drama"]


async def test_list_genres_ignores_genres_without_movies(
    client: httpx.AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    async with session_factory() as session:
        usado = DimGenre(sk_genre_id="g-usado", nome_genero="Usado")
        session.add_all(
            [
                DimGenre(sk_genre_id="g-orfao", nome_genero="Órfão"),
                DimMovie(sk_movie_id="m1", id_filme="1", titulo="Um", genres=[usado]),
            ]
        )
        await session.commit()

    response = await client.get(GENRES_URL)

    assert response.json() == ["Usado"]
