"""Endpoints HTTP das avaliações de filmes."""

from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import DEFAULT_PAGE_SIZE, DbSession, PageParam, PageSizeParam, SkPathId
from app.movies.schemas import Page
from app.movies.service import MOVIE_NOT_FOUND, MovieNotFoundError
from app.reviews import service
from app.reviews.schemas import ReviewCreate, ReviewOut

router = APIRouter()

REVIEW_NOT_FOUND = "Avaliação não encontrada"

SkMovieId = SkPathId
SkMovieReviewId = SkPathId


def _movie_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MOVIE_NOT_FOUND)


@router.get("/movies/{sk_movie_id}/reviews", response_model=Page[ReviewOut])
async def list_reviews(
    sk_movie_id: SkMovieId,
    session: DbSession,
    page: PageParam = 1,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> Page[ReviewOut]:
    """Lista as avaliações do filme, da mais recente para a mais antiga."""

    try:
        return await service.list_reviews(session, sk_movie_id, page, page_size)
    except MovieNotFoundError as exc:
        raise _movie_not_found() from exc


@router.post(
    "/movies/{sk_movie_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    sk_movie_id: SkMovieId, payload: ReviewCreate, session: DbSession
) -> ReviewOut:
    """Registra uma avaliação e recalcula o resumo do filme na mesma transação."""

    try:
        return await service.create_review(session, sk_movie_id, payload)
    except MovieNotFoundError as exc:
        raise _movie_not_found() from exc


@router.delete("/reviews/{sk_movie_review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(sk_movie_review_id: SkMovieReviewId, session: DbSession) -> Response:
    """Remove a avaliação e recalcula o resumo do filme na mesma transação."""

    try:
        await service.delete_review(session, sk_movie_review_id)
    except service.ReviewNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=REVIEW_NOT_FOUND) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
