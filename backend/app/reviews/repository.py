"""Acesso a dados das avaliações e do resumo dim_reviews."""

from sqlalchemy import delete, func, literal, literal_column, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.movies.models import DimMovie, DimReview, MovieReview
from app.reviews.schemas import CASAS_MEDIA

# created_at vem de CURRENT_TIMESTAMP (resolução de segundos) e o seed grava todas as
# avaliações no mesmo instante; o rowid desempata pela ordem de inserção.
_ROWID = literal_column("movie_reviews.rowid")


async def movie_exists(session: AsyncSession, sk_movie_id: str) -> bool:
    stmt = select(DimMovie.sk_movie_id).where(DimMovie.sk_movie_id == sk_movie_id)
    return (await session.scalar(stmt)) is not None


async def list_reviews(
    session: AsyncSession, sk_movie_id: str, offset: int, limit: int
) -> tuple[list[MovieReview], int]:
    """Retorna uma página das avaliações do filme, da mais recente para a mais antiga."""

    count_stmt = (
        select(func.count()).select_from(MovieReview).where(MovieReview.sk_movie_id == sk_movie_id)
    )
    total = (await session.execute(count_stmt)).scalar_one()
    page_stmt = (
        select(MovieReview)
        .where(MovieReview.sk_movie_id == sk_movie_id)
        .order_by(MovieReview.created_at.desc(), _ROWID.desc())
        .offset(offset)
        .limit(limit)
    )
    reviews = (await session.scalars(page_stmt)).all()
    return list(reviews), total


async def delete_review(session: AsyncSession, sk_movie_review_id: str) -> str | None:
    """Remove a avaliação e devolve o sk_movie_id do filme, ou None se não existir."""

    stmt = (
        delete(MovieReview)
        .where(MovieReview.sk_movie_review_id == sk_movie_review_id)
        .returning(MovieReview.sk_movie_id)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def recalculate_summary(session: AsyncSession, sk_movie_id: str) -> None:
    """Regrava COUNT/AVG do filme em dim_reviews (upsert), dentro da transação atual.

    Agregação sem GROUP BY sempre devolve uma linha: sem avaliações, COUNT = 0 e
    AVG = NULL. sk_review_id = sk_movie_id, como na carga do seed.
    """

    aggregate = select(
        literal(sk_movie_id),
        literal(sk_movie_id),
        func.count(),
        func.round(func.avg(MovieReview.nota), CASAS_MEDIA),
    ).where(MovieReview.sk_movie_id == sk_movie_id)
    stmt = sqlite_insert(DimReview).from_select(
        ["sk_review_id", "sk_movie_id", "qtd_avaliacoes_usuarios", "nota_media_usuarios"],
        aggregate,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[DimReview.sk_movie_id],
        set_={
            "qtd_avaliacoes_usuarios": stmt.excluded.qtd_avaliacoes_usuarios,
            "nota_media_usuarios": stmt.excluded.nota_media_usuarios,
        },
    )
    await session.execute(stmt)
