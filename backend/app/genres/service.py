"""Regras de negócio do domínio de gêneros."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import response_cache
from app.genres import repository


async def list_genres(session: AsyncSession) -> list[str]:
    return await response_cache.get_or_load(
        ("genres",), lambda: repository.list_genre_names(session)
    )
