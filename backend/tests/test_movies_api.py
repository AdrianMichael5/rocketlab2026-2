from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

pytestmark = pytest.mark.usefixtures("catalog")

MOVIES_URL = "/api/v1/movies"


async def list_titles(client: httpx.AsyncClient, **params: object) -> list[str]:
    response = await client.get(MOVIES_URL, params=params)
    assert response.status_code == 200
    return [item["titulo"] for item in response.json()["items"]]


@pytest.fixture
def executed_sql(db_engine: AsyncEngine) -> Iterator[list[tuple[str, object]]]:
    executed: list[tuple[str, object]] = []

    def record(conn, cursor, statement, parameters, context, executemany) -> None:
        del conn, cursor, context, executemany
        executed.append((statement, parameters))

    event.listen(db_engine.sync_engine, "before_cursor_execute", record)
    yield executed
    event.remove(db_engine.sync_engine, "before_cursor_execute", record)


# ---------------------------------------------------------------- listagem


async def test_list_returns_page_envelope_with_defaults(client: httpx.AsyncClient) -> None:
    response = await client.get(MOVIES_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert len(body["items"]) == 5


async def test_list_item_has_expected_fields(client: httpx.AsyncClient) -> None:
    body = (await client.get(MOVIES_URL, params={"q": "poderoso"})).json()

    assert body["items"] == [
        {
            "sk_movie_id": "m1",
            "titulo": "O Poderoso Chefão",
            "ano_lancamento": 1972,
            "url_poster": "/chefao.jpg",
            "generos": ["Crime", "Drama"],
            "nota_media": 9.0,
            "qtd_avaliacoes": 2,
        }
    ]


async def test_list_movie_without_reviews_has_null_average_and_zero_count(
    client: httpx.AsyncClient,
) -> None:
    item = (await client.get(MOVIES_URL, params={"q": "sem nada"})).json()["items"][0]

    assert item["generos"] == []
    assert item["nota_media"] is None
    assert item["qtd_avaliacoes"] == 0


async def test_list_paginates_and_keeps_total(client: httpx.AsyncClient) -> None:
    body = (await client.get(MOVIES_URL, params={"page": 2, "page_size": 2})).json()

    assert body["total"] == 5
    assert body["page"] == 2
    assert body["page_size"] == 2
    assert [item["titulo"] for item in body["items"]] == [
        "Chefão 100% Real_Test",
        "O Poderoso Chefão",
    ]


async def test_list_page_beyond_end_returns_empty_items(client: httpx.AsyncClient) -> None:
    body = (await client.get(MOVIES_URL, params={"page": 10})).json()

    assert body["items"] == []
    assert body["total"] == 5


@pytest.mark.parametrize(
    "params",
    [
        {"page_size": 101},
        {"page_size": 0},
        {"page": 0},
        {"ordem": "popularidade"},
        {"ano": "abc"},
        # Regressão: valores enormes estouravam o INTEGER do SQLite e geravam 500.
        {"page": 10**17, "page_size": 100},
        {"page": 10_001},
        {"ano": 10**20},
        {"ano": 1799},
        {"ano": 2201},
    ],
)
async def test_list_rejects_invalid_query_params(
    client: httpx.AsyncClient, params: dict[str, object]
) -> None:
    response = await client.get(MOVIES_URL, params=params)

    assert response.status_code == 422


async def test_list_accepts_max_page_size(client: httpx.AsyncClient) -> None:
    response = await client.get(MOVIES_URL, params={"page_size": 100})

    assert response.status_code == 200
    assert response.json()["page_size"] == 100


async def test_list_accepts_max_page(client: httpx.AsyncClient) -> None:
    response = await client.get(MOVIES_URL, params={"page": 10_000, "page_size": 100})

    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_list_page_beyond_total_skips_page_query(
    client: httpx.AsyncClient, executed_sql: list[tuple[str, object]]
) -> None:
    response = await client.get(MOVIES_URL, params={"page": 3, "page_size": 5})

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 5, "page": 3, "page_size": 5}
    assert len(executed_sql) == 1


async def test_search_is_case_insensitive(
    client: httpx.AsyncClient,
) -> None:
    titles = await list_titles(client, q="CHEFÃO")

    assert titles == ["Chefão 100% Real_Test", "O Poderoso Chefão"]


@pytest.mark.parametrize("wildcard", ["%", "_"])
async def test_search_treats_like_wildcards_literally(
    client: httpx.AsyncClient, wildcard: str
) -> None:
    assert await list_titles(client, q=wildcard) == ["Chefão 100% Real_Test"]


async def test_filter_by_genre_is_case_insensitive(client: httpx.AsyncClient) -> None:
    body = (await client.get(MOVIES_URL, params={"genero": "drama"})).json()

    assert body["total"] == 2
    assert [item["titulo"] for item in body["items"]] == [
        "Chefão 100% Real_Test",
        "O Poderoso Chefão",
    ]


async def test_filter_by_genre_keeps_all_genres_of_matching_movie(
    client: httpx.AsyncClient,
) -> None:
    item = (await client.get(MOVIES_URL, params={"genero": "Crime"})).json()["items"][0]

    assert item["generos"] == ["Crime", "Drama"]


async def test_filter_by_year(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, ano=1979) == ["Alien"]


async def test_filters_combine(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, genero="Drama", ano=1999, q="chef") == [
        "Chefão 100% Real_Test"
    ]


async def test_order_by_title_is_default_and_case_insensitive(
    client: httpx.AsyncClient,
) -> None:
    # Regressão: a collation binária jogava títulos minúsculos para o fim.
    assert await list_titles(client) == [
        "Alien",
        "bravo",
        "Chefão 100% Real_Test",
        "O Poderoso Chefão",
        "Sem Nada",
    ]


async def test_order_by_year_is_newest_first_with_nulls_last(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, ordem="ano") == [
        "bravo",
        "Chefão 100% Real_Test",
        "Alien",
        "O Poderoso Chefão",
        "Sem Nada",
    ]


async def test_order_by_rating_is_highest_first_ties_by_count_nulls_last(
    client: httpx.AsyncClient,
) -> None:
    assert await list_titles(client, ordem="nota") == [
        "Alien",
        "O Poderoso Chefão",
        "Chefão 100% Real_Test",
        "Sem Nada",
        "bravo",
    ]


async def test_default_order_uses_title_index_without_sorting(
    client: httpx.AsyncClient,
    db_engine: AsyncEngine,
    executed_sql: list[tuple[str, object]],
) -> None:
    # Regressão: ORDER BY lower(titulo) ignorava índices e ordenava 95k linhas por requisição.
    await client.get(MOVIES_URL)
    page_sql, params = executed_sql[1]

    async with db_engine.connect() as conn:
        plan = await conn.exec_driver_sql(f"EXPLAIN QUERY PLAN {page_sql}", params)
        details = " ".join(row[-1] for row in plan)

    assert "ix_dim_movies_titulo_nocase" in details
    assert "TEMP B-TREE" not in details


@pytest.mark.parametrize("page_size", [2, 5])
async def test_list_query_count_does_not_grow_with_page_size(
    client: httpx.AsyncClient, executed_sql: list[tuple[str, object]], page_size: int
) -> None:
    response = await client.get(MOVIES_URL, params={"page_size": page_size})

    assert response.status_code == 200
    assert len(executed_sql) == 3


# ----------------------------------------------------------------- detalhe


async def test_detail_returns_all_movie_fields(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{MOVIES_URL}/m1")

    assert response.status_code == 200
    body = response.json()
    assert body["sk_movie_id"] == "m1"
    assert body["id_filme"] == "238"
    assert body["titulo"] == "O Poderoso Chefão"
    assert body["data_lancamento"] is None
    assert body["ano_lancamento"] == 1972
    assert body["duracao_minutos"] == 175
    assert body["status_filme"] == "Lançado"
    assert body["sinopse"] == "Uma família mafiosa."
    assert body["url_poster"] == "/chefao.jpg"
    assert body["url_backdrop"] == "/chefao-bg.jpg"


async def test_detail_returns_related_names_sorted(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{MOVIES_URL}/m1")).json()

    assert body["generos"] == ["Crime", "Drama"]
    assert body["diretores"] == ["Co Diretor", "Francis Coppola"]
    assert body["roteiristas"] == ["Mario Puzo"]
    assert body["produtoras"] == ["American Zoetrope", "Paramount"]


async def test_detail_limits_actors_to_ten(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{MOVIES_URL}/m1")).json()

    assert body["atores"] == [f"Ator {i:02d}" for i in range(1, 11)]


async def test_detail_returns_credits_with_person_ids(client: httpx.AsyncClient) -> None:
    creditos = (await client.get(f"{MOVIES_URL}/m1")).json()["creditos"]

    assert creditos["diretores"] == [
        {"sk_person_id": "d2", "nome": "Co Diretor"},
        {"sk_person_id": "d1", "nome": "Francis Coppola"},
    ]
    assert creditos["roteiristas"] == [{"sk_person_id": "r1", "nome": "Mario Puzo"}]
    assert creditos["atores"] == [
        {"sk_person_id": f"a{i:02d}", "nome": f"Ator {i:02d}"} for i in range(1, 11)
    ]


async def test_detail_returns_performance_as_numbers(client: httpx.AsyncClient) -> None:
    performance = (await client.get(f"{MOVIES_URL}/m1")).json()["performance"]

    assert performance["orcamento_usd"] == 6000000.0
    assert performance["receita_usd"] == 245066411.0
    assert performance["lucro_usd"] == 239066411.0
    assert performance["orcamento_brl"] is None
    assert performance["nota_imdb"] == 9.2
    assert performance["qtd_imdb"] == 2000000


async def test_detail_returns_review_summary(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{MOVIES_URL}/m1")).json()

    assert body["avaliacoes"] == {"nota_media": 9.0, "qtd_avaliacoes": 2}


async def test_detail_of_bare_movie_has_empty_relations(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{MOVIES_URL}/m2")).json()

    assert body["generos"] == []
    assert body["diretores"] == []
    assert body["atores"] == []
    assert body["roteiristas"] == []
    assert body["produtoras"] == []
    assert body["creditos"] == {"diretores": [], "atores": [], "roteiristas": []}
    assert body["performance"] is None
    assert body["avaliacoes"] == {"nota_media": None, "qtd_avaliacoes": 0}


async def test_detail_unknown_movie_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{MOVIES_URL}/nao-existe")

    assert response.status_code == 404
    assert response.json() == {"detail": "Filme não encontrado"}


async def test_detail_rejects_id_longer_than_column(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{MOVIES_URL}/{'x' * 65}")

    assert response.status_code == 422
