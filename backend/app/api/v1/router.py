from fastapi import APIRouter

from app.genres.router import router as genres_router
from app.movies.router import router as movies_router
from app.reviews.router import router as reviews_router

api_router = APIRouter()

api_router.include_router(movies_router, prefix="/movies", tags=["movies"])
api_router.include_router(genres_router, prefix="/genres", tags=["genres"])
# Sem prefixo: expõe /movies/{sk_movie_id}/reviews e /reviews/{sk_movie_review_id}.
api_router.include_router(reviews_router, tags=["reviews"])
