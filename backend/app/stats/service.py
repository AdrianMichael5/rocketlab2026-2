"""Regras de negócio do domínio de estatísticas."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.stats import repository
from app.stats.schemas import (
    AnoStatsOut,
    GeneroStatsOut,
    ResumoOut,
    StatsOut,
    TopAvaliadoOut,
    TopLucroOut,
)


async def get_stats(session: AsyncSession) -> StatsOut:
    # Em sequência: uma AsyncSession não aceita consultas concorrentes.
    resumo = await repository.get_resumo(session)
    top_avaliados = await repository.list_top_avaliados(session)
    top_lucro = await repository.list_top_lucro(session)
    generos = await repository.list_generos(session)
    filmes_por_ano = await repository.list_filmes_por_ano(session)
    return StatsOut(
        resumo=ResumoOut.model_validate(resumo),
        top_avaliados=[TopAvaliadoOut.model_validate(row) for row in top_avaliados],
        top_lucro=[TopLucroOut.model_validate(row) for row in top_lucro],
        generos=[GeneroStatsOut.model_validate(row) for row in generos],
        filmes_por_ano=[AnoStatsOut.model_validate(row) for row in filmes_por_ano],
    )
