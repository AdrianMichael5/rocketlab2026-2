"""Índices de cobertura para as agregações de GET /api/v1/stats.

ix_movie_reviews_sk_movie_id_nota substitui ix_movie_reviews_sk_movie_id (é prefixo dele).
ANALYZE preenche sqlite_stat1; sem ele o SQLite prefere a chave primária de
fact_movies_performance ao índice de cobertura.

Revision ID: 0003_stats_covering_indexes
Revises: 0002_titulo_nocase_index
Create Date: 2026-09-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_stats_covering_indexes"
down_revision: str | Sequence[str] | None = "0002_titulo_nocase_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_movie_reviews_sk_movie_id_nota", "movie_reviews", ["sk_movie_id", "nota"])
    op.drop_index("ix_movie_reviews_sk_movie_id", table_name="movie_reviews")
    op.create_index(
        "ix_fact_movies_performance_notas",
        "fact_movies_performance",
        ["sk_movie_id", "nota_imdb", "nota_tmdb"],
    )
    op.execute("ANALYZE")


def downgrade() -> None:
    op.drop_index("ix_fact_movies_performance_notas", table_name="fact_movies_performance")
    op.create_index("ix_movie_reviews_sk_movie_id", "movie_reviews", ["sk_movie_id"])
    op.drop_index("ix_movie_reviews_sk_movie_id_nota", table_name="movie_reviews")
