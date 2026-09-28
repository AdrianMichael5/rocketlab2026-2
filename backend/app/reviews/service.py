"""Regras de negócio das avaliações: escrita + recálculo de dim_reviews numa transação."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import response_cache
from app.movies.models import MovieReview, generate_surrogate_key
from app.movies.schemas import Page
from app.movies.service import MovieNotFoundError
from app.reviews import repository
from app.reviews.schemas import ReviewCreate, ReviewOut


class ReviewNotFoundError(Exception):
    """Avaliação inexistente para o identificador informado."""


async def _ensure_movie_exists(session: AsyncSession, sk_movie_id: str) -> None:
    if not await repository.movie_exists(session, sk_movie_id):
        raise MovieNotFoundError(sk_movie_id)


async def list_reviews(
    session: AsyncSession, sk_movie_id: str, page: int, page_size: int
) -> Page[ReviewOut]:
    await _ensure_movie_exists(session, sk_movie_id)
    reviews, total = await repository.list_reviews(
        session, sk_movie_id, offset=(page - 1) * page_size, limit=page_size
    )
    return Page[ReviewOut](
        items=[ReviewOut.model_validate(review) for review in reviews],
        total=total,
        page=page,
        page_size=page_size,
    )


async def create_review(
    session: AsyncSession, sk_movie_id: str, payload: ReviewCreate
) -> ReviewOut:
    await _ensure_movie_exists(session, sk_movie_id)
    review = MovieReview(
        **payload.model_dump(),
        sk_movie_review_id=generate_surrogate_key(),
        sk_movie_id=sk_movie_id,
    )
    session.add(review)
    try:
        await session.flush()
        await repository.recalculate_summary(session, sk_movie_id)
        await session.commit()
    except IntegrityError as exc:
        # FK violada: o filme foi removido entre a checagem e a gravação.
        await session.rollback()
        raise MovieNotFoundError(sk_movie_id) from exc
    response_cache.clear()
    # created_at já veio do banco no INSERT (eager_defaults em MovieReview).
    return ReviewOut.model_validate(review)


async def delete_review(session: AsyncSession, sk_movie_review_id: str) -> None:
    sk_movie_id = await repository.delete_review(session, sk_movie_review_id)
    if sk_movie_id is None:
        raise ReviewNotFoundError(sk_movie_review_id)
    await repository.recalculate_summary(session, sk_movie_id)
    await session.commit()
    response_cache.clear()
