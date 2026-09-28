"""Endpoints HTTP do domínio de estatísticas."""

from fastapi import APIRouter

from app.api.deps import DbSession
from app.stats import service
from app.stats.schemas import StatsOut

router = APIRouter()


@router.get("", response_model=StatsOut)
async def get_stats(session: DbSession) -> StatsOut:
    """Números gerais, rankings e médias por gênero e ano para a página de insights."""

    return await service.get_stats(session)
