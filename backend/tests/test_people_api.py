from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy import event, insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.movies.models import DimPerson, bridge_movie_person

PEOPLE_URL = "/api/v1/people"


@pytest.fixture
async def filmography(catalog: None, session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Francis Coppola (d1) passa a dirigir também m2 (sem ano), m3 (1999) e m5 (2010)."""

    del catalog
    async with session_factory() as session:
        await session.execute(
            insert(bridge_movie_person),
            [{"sk_movie_id": sk, "sk_person_id": "d1"} for sk in ("m2", "m3", "m5")],
        )
        session.add(DimPerson(sk_person_id="p-sem", nome_pessoa="Sem Filmes", tipo_pessoa="Ator"))
        await session.commit()


pytestmark = pytest.mark.usefixtures("filmography")


@pytest.fixture
def executed_sql(db_engine: AsyncEngine) -> Iterator[list[str]]:
    executed: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany) -> None:
        del conn, cursor, parameters, context, executemany
        executed.append(statement)

    event.listen(db_engine.sync_engine, "before_cursor_execute", record)
    yield executed
    event.remove(db_engine.sync_engine, "before_cursor_execute", record)


async def test_person_returns_name_type_and_paginated_movies(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{PEOPLE_URL}/d1")

    assert response.status_code == 200
    body = response.json()
    assert body["sk_person_id"] == "d1"
    assert body["nome"] == "Francis Coppola"
    assert body["tipo"] == "Diretor"
    assert body["filmes"]["total"] == 4
    assert body["filmes"]["page"] == 1
    assert body["filmes"]["page_size"] == 20


async def test_person_movies_are_newest_first_with_unknown_year_last(
    client: httpx.AsyncClient,
) -> None:
    items = (await client.get(f"{PEOPLE_URL}/d1")).json()["filmes"]["items"]

    assert [item["titulo"] for item in items] == [
        "bravo",
        "Chefão 100% Real_Test",
        "O Poderoso Chefão",
        "Sem Nada",
    ]


async def test_person_movies_have_poster_genres_and_rating(client: httpx.AsyncClient) -> None:
    items = (await client.get(f"{PEOPLE_URL}/d1")).json()["filmes"]["items"]
    chefao = next(item for item in items if item["sk_movie_id"] == "m1")

    assert chefao == {
        "sk_movie_id": "m1",
        "titulo": "O Poderoso Chefão",
        "ano_lancamento": 1972,
        "url_poster": "/chefao.jpg",
        "generos": ["Crime", "Drama"],
        "nota_media": 9.0,
        "qtd_avaliacoes": 2,
    }


async def test_person_movies_are_paginated(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{PEOPLE_URL}/d1", params={"page": 2, "page_size": 3})).json()

    assert body["filmes"]["total"] == 4
    assert body["filmes"]["page"] == 2
    assert body["filmes"]["page_size"] == 3
    assert [item["titulo"] for item in body["filmes"]["items"]] == ["Sem Nada"]


async def test_person_page_beyond_end_is_empty_with_total(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{PEOPLE_URL}/d1", params={"page": 5, "page_size": 3})).json()

    assert body["filmes"] == {"items": [], "total": 4, "page": 5, "page_size": 3}


async def test_person_without_movies_returns_empty_page(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{PEOPLE_URL}/p-sem")).json()

    assert body["nome"] == "Sem Filmes"
    assert body["tipo"] == "Ator"
    assert body["filmes"] == {"items": [], "total": 0, "page": 1, "page_size": 20}


async def test_unknown_person_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{PEOPLE_URL}/nao-existe")

    assert response.status_code == 404
    assert response.json() == {"detail": "Pessoa não encontrada"}


@pytest.mark.parametrize(
    "params",
    [{"page": 0}, {"page_size": 0}, {"page_size": 101}, {"page": "abc"}],
)
async def test_person_rejects_invalid_pagination(
    client: httpx.AsyncClient, params: dict[str, object]
) -> None:
    response = await client.get(f"{PEOPLE_URL}/d1", params=params)

    assert response.status_code == 422


async def test_person_rejects_id_longer_than_column(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{PEOPLE_URL}/{'x' * 65}")

    assert response.status_code == 422


@pytest.mark.parametrize("page_size", [1, 4])
async def test_person_query_count_does_not_grow_with_page_size(
    client: httpx.AsyncClient, executed_sql: list[str], page_size: int
) -> None:
    response = await client.get(f"{PEOPLE_URL}/d1", params={"page_size": page_size})

    assert response.status_code == 200
    # pessoa + total + página (com resumo) + gêneros
    assert len(executed_sql) == 4
