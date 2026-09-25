from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.movies.models import DimReview, MovieReview
from app.reviews import repository

pytestmark = pytest.mark.usefixtures("catalog")

MOVIES_URL = "/api/v1/movies"
REVIEWS_URL = "/api/v1/reviews"

Sessions = async_sessionmaker[AsyncSession]


def reviews_url(sk_movie_id: str) -> str:
    return f"{MOVIES_URL}/{sk_movie_id}/reviews"


def review_payload(**overrides: object) -> dict[str, object]:
    return {"nome": "Carla", "nota": 7.5, "comentario": "Gostei bastante.", **overrides}


async def post_review(
    client: httpx.AsyncClient, sk_movie_id: str, **overrides: object
) -> httpx.Response:
    return await client.post(reviews_url(sk_movie_id), json=review_payload(**overrides))


async def summary(client: httpx.AsyncClient, sk_movie_id: str) -> dict[str, object]:
    return (await client.get(f"{MOVIES_URL}/{sk_movie_id}")).json()["avaliacoes"]


async def stored_summary(session_factory: Sessions, sk_movie_id: str) -> DimReview | None:
    async with session_factory() as session:
        stmt = select(DimReview).where(DimReview.sk_movie_id == sk_movie_id)
        return (await session.scalars(stmt)).one_or_none()


# ---------------------------------------------------------------- listagem


async def test_list_reviews_returns_page_envelope(client: httpx.AsyncClient) -> None:
    response = await client.get(reviews_url("m1"))

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert {item["nome"] for item in body["items"]} == {"Ana", "Beto"}
    item = next(item for item in body["items"] if item["nome"] == "Ana")
    assert item["sk_movie_id"] == "m1"
    assert item["nota"] == 10
    assert item["comentario"] == "Obra-prima."
    assert item["sk_movie_review_id"]
    assert item["created_at"]


async def test_list_reviews_orders_newest_first(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    # Inseridas fora da ordem cronológica para não depender da ordem de inserção.
    async with session_factory() as session:
        session.add_all(
            [
                MovieReview(
                    sk_movie_id="m2",
                    nome="Meio",
                    nota=5,
                    comentario="c",
                    created_at=datetime(2024, 6, 1),
                ),
                MovieReview(
                    sk_movie_id="m2",
                    nome="Nova",
                    nota=5,
                    comentario="c",
                    created_at=datetime(2025, 1, 1),
                ),
                MovieReview(
                    sk_movie_id="m2",
                    nome="Antiga",
                    nota=5,
                    comentario="c",
                    created_at=datetime(2020, 1, 1),
                ),
            ]
        )
        await session.commit()

    body = (await client.get(reviews_url("m2"))).json()

    assert [item["nome"] for item in body["items"]] == ["Nova", "Meio", "Antiga"]


async def test_list_reviews_breaks_timestamp_ties_by_insertion_order(
    client: httpx.AsyncClient,
) -> None:
    # Três POSTs no mesmo segundo: CURRENT_TIMESTAMP empata e decide a ordem de inserção.
    for nome in ("Primeira", "Segunda", "Terceira"):
        assert (await post_review(client, "m2", nome=nome)).status_code == 201

    body = (await client.get(reviews_url("m2"))).json()

    assert [item["nome"] for item in body["items"]] == ["Terceira", "Segunda", "Primeira"]


async def test_list_reviews_paginates(client: httpx.AsyncClient) -> None:
    for nome in ("A", "B", "C"):
        await post_review(client, "m2", nome=nome)

    body = (await client.get(reviews_url("m2"), params={"page": 2, "page_size": 2})).json()

    assert body["total"] == 3
    assert body["page"] == 2
    assert body["page_size"] == 2
    assert [item["nome"] for item in body["items"]] == ["A"]


async def test_list_reviews_of_movie_without_reviews_is_empty(client: httpx.AsyncClient) -> None:
    response = await client.get(reviews_url("m2"))

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 20}


async def test_list_reviews_of_unknown_movie_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get(reviews_url("nao-existe"))

    assert response.status_code == 404
    assert response.json()["detail"] == "Filme não encontrado"


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 0}, {"page_size": 101}])
async def test_list_reviews_rejects_invalid_pagination(
    client: httpx.AsyncClient, params: dict[str, int]
) -> None:
    response = await client.get(reviews_url("m1"), params=params)

    assert response.status_code == 422


# ---------------------------------------------------------------- criação


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    assert parsed.utcoffset() == timedelta(0), f"created_at sem fuso UTC: {value}"
    return parsed


async def test_created_at_is_serialized_as_utc(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    # CURRENT_TIMESTAMP é UTC; sem o fuso o frontend leria como horário local.
    async with session_factory() as session:
        session.add(
            MovieReview(
                sk_movie_id="m2",
                nome="Fixa",
                nota=5,
                comentario="c",
                created_at=datetime(2025, 1, 1, 12, 30),
            )
        )
        await session.commit()
    before = datetime.now(UTC).replace(microsecond=0)

    created = (await post_review(client, "m2")).json()
    listed = (await client.get(reviews_url("m2"))).json()["items"]

    assert before - timedelta(seconds=1) <= parse_utc(created["created_at"])
    assert parse_utc(created["created_at"]) <= datetime.now(UTC)
    assert parse_utc(listed[1]["created_at"]) == datetime(2025, 1, 1, 12, 30, tzinfo=UTC)


async def test_create_review_does_not_reload_row_after_commit(
    client: httpx.AsyncClient, db_engine: AsyncEngine
) -> None:
    # created_at deve voltar no próprio INSERT (RETURNING); um SELECT após o commit
    # falharia (500) se a avaliação fosse removida nesse intervalo.
    statements: list[str] = []

    def capture(conn, cursor, statement, parameters, context, executemany) -> None:
        statements.append(statement.lstrip().upper())

    event.listen(db_engine.sync_engine, "before_cursor_execute", capture)
    try:
        response = await post_review(client, "m2")
    finally:
        event.remove(db_engine.sync_engine, "before_cursor_execute", capture)

    assert response.status_code == 201
    assert response.json()["created_at"]
    reloads = [s for s in statements if s.startswith("SELECT") and "FROM MOVIE_REVIEWS" in s]
    assert reloads == []


async def test_create_review_returns_201_with_review(client: httpx.AsyncClient) -> None:
    response = await post_review(client, "m1", nome="  Carla  ", comentario="  Bom.  ")

    assert response.status_code == 201
    body = response.json()
    assert body["sk_movie_id"] == "m1"
    assert body["nome"] == "Carla"
    assert body["nota"] == 7.5
    assert body["comentario"] == "Bom."
    assert body["sk_movie_review_id"]
    assert body["created_at"]

    listed = (await client.get(reviews_url("m1"))).json()
    assert listed["total"] == 3
    assert listed["items"][0] == body


async def test_create_review_recalculates_existing_summary(client: httpx.AsyncClient) -> None:
    # m1 já tem 10 e 8 → (10 + 8 + 7.5) / 3 = 8.5
    await post_review(client, "m1", nota=7.5)

    assert await summary(client, "m1") == {"nota_media": 8.5, "qtd_avaliacoes": 3}


async def test_create_first_review_creates_summary_row(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    assert await stored_summary(session_factory, "m2") is None

    await post_review(client, "m2", nota=4)

    stored = await stored_summary(session_factory, "m2")
    assert stored is not None
    assert stored.qtd_avaliacoes_usuarios == 1
    assert stored.nota_media_usuarios == 4
    assert await summary(client, "m2") == {"nota_media": 4.0, "qtd_avaliacoes": 1}


async def test_create_review_rounds_average_to_two_decimals(client: httpx.AsyncClient) -> None:
    for nota in (1, 1, 0.5):
        await post_review(client, "m2", nota=nota)

    # 2.5 / 3 = 0.8333…
    assert await summary(client, "m2") == {"nota_media": 0.83, "qtd_avaliacoes": 3}


async def test_create_review_does_not_touch_other_movies_summary(
    client: httpx.AsyncClient,
) -> None:
    await post_review(client, "m1", nota=0)

    assert await summary(client, "m4") == {"nota_media": 9.0, "qtd_avaliacoes": 5}


async def test_create_review_for_unknown_movie_returns_404(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    response = await post_review(client, "nao-existe")

    assert response.status_code == 404
    async with session_factory() as session:
        total = await session.scalar(select(func.count()).select_from(MovieReview))
    assert total == 2


async def test_create_review_when_movie_vanishes_before_write_returns_404(
    client: httpx.AsyncClient, session_factory: Sessions, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Simula o filme removido entre a checagem de existência e a gravação (FK violada).
    async def always_exists(session: AsyncSession, sk_movie_id: str) -> bool:
        return True

    monkeypatch.setattr(repository, "movie_exists", always_exists)

    response = await post_review(client, "nao-existe")

    assert response.status_code == 404
    async with session_factory() as session:
        reviews = await session.scalar(select(func.count()).select_from(MovieReview))
        summaries = await session.scalar(select(func.count()).select_from(DimReview))
    assert reviews == 2
    assert summaries == 3


@pytest.mark.parametrize("nota", [0, 0.5, 10, 9.5])
async def test_create_review_accepts_boundary_and_half_notes(
    client: httpx.AsyncClient, nota: float
) -> None:
    response = await post_review(client, "m2", nota=nota)

    assert response.status_code == 201
    assert response.json()["nota"] == nota


# true e "7.5" eram convertidos silenciosamente para 1.0 e 7.5 (modo lax do Pydantic).
@pytest.mark.parametrize("nota", [-0.5, 10.5, 7.3, 0.25, "abc", None, True, False, "7.5"])
async def test_create_review_rejects_invalid_nota(client: httpx.AsyncClient, nota: object) -> None:
    response = await post_review(client, "m2", nota=nota)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("nome", ""),
        ("nome", "   "),
        ("nome", "x" * 121),
        ("comentario", ""),
        ("comentario", "   "),
        ("comentario", "x" * 4001),
    ],
    ids=["nome-vazio", "nome-espacos", "nome-121", "coment-vazio", "coment-espacos", "coment-4001"],
)
async def test_create_review_rejects_invalid_text(
    client: httpx.AsyncClient, campo: str, valor: str
) -> None:
    response = await post_review(client, "m2", **{campo: valor})

    assert response.status_code == 422


async def test_create_review_accepts_text_at_max_length(client: httpx.AsyncClient) -> None:
    response = await post_review(client, "m2", nome="n" * 120, comentario="c" * 4000)

    assert response.status_code == 201


@pytest.mark.parametrize("campo", ["nome", "nota", "comentario"])
async def test_create_review_requires_all_fields(client: httpx.AsyncClient, campo: str) -> None:
    payload = review_payload()
    del payload[campo]

    response = await client.post(reviews_url("m2"), json=payload)

    assert response.status_code == 422


async def test_create_review_rejects_extra_fields(client: httpx.AsyncClient) -> None:
    response = await client.post(reviews_url("m2"), json=review_payload(sk_movie_id="m1"))

    assert response.status_code == 422


# ---------------------------------------------------------------- remoção


async def test_delete_review_returns_204_and_recalculates_summary(
    client: httpx.AsyncClient,
) -> None:
    items = (await client.get(reviews_url("m1"))).json()["items"]
    ana = next(item for item in items if item["nome"] == "Ana")

    response = await client.delete(f"{REVIEWS_URL}/{ana['sk_movie_review_id']}")

    assert response.status_code == 204
    assert response.content == b""
    remaining = (await client.get(reviews_url("m1"))).json()
    assert [item["nome"] for item in remaining["items"]] == ["Beto"]
    assert await summary(client, "m1") == {"nota_media": 8.0, "qtd_avaliacoes": 1}


async def test_delete_last_review_resets_summary(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    created = (await post_review(client, "m2", nota=6)).json()

    response = await client.delete(f"{REVIEWS_URL}/{created['sk_movie_review_id']}")

    assert response.status_code == 204
    stored = await stored_summary(session_factory, "m2")
    assert stored is not None
    assert stored.qtd_avaliacoes_usuarios == 0
    assert stored.nota_media_usuarios is None
    assert await summary(client, "m2") == {"nota_media": None, "qtd_avaliacoes": 0}


async def test_delete_unknown_review_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.delete(f"{REVIEWS_URL}/nao-existe")

    assert response.status_code == 404
    assert response.json()["detail"] == "Avaliação não encontrada"


async def test_delete_review_twice_returns_404(client: httpx.AsyncClient) -> None:
    created = (await post_review(client, "m2")).json()
    url = f"{REVIEWS_URL}/{created['sk_movie_review_id']}"

    assert (await client.delete(url)).status_code == 204
    assert (await client.delete(url)).status_code == 404


async def test_delete_review_rejects_oversized_id(client: httpx.AsyncClient) -> None:
    response = await client.delete(f"{REVIEWS_URL}/{'x' * 65}")

    assert response.status_code == 422


async def test_delete_review_of_other_movie_keeps_its_summary(client: httpx.AsyncClient) -> None:
    created = (await post_review(client, "m2", nota=2)).json()

    await client.delete(f"{REVIEWS_URL}/{created['sk_movie_review_id']}")

    assert await summary(client, "m1") == {"nota_media": 9.0, "qtd_avaliacoes": 2}


# ---------------------------------------------------------------- rotas


async def test_movie_detail_route_still_works_alongside_reviews_route(
    client: httpx.AsyncClient,
) -> None:
    assert (await client.get(f"{MOVIES_URL}/m1")).json()["sk_movie_id"] == "m1"
    assert (await client.get(reviews_url("m1"))).status_code == 200
