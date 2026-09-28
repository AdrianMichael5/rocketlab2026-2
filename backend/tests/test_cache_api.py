"""Cache das leituras (/movies, /stats, /genres) e sua invalidação pelas escritas da API."""

import httpx
import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.movies.models import DimGenre, DimMovie

pytestmark = pytest.mark.usefixtures("catalog")

MOVIES_URL = "/api/v1/movies"
STATS_URL = "/api/v1/stats"
GENRES_URL = "/api/v1/genres"
REVIEW = {"nome": "Carla", "nota": 7, "comentario": "Bom."}

Sessions = async_sessionmaker[AsyncSession]


async def rename_movie_directly(session_factory: Sessions, sk_movie_id: str, titulo: str) -> None:
    """Muda o banco sem passar pela API: o cache não fica sabendo."""

    async with session_factory() as session:
        await session.execute(
            update(DimMovie).where(DimMovie.sk_movie_id == sk_movie_id).values(titulo=titulo)
        )
        await session.commit()


def titulos(response: httpx.Response) -> list[str]:
    return [item["titulo"] for item in response.json()["items"]]


async def resumo(client: httpx.AsyncClient) -> dict[str, object]:
    return (await client.get(STATS_URL)).json()["resumo"]


async def sem_nada(client: httpx.AsyncClient) -> dict[str, object]:
    return (await client.get(MOVIES_URL, params={"q": "Sem Nada"})).json()["items"][0]


# ---------------------------------------------------------------- leituras em cache


async def test_movies_list_is_served_from_cache(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.get(MOVIES_URL)
    await rename_movie_directly(session_factory, "m4", "Aliens")

    response = await client.get(MOVIES_URL)

    assert "Alien" in titulos(response)
    assert "Aliens" not in titulos(response)


async def test_default_and_explicit_params_share_the_cache_entry(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.get(MOVIES_URL)
    await rename_movie_directly(session_factory, "m4", "Aliens")

    response = await client.get(MOVIES_URL, params={"page": 1, "page_size": 20, "ordem": "titulo"})

    assert "Alien" in titulos(response)


async def test_different_params_use_different_cache_entries(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.get(MOVIES_URL, params={"q": "Alien"})
    await rename_movie_directly(session_factory, "m4", "Aliens")

    other_query = await client.get(MOVIES_URL, params={"q": "Alie"})

    assert titulos(other_query) == ["Aliens"]


async def test_genres_are_served_from_cache(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    before = (await client.get(GENRES_URL)).json()
    async with session_factory() as session:
        western = DimGenre(sk_genre_id="g-west", nome_genero="Western")
        session.add(DimMovie(sk_movie_id="m9", id_filme="9", titulo="Faroeste", genres=[western]))
        await session.commit()

    assert (await client.get(GENRES_URL)).json() == before


async def test_stats_are_served_from_cache(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    before = await resumo(client)
    async with session_factory() as session:
        session.add(DimMovie(sk_movie_id="m9", id_filme="9", titulo="Extra"))
        await session.commit()

    assert await resumo(client) == before


async def test_invalid_request_is_rejected_before_reaching_the_cache(
    client: httpx.AsyncClient,
) -> None:
    assert (await client.get(MOVIES_URL, params={"page_size": 0})).status_code == 422
    assert (await client.get(MOVIES_URL)).status_code == 200


# ---------------------------------------------------------------- invalidação


async def test_creating_movie_invalidates_movies_genres_and_stats(
    client: httpx.AsyncClient,
) -> None:
    await client.get(MOVIES_URL)
    await client.get(GENRES_URL)
    total_antes = (await resumo(client))["total_filmes"]

    response = await client.post(MOVIES_URL, json={"titulo": "Zebra", "generos": ["Western"]})
    assert response.status_code == 201

    assert "Zebra" in titulos(await client.get(MOVIES_URL))
    assert "Western" in (await client.get(GENRES_URL)).json()
    assert (await resumo(client))["total_filmes"] == total_antes + 1


async def test_updating_movie_invalidates_cache(client: httpx.AsyncClient) -> None:
    await client.get(MOVIES_URL)

    response = await client.patch(f"{MOVIES_URL}/m4", json={"titulo": "Aliens"})
    assert response.status_code == 200

    assert "Aliens" in titulos(await client.get(MOVIES_URL))


async def test_deleting_movie_invalidates_cache(client: httpx.AsyncClient) -> None:
    await client.get(MOVIES_URL)
    total_antes = (await resumo(client))["total_filmes"]

    assert (await client.delete(f"{MOVIES_URL}/m4")).status_code == 204

    assert "Alien" not in titulos(await client.get(MOVIES_URL))
    assert (await resumo(client))["total_filmes"] == total_antes - 1


async def test_creating_review_invalidates_movie_average_and_stats(
    client: httpx.AsyncClient,
) -> None:
    await sem_nada(client)
    avaliacoes_antes = (await resumo(client))["total_avaliacoes"]

    assert (await client.post(f"{MOVIES_URL}/m2/reviews", json=REVIEW)).status_code == 201

    assert (await sem_nada(client))["nota_media"] == 7
    assert (await resumo(client))["total_avaliacoes"] == avaliacoes_antes + 1


async def test_deleting_review_invalidates_movie_average(client: httpx.AsyncClient) -> None:
    created = (await client.post(f"{MOVIES_URL}/m2/reviews", json=REVIEW)).json()
    assert (await sem_nada(client))["nota_media"] == 7

    url = f"/api/v1/reviews/{created['sk_movie_review_id']}"
    assert (await client.delete(url)).status_code == 204

    assert (await sem_nada(client))["nota_media"] is None
