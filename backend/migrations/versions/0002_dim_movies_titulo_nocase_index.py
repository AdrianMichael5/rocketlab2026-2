"""Índice para ordenar filmes por título sem diferenciar maiúsculas.

Revision ID: 0002_titulo_nocase_index
Revises: 0001_initial_movie_schema
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_titulo_nocase_index"
down_revision: str | Sequence[str] | None = "0001_initial_movie_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_dim_movies_titulo_nocase",
        "dim_movies",
        [sa.text("titulo COLLATE NOCASE"), "sk_movie_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_dim_movies_titulo_nocase", table_name="dim_movies")
