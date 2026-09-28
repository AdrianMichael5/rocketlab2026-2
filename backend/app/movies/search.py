"""Índice full-text (SQLite FTS5) de título, diretores e atores dos filmes.

A tabela virtual `movies_fts` é criada pela migração 0004 e mantida pela aplicação:
o service regrava a linha do filme em create/update/delete e o seed reconstrói o índice
inteiro. O tokenizer unicode61 com remove_diacritics ignora acentos e maiúsculas.

O vínculo com dim_movies é a coluna `sk_movie_id` (UNINDEXED), e não o rowid: a chave
de dim_movies é texto, então o rowid dela pode mudar num VACUUM.
"""

import re
from typing import Any

from sqlalchemy import Select, column, literal_column, select, table, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

SEARCH_TABLE = "movies_fts"
# Abaixo disso a busca continua por trecho do título (LIKE): um prefixo de uma letra
# casaria com quase todo o catálogo.
MIN_FTS_QUERY_LENGTH = 2

# Palavras mais curtas que isso entram como palavra exata, sem `*`: como prefixo, "x"
# casaria com quase todo o catálogo e não usaria os índices de prefixo (prefix='2 3').
MIN_PREFIX_LENGTH = 2
# Limita o custo de buscas longas (q aceita até 200 caracteres).
MAX_MATCH_WORDS = 10

# Letras e dígitos Unicode; "_" e pontuação separam palavras, como no unicode61.
_WORD = re.compile(r"[^\W_]+")
# Ideogramas, kana e hangul. O unicode61 não separa palavras nesses idiomas e indexa uma
# frase inteira como uma palavra só, então só o LIKE acha trechos no meio do título.
_CJK = re.compile(
    "[ᄀ-ᇿ぀-ヿ㄀-ㄯ㄰-㆏ㇰ-ㇿ"
    "㐀-䶿一-鿿가-힯豈-﫿ｦ-ﾟ]"
)

CREATE_SEARCH_TABLE = text(
    f"CREATE VIRTUAL TABLE {SEARCH_TABLE} USING fts5("
    "sk_movie_id UNINDEXED, titulo, diretores, atores, "
    "tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3')"
)


def _names_of(tipo: str) -> str:
    return (
        "(SELECT group_concat(p.nome_pessoa, ' ') FROM bridge_movie_person AS b "
        "JOIN dim_people AS p ON p.sk_person_id = b.sk_person_id "
        f"WHERE b.sk_movie_id = m.sk_movie_id AND p.tipo_pessoa = '{tipo}')"
    )


_INSERT_ROWS = (
    f"INSERT INTO {SEARCH_TABLE} (sk_movie_id, titulo, diretores, atores) "
    f"SELECT m.sk_movie_id, m.titulo, {_names_of('Diretor')}, {_names_of('Ator')} "
    "FROM dim_movies AS m"
)
INSERT_ALL_ENTRIES = text(_INSERT_ROWS)
INSERT_ENTRY = text(f"{_INSERT_ROWS} WHERE m.sk_movie_id = :sk_movie_id")
DELETE_ENTRY = text(f"DELETE FROM {SEARCH_TABLE} WHERE sk_movie_id = :sk_movie_id")
DELETE_ALL_ENTRIES = text(f"DELETE FROM {SEARCH_TABLE}")
# Funde os segmentos do índice depois de uma carga em lote.
OPTIMIZE = text(f"INSERT INTO {SEARCH_TABLE} ({SEARCH_TABLE}) VALUES ('optimize')")

_search_table = table(SEARCH_TABLE, column("sk_movie_id"))


def build_match_query(q: str) -> str | None:
    """Converte o texto do usuário numa expressão MATCH segura: AND de prefixos.

    Cada palavra vai entre aspas, então operadores do FTS5 digitados pelo usuário (OR,
    NEAR, `-`, `:`) viram texto comum. Palavras com 2+ letras recebem `*` (prefixo); as
    de uma letra precisam casar exatamente ("X-Men" → `"X" "Men"*`). Repetidas são
    descartadas e só as primeiras MAX_MATCH_WORDS entram. Retorna None (busca por
    trecho do título) sem palavras, só com palavras de uma letra ("E.T.") ou com CJK.
    """

    if _CJK.search(q):
        return None
    words: dict[str, str] = {}
    for word in _WORD.findall(q):
        words.setdefault(word.casefold(), word)
    selected = list(words.values())[:MAX_MATCH_WORDS]
    if all(len(word) < MIN_PREFIX_LENGTH for word in selected):
        return None
    return " ".join(
        f'"{word}"*' if len(word) >= MIN_PREFIX_LENGTH else f'"{word}"' for word in selected
    )


def matching_movie_ids(match: str) -> Select[Any]:
    """Subconsulta com os sk_movie_id cujo título, diretores ou atores casam com `match`."""

    return select(_search_table.c.sk_movie_id).where(
        literal_column(SEARCH_TABLE).op("MATCH")(match)
    )


async def rebuild_search_index(conn: AsyncConnection | AsyncSession) -> None:
    """Regrava o índice inteiro a partir de dim_movies e dos créditos."""

    await conn.execute(DELETE_ALL_ENTRIES)
    await conn.execute(INSERT_ALL_ENTRIES)
    await conn.execute(OPTIMIZE)


def is_search_index_table(name: str | None) -> bool:
    """A tabela virtual e as tabelas-sombra que o FTS5 cria (movies_fts_data, ...)."""

    return name is not None and (name == SEARCH_TABLE or name.startswith(f"{SEARCH_TABLE}_"))


def include_in_autogenerate(name: str | None, type_: str, parent_names: object) -> bool:
    """Filtro `include_name` do Alembic: o índice FTS não tem modelo ORM."""

    del parent_names
    return not (type_ == "table" and is_search_index_table(name))
