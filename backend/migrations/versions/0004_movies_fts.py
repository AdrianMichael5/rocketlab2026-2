"""Índice full-text (FTS5) de título, diretores e atores para a busca de filmes.

unicode61 com remove_diacritics 2 ignora acentos e maiúsculas; prefix='2 3' acelera
buscas por prefixos curtos. O índice é preenchido aqui com os dados já existentes e,
depois, mantido pela aplicação (app/movies/search.py) e reconstruído pelo seed.
O SQL fica copiado nesta migração para que ela não mude se a aplicação mudar.

Revision ID: 0004_movies_fts
Revises: 0003_stats_covering_indexes
Create Date: 2026-09-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004_movies_fts"
down_revision: str | Sequence[str] | None = "0003_stats_covering_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _names_of(tipo: str) -> str:
    return (
        "(SELECT group_concat(p.nome_pessoa, ' ') FROM bridge_movie_person AS b "
        "JOIN dim_people AS p ON p.sk_person_id = b.sk_person_id "
        f"WHERE b.sk_movie_id = m.sk_movie_id AND p.tipo_pessoa = '{tipo}')"
    )


def upgrade() -> None:
    op.execute(
        "CREATE VIRTUAL TABLE movies_fts USING fts5("
        "sk_movie_id UNINDEXED, titulo, diretores, atores, "
        "tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3')"
    )
    op.execute(
        "INSERT INTO movies_fts (sk_movie_id, titulo, diretores, atores) "
        f"SELECT m.sk_movie_id, m.titulo, {_names_of('Diretor')}, {_names_of('Ator')} "
        "FROM dim_movies AS m"
    )
    op.execute("INSERT INTO movies_fts (movies_fts) VALUES ('optimize')")


def downgrade() -> None:
    # Remover a tabela virtual remove também as tabelas-sombra (movies_fts_data, ...).
    op.execute("DROP TABLE movies_fts")
