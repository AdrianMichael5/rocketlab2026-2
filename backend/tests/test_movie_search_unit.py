import pytest

from app.movies.search import MAX_MATCH_WORDS, build_match_query, include_in_autogenerate


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("chefão", '"chefão"*'),
        ("  Poderoso   Chefão ", '"Poderoso"* "Chefão"*'),
        ("Real_Test", '"Real"* "Test"*'),
        ("ator 03", '"ator"* "03"*'),
        ("O'Brien-Smith", '"O" "Brien"* "Smith"*'),
        ("O Poderoso Chefão", '"O" "Poderoso"* "Chefão"*'),
        ("X-Men", '"X" "Men"*'),
        ("Rocky V", '"Rocky"* "V"'),
        ("Toy Story 2", '"Toy"* "Story"* "2"'),
    ],
)
def test_build_match_query_quotes_words_and_uses_prefix_only_for_longer_words(
    q: str, expected: str
) -> None:
    assert build_match_query(q) == expected


@pytest.mark.parametrize("q", ['"chef', "chef*", "NEAR(a b)", "titulo:chef", "-chef", "a OR b"])
def test_build_match_query_neutralizes_fts_syntax(q: str) -> None:
    match = build_match_query(q)

    assert match is not None
    # Operadores só existem fora de aspas: todo termo sai entre aspas (com * opcional).
    for term in match.split(" "):
        inner = term.removesuffix("*")
        assert inner.startswith('"')
        assert inner.endswith('"')
        assert '"' not in inner[1:-1]


@pytest.mark.parametrize("q", ["", "   ", "%%", "__", "?!", '""', "E.T.", "a b c"])
def test_build_match_query_returns_none_without_words(q: str) -> None:
    assert build_match_query(q) is None


@pytest.mark.parametrize(
    ("name", "type_", "included"),
    [
        ("movies_fts", "table", False),
        ("movies_fts_data", "table", False),
        ("movies_fts_idx", "table", False),
        ("dim_movies", "table", True),
        ("movies_fts", "index", True),
    ],
)
def test_include_in_autogenerate_skips_only_search_index_tables(
    name: str, type_: str, included: bool
) -> None:
    assert include_in_autogenerate(name, type_, {}) is included


def test_build_match_query_ignores_repeated_words() -> None:
    assert build_match_query("Star star STAR wars") == '"Star"* "wars"*'


def test_build_match_query_caps_number_of_words() -> None:
    words = [f"palavra{i:02d}" for i in range(MAX_MATCH_WORDS + 5)]

    match = build_match_query(" ".join(words))

    assert match == " ".join(f'"{word}"*' for word in words[:MAX_MATCH_WORDS])


@pytest.mark.parametrize(
    "q",
    ["神隠し", "千と千尋の神隠し", "カウボーイ ビバップ", "기생충", "Spirited 神隠し"],
)
def test_build_match_query_returns_none_for_cjk_text(q: str) -> None:
    # unicode61 não separa palavras em chinês/japonês: o LIKE acha trechos no meio do título.
    assert build_match_query(q) is None
