"""Regras de negócio do domínio de gêneros."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.genres import repository


async def list_genres(session: AsyncSession) -> list[str]:
    return await repository.list_genre_names(session)
