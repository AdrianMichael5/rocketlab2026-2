"""Busca full-text (FTS5) em GET /movies?q=: título, diretores e atores."""

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.cache import response_cache
from app.movies import repository
from app.movies.search import SEARCH_TABLE

pytestmark = pytest.mark.usefixtures("catalog")

MOVIES_URL = "/api/v1/movies"

Sessions = async_sessionmaker[AsyncSession]


async def list_titles(client: httpx.AsyncClient, **params: object) -> list[str]:
    response = await client.get(MOVIES_URL, params=params)
    assert response.status_code == 200
    return [item["titulo"] for item in response.json()["items"]]


@pytest.mark.parametrize("q", ["chefao", "CHEFÃO", "Chéfão", "chef"])
async def test_search_ignores_accents_and_case_and_matches_word_prefix(
    client: httpx.AsyncClient, q: str
) -> None:
    assert await list_titles(client, q=q) == ["Chefão 100% Real_Test", "O Poderoso Chefão"]


async def test_search_finds_movie_by_director(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="coppola") == ["O Poderoso Chefão"]


async def test_search_finds_movie_by_actor(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="ator 03") == ["O Poderoso Chefão"]


async def test_search_ignores_screenwriters(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="puzo") == []


async def test_search_requires_every_word(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="pod chef") == ["O Poderoso Chefão"]
    assert await list_titles(client, q="alien chef") == []


async def test_search_does_not_match_in_the_middle_of_a_word(client: httpx.AsyncClient) -> None:
    # Diferente do LIKE: o FTS casa só o início das palavras.
    assert await list_titles(client, q="hefão") == []


async def test_search_combines_with_filters_and_paginates(client: httpx.AsyncClient) -> None:
    body = (
        await client.get(
            MOVIES_URL, params={"q": "chefao", "genero": "drama", "page_size": 1, "page": 2}
        )
    ).json()

    assert body["total"] == 2
    assert body["page"] == 2
    assert [item["titulo"] for item in body["items"]] == ["O Poderoso Chefão"]
    assert await list_titles(client, q="chefao", ano=1972) == ["O Poderoso Chefão"]


async def test_search_keeps_requested_order(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="chefao", ordem="ano") == [
        "Chefão 100% Real_Test",
        "O Poderoso Chefão",
    ]


async def test_single_character_query_keeps_substring_search(client: httpx.AsyncClient) -> None:
    # "v" está no meio de "bravo": só o LIKE encontra.
    assert await list_titles(client, q="v") == ["bravo"]


async def test_query_without_words_falls_back_to_substring_search(
    client: httpx.AsyncClient,
) -> None:
    await client.post(MOVIES_URL, json={"titulo": "Quem?! Eu?!"})

    assert await list_titles(client, q="?!") == ["Quem?! Eu?!"]


async def test_single_letter_words_are_ignored_by_fts(client: httpx.AsyncClient) -> None:
    assert await list_titles(client, q="O Poderoso") == ["O Poderoso Chefão"]


@pytest.mark.parametrize(
    ("q", "titulos", "esperado"),
    [
        ("X-Men", ["X-Men", "Men in Black"], ["X-Men"]),
        ("K-19", ["K-19: The Widowmaker", "19 Dias"], ["K-19: The Widowmaker"]),
        ("Rocky V", ["Rocky V", "Rocky Vs. Apollo"], ["Rocky V"]),
    ],
)
async def test_single_letter_words_must_match_exactly(
    client: httpx.AsyncClient, q: str, titulos: list[str], esperado: list[str]
) -> None:
    for titulo in titulos:
        await client.post(MOVIES_URL, json={"titulo": titulo})

    assert await list_titles(client, q=q) == esperado


async def test_query_with_only_single_letter_words_uses_substring_search(
    client: httpx.AsyncClient,
) -> None:
    await client.post(MOVIES_URL, json={"titulo": "E.T. o Extraterrestre"})
    await client.post(MOVIES_URL, json={"titulo": "Eu e Tu"})

    assert await list_titles(client, q="E.T.") == ["E.T. o Extraterrestre"]


async def test_cjk_query_uses_substring_search(client: httpx.AsyncClient) -> None:
    await client.post(MOVIES_URL, json={"titulo": "千と千尋の神隠し"})

    assert await list_titles(client, q="神隠し") == ["千と千尋の神隠し"]


async def test_long_query_with_many_words_is_answered(client: httpx.AsyncClient) -> None:
    response = await client.get(MOVIES_URL, params={"q": " ".join(["ab"] * 66)})

    assert response.status_code == 200


@pytest.mark.parametrize("q", ['"', '""', "a OR", "NEAR(", "titulo:x", "-chef", "chef*"])
async def test_fts_syntax_in_query_is_treated_as_text(client: httpx.AsyncClient, q: str) -> None:
    response = await client.get(MOVIES_URL, params={"q": q})

    assert response.status_code == 200


# ---------------------------------------------------------------- sincronização nas escritas


async def search_entries(session_factory: Sessions, sk_movie_id: str) -> list[dict[str, object]]:
    async with session_factory() as session:
        result = await session.execute(
            text(f"SELECT titulo, diretores, atores FROM {SEARCH_TABLE} WHERE sk_movie_id = :id"),
            {"id": sk_movie_id},
        )
        return [dict(row) for row in result.mappings()]


async def test_created_movie_is_searchable_by_title_and_director(
    client: httpx.AsyncClient,
) -> None:
    await client.post(
        MOVIES_URL, json={"titulo": "Cidade de Deus", "diretores": ["Fernando Meirelles"]}
    )

    assert await list_titles(client, q="cidade") == ["Cidade de Deus"]
    assert await list_titles(client, q="meireles") == []
    assert await list_titles(client, q="meirel") == ["Cidade de Deus"]


async def test_patch_title_replaces_indexed_title(client: httpx.AsyncClient) -> None:
    await client.patch(f"{MOVIES_URL}/m4", json={"titulo": "O Resgate"})

    assert await list_titles(client, q="resgate") == ["O Resgate"]
    assert await list_titles(client, q="alien") == []


async def test_patch_directors_replaces_indexed_directors_and_keeps_actors(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.patch(f"{MOVIES_URL}/m1", json={"diretores": ["Sofia Coppolla"]})

    assert await list_titles(client, q="francis") == []
    assert await list_titles(client, q="sofia") == ["O Poderoso Chefão"]
    assert await list_titles(client, q="ator 12") == ["O Poderoso Chefão"]
    assert len(await search_entries(session_factory, "m1")) == 1


async def test_patch_other_fields_keeps_movie_searchable(client: httpx.AsyncClient) -> None:
    await client.patch(f"{MOVIES_URL}/m1", json={"sinopse": "Outra sinopse."})

    assert await list_titles(client, q="coppola") == ["O Poderoso Chefão"]


async def test_delete_removes_movie_from_search_index(
    client: httpx.AsyncClient, session_factory: Sessions
) -> None:
    await client.delete(f"{MOVIES_URL}/m1")

    assert await search_entries(session_factory, "m1") == []
    assert await list_titles(client, q="coppola") == []


async def test_failed_create_leaves_no_search_entry(
    client: httpx.AsyncClient, session_factory: Sessions, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def never_exists(*args: object, **kwargs: object) -> bool:
        return False

    monkeypatch.setattr(repository, "id_filme_exists", never_exists)

    response = await client.post(MOVIES_URL, json={"titulo": "Corrida", "id_filme": "238"})

    assert response.status_code == 409
    async with session_factory() as session:
        total = await session.scalar(text(f"SELECT count(*) FROM {SEARCH_TABLE}"))
    assert total == 5


# ---------------------------------------------------------------- plano de consulta


@pytest.mark.parametrize("ordem", ["titulo", "ano", "nota"])
@pytest.mark.parametrize("page", [1, 2])
async def test_large_result_plan_returns_same_page_as_small_result_plan(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch, ordem: str, page: int
) -> None:
    params = {"q": "chef", "ordem": ordem, "page_size": 1, "page": page}
    expected = (await client.get(MOVIES_URL, params=params)).json()

    # Com limite zero toda busca FTS usa o plano de resultados grandes.
    monkeypatch.setattr(repository, "LARGE_SEARCH_RESULT", 0)
    response_cache.clear()

    assert (await client.get(MOVIES_URL, params=params)).json() == expected
