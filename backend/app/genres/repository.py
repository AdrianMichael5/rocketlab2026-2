"""Acesso a dados do domínio de gêneros."""

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.movies.models import DimGenre, bridge_movie_genre


async def list_genre_names(session: AsyncSession) -> list[str]:
    """Nomes dos gêneros com ao menos um filme, em ordem alfabética sem diferenciar caixa."""

    stmt = (
        select(DimGenre.nome_genero)
        .where(exists().where(bridge_movie_genre.c.sk_genre_id == DimGenre.sk_genre_id))
        .order_by(DimGenre.nome_genero.collate("NOCASE"))
    )
    return list(await session.scalars(stmt))
