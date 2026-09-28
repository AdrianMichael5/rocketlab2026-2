"""Acesso a dados do domínio de pessoas."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, selectinload

from app.movies.models import DimMovie, DimPerson, bridge_movie_person


async def get_person(session: AsyncSession, sk_person_id: str) -> DimPerson | None:
    return await session.get(DimPerson, sk_person_id)


async def list_person_movies(
    session: AsyncSession, sk_person_id: str, offset: int, limit: int
) -> tuple[list[DimMovie], int]:
    """Filmes da pessoa, do mais recente ao mais antigo (sem ano por último)."""

    # Conta só na bridge, pelo índice em sk_person_id, sem tocar em dim_movies.
    count_stmt = (
        select(func.count())
        .select_from(bridge_movie_person)
        .where(bridge_movie_person.c.sk_person_id == sk_person_id)
    )
    total = (await session.execute(count_stmt)).scalar_one()
    if offset >= total:
        return [], total

    page_stmt = (
        select(DimMovie)
        .join(bridge_movie_person, bridge_movie_person.c.sk_movie_id == DimMovie.sk_movie_id)
        .outerjoin(DimMovie.reviews_summary)
        .where(bridge_movie_person.c.sk_person_id == sk_person_id)
        .options(contains_eager(DimMovie.reviews_summary), selectinload(DimMovie.genres))
        .order_by(
            DimMovie.ano_lancamento.desc().nulls_last(),
            DimMovie.titulo.collate("NOCASE"),
            # Desempate estável para que a paginação não repita nem pule filmes.
            DimMovie.sk_movie_id,
        )
        .offset(offset)
        .limit(limit)
    )
    movies = (await session.scalars(page_stmt)).all()
    return list(movies), total
