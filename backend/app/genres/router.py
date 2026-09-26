"""Endpoints HTTP do domínio de gêneros."""

from fastapi import APIRouter

from app.api.deps import DbSession
from app.genres import service

router = APIRouter()


@router.get("", response_model=list[str])
async def list_genres(session: DbSession) -> list[str]:
    """Lista os gêneros que têm filmes, para os filtros do catálogo."""

    return await service.list_genres(session)
