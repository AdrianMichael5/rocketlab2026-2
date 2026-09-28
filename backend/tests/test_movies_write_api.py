import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.movies import repository
from app.movies.models import (
    DimGenre,
    DimPerson,
    DimReview,
    FactMoviePerformance,
    MovieReview,
    bridge_movie_company,
    bridge_movie_genre,
    bridge_movie_person,
)

pytestmark = pytest.mark.usefixtures("catalog")

MOVIES_URL = "/api/v1/movies"
POSTER_URL = "https://image.tmdb.org/t/p/w500/poster.jpg"

Sessions = async_sessionmaker[AsyncSession]


async def count_rows(session_factory: Sessions, stmt) -> int:
    async with session_factory() as session:
        return (await session.execute(stmt)).scalar_one()


async def create(client: httpx.AsyncClient, **payload: object) -> httpx.Response:
    return await client.post(MOVIES_URL, json=payload)


# ---------------------------------------------------------------- criação


async def test_create_minimal_movie_returns_201_with_generated_id(
    client: httpx.AsyncClient,
) -> None:
    response = await create(client, titulo="  Novo Filme  ")

    assert response.status_code == 201
    body = response.json()
    assert body["titulo"] == "Novo Filme"
    assert body["id_filme"].startswith("local-")
    assert body["generos"] == []
    assert body["diretores"] == []
    assert body["atores"] == []
    assert body["performance"] is None
    assert body["avaliacoes"] == {"nota_media": None, "qtd_avaliacoes": 0}

    detail = await client.get(f"{MOVIES_URL}/{body['sk_movie_id']}")
    assert detail.status_code == 200
    assert detail.json() == body


async def test_create_generates_distinct_id_filme_each_time(client: httpx.AsyncClient) -> None:
    first = (await create(client, titulo="A")).json()["id_filme"]
    second = (await create(client, titulo="B")).json()["id_filme"]

    assert first != second


async def test_create_with_all_fields(client: httpx.AsyncClient) -> None:
    response = await create(
        client,
        titulo="Filme Completo",
        id_filme="abc-1",
        data_lancamento="2001-05-20",
        ano_lancamento=2001,
        sinopse="Uma sinopse.",
        duracao_minutos=0,
        status_filme="Lançado",
        url_poster=POSTER_URL,
        diretores=["Diretor Novo"],
        generos=["Ficção"],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id_filme"] == "abc-1"
    assert body["data_lancamento"] == "2001-05-20"
    assert body["ano_lancamento"] == 2001
    assert body["sinopse"] == "Uma sinopse."
    assert body["duracao_minutos"] == 0
    assert body["status_filme"] == "Lançado"
    assert body["url_poster"] == POSTER_URL
    assert body["diretores"] == ["Diretor Novo"]
    assert [p["nome"] for p in body["creditos"]["diretores"]] == ["Diretor Novo"]
    assert body["generos"] == ["Ficção"]


async def test_create_derives_year_from_release_date(client: httpx.AsyncClient) -> None:
    body = (await create(client, titulo="X", data_lancamento="1995-03-01")).json()

    assert body["ano_lancamento"] == 1995


async def test_create_reuses_existing_genre_and_director(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    response = await create(
        client,
        titulo="Reuso",
        generos=["drama", "Drama", "Faroeste"],
        diretores=["Francis Coppola", "Francis Coppola", "Sofia Coppola"],
    )

    assert response.status_code == 201
    body = response.json()
    assert body["generos"] == ["Drama", "Faroeste"]
    assert body["diretores"] == ["Francis Coppola", "Sofia Coppola"]

    genres = await count_rows(session_factory, select(func.count()).select_from(DimGenre))
    assert genres == 4
    coppolas = await count_rows(
        session_factory,
        select(func.count())
        .select_from(DimPerson)
        .where(DimPerson.nome_pessoa == "Francis Coppola"),
    )
    assert coppolas == 1


async def test_create_director_does_not_reuse_person_of_other_type(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    response = await create(client, titulo="Mudança", diretores=["Mario Puzo"])

    assert response.status_code == 201
    puzos = await count_rows(
        session_factory,
        select(func.count()).select_from(DimPerson).where(DimPerson.nome_pessoa == "Mario Puzo"),
    )
    assert puzos == 2


async def test_create_with_duplicate_id_filme_returns_409(client: httpx.AsyncClient) -> None:
    response = await create(client, titulo="Duplicado", id_filme="238")

    assert response.status_code == 409


async def test_create_conflict_detected_only_at_commit_returns_409(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Simula a corrida em que outra requisição grava o mesmo id_filme após a checagem."""

    async def never_exists(*args: object, **kwargs: object) -> bool:
        return False

    monkeypatch.setattr(repository, "id_filme_exists", never_exists)

    response = await create(client, titulo="Corrida", id_filme="238")

    assert response.status_code == 409
    assert (await client.get(MOVIES_URL, params={"q": "Corrida"})).json()["total"] == 0


@pytest.mark.parametrize("campo", ["sinopse", "status_filme", "url_poster"])
@pytest.mark.parametrize("vazio", ["", "   "])
async def test_create_blank_optional_text_is_stored_as_null(
    client: httpx.AsyncClient, campo: str, vazio: str
) -> None:
    response = await create(client, titulo="Vazio", **{campo: vazio})

    assert response.status_code == 201
    assert response.json()[campo] is None


@pytest.mark.parametrize("campo", ["sinopse", "status_filme", "url_poster"])
async def test_patch_blank_optional_text_clears_field(
    client: httpx.AsyncClient, campo: str
) -> None:
    response = await client.patch(f"{MOVIES_URL}/m1", json={campo: " "})

    assert response.status_code == 200
    assert response.json()[campo] is None


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "ftp://example.com/poster.jpg",
        "/relativo.jpg",
        "https://",
    ],
)
async def test_create_rejects_non_http_poster_url(client: httpx.AsyncClient, url: str) -> None:
    response = await create(client, titulo="Pôster", url_poster=url)

    assert response.status_code == 422


async def test_patch_rejects_non_http_poster_url(client: httpx.AsyncClient) -> None:
    response = await client.patch(f"{MOVIES_URL}/m1", json={"url_poster": "javascript:alert(1)"})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "url", ["http://example.com/p.jpg", "https://image.tmdb.org/t/p/w500/x.jpg?v=1"]
)
async def test_create_accepts_http_poster_url_unchanged(
    client: httpx.AsyncClient, url: str
) -> None:
    response = await create(client, titulo="Pôster", url_poster=url)

    assert response.status_code == 201
    assert response.json()["url_poster"] == url


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"titulo": ""},
        {"titulo": "   "},
        {"titulo": None},
        {"titulo": "x" * 501},
        {"titulo": "ok", "ano_lancamento": 1887},
        {"titulo": "ok", "ano_lancamento": 2101},
        {"titulo": "ok", "data_lancamento": "1800-01-01"},
        {"titulo": "ok", "sinopse": "x" * 4001},
        {"titulo": "ok", "status_filme": "x" * 51},
        {"titulo": "ok", "url_poster": "https://e.com/" + "x" * 2035},
        {"titulo": "ok", "id_filme": ""},
        {"titulo": "ok", "id_filme": "x" * 51},
        {"titulo": "ok", "duracao_minutos": -1},
        {"titulo": "ok", "duracao_minutos": 1001},
        {"titulo": "ok", "url_backdrop": "/bg.jpg"},
        {"titulo": "ok", "diretores": [""]},
        {"titulo": "ok", "diretores": ["x" * 256]},
        {"titulo": "ok", "generos": ["x" * 51]},
        {"titulo": "ok", "generos": [f"g{i}" for i in range(21)]},
        {"titulo": "ok", "generos": None},
        {"titulo": "ok", "ano_lancamento": 2000, "data_lancamento": "2001-01-01"},
    ],
)
async def test_create_rejects_invalid_payload(
    client: httpx.AsyncClient, payload: dict[str, object]
) -> None:
    response = await client.post(MOVIES_URL, json=payload)

    assert response.status_code == 422


# ---------------------------------------------------------------- atualização


async def test_patch_updates_only_sent_fields(client: httpx.AsyncClient) -> None:
    before = (await client.get(f"{MOVIES_URL}/m1")).json()

    response = await client.patch(f"{MOVIES_URL}/m1", json={"titulo": "Chefão Editado"})

    assert response.status_code == 200
    assert response.json() == {**before, "titulo": "Chefão Editado"}


async def test_patch_replaces_directors_and_keeps_other_people(
    client: httpx.AsyncClient,
) -> None:
    response = await client.patch(
        f"{MOVIES_URL}/m1", json={"diretores": ["Co Diretor", "Diretor Novo"]}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["diretores"] == ["Co Diretor", "Diretor Novo"]
    assert len(body["atores"]) == 10
    assert body["roteiristas"] == ["Mario Puzo"]


async def test_patch_empty_lists_clear_genres_and_directors(client: httpx.AsyncClient) -> None:
    body = (await client.patch(f"{MOVIES_URL}/m1", json={"generos": [], "diretores": []})).json()

    assert body["generos"] == []
    assert body["diretores"] == []


async def test_patch_replaces_genres(client: httpx.AsyncClient) -> None:
    body = (await client.patch(f"{MOVIES_URL}/m1", json={"generos": ["horror", "Novo"]})).json()

    assert body["generos"] == ["Horror", "Novo"]


async def test_patch_null_clears_optional_field(client: httpx.AsyncClient) -> None:
    body = (await client.patch(f"{MOVIES_URL}/m1", json={"sinopse": None})).json()

    assert body["sinopse"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"titulo": None},
        {"titulo": " "},
        {"diretores": None},
        {"generos": None},
        {"ano_lancamento": 1500},
        {"url_backdrop": "/x.jpg"},
    ],
)
async def test_patch_rejects_invalid_payload(
    client: httpx.AsyncClient, payload: dict[str, object]
) -> None:
    response = await client.patch(f"{MOVIES_URL}/m1", json=payload)

    assert response.status_code == 422


async def test_patch_year_must_match_stored_release_date(client: httpx.AsyncClient) -> None:
    await client.patch(f"{MOVIES_URL}/m1", json={"data_lancamento": "1972-03-24"})

    response = await client.patch(f"{MOVIES_URL}/m1", json={"ano_lancamento": 1980})

    assert response.status_code == 422
    # Mesmo formato dos erros de validação do Pydantic/FastAPI.
    [error] = response.json()["detail"]
    assert error["loc"] == ["body", "ano_lancamento"]
    assert error["type"] == "value_error"
    assert "data_lancamento" in error["msg"]


async def test_patch_release_date_updates_year(client: httpx.AsyncClient) -> None:
    body = (await client.patch(f"{MOVIES_URL}/m1", json={"data_lancamento": "1973-01-01"})).json()

    assert body["ano_lancamento"] == 1973


async def test_patch_unknown_movie_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.patch(f"{MOVIES_URL}/nao-existe", json={"titulo": "X"})

    assert response.status_code == 404


async def test_patch_id_filme_of_other_movie_returns_409(client: httpx.AsyncClient) -> None:
    response = await client.patch(f"{MOVIES_URL}/m2", json={"id_filme": "238"})

    assert response.status_code == 409


async def test_patch_keeping_own_id_filme_is_allowed(client: httpx.AsyncClient) -> None:
    response = await client.patch(f"{MOVIES_URL}/m1", json={"id_filme": "238"})

    assert response.status_code == 200


# ---------------------------------------------------------------- remoção


async def test_delete_removes_movie_and_dependents(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    response = await client.delete(f"{MOVIES_URL}/m1")

    assert response.status_code == 204
    assert response.content == b""
    assert (await client.get(f"{MOVIES_URL}/m1")).status_code == 404

    for table in (MovieReview, DimReview, FactMoviePerformance):
        remaining = await count_rows(
            session_factory,
            select(func.count()).select_from(table).where(table.sk_movie_id == "m1"),
        )
        assert remaining == 0, table.__tablename__
    for bridge in (bridge_movie_genre, bridge_movie_person, bridge_movie_company):
        remaining = await count_rows(
            session_factory,
            select(func.count()).select_from(bridge).where(bridge.c.sk_movie_id == "m1"),
        )
        assert remaining == 0, bridge.name


async def test_delete_keeps_shared_dimensions(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.delete(f"{MOVIES_URL}/m1")

    genres = await count_rows(session_factory, select(func.count()).select_from(DimGenre))
    people = await count_rows(session_factory, select(func.count()).select_from(DimPerson))
    assert genres == 3
    assert people == 15
    drama_movies = (await client.get(MOVIES_URL, params={"genero": "Drama"})).json()
    assert drama_movies["total"] == 1


async def test_delete_unknown_movie_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.delete(f"{MOVIES_URL}/nao-existe")

    assert response.status_code == 404
