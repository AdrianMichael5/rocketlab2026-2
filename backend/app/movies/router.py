"""Endpoints HTTP do domínio de filmes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.movies import service
from app.movies.schemas import MovieDetail, MovieFilters, MovieListItem, MovieOrder, Page

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
# Limites superiores mantêm OFFSET e ano dentro do INTEGER de 64 bits do SQLite.
MAX_PAGE = 10_000
MIN_ANO = 1800
MAX_ANO = 2200
SK_MAX_LENGTH = 64

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=Page[MovieListItem])
async def list_movies(
    session: DbSession,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    q: Annotated[str | None, Query(max_length=200, description="Trecho do título")] = None,
    genero: Annotated[str | None, Query(max_length=50)] = None,
    ano: Annotated[int | None, Query(ge=MIN_ANO, le=MAX_ANO)] = None,
    ordem: MovieOrder = "titulo",
) -> Page[MovieListItem]:
    """Lista filmes paginados com busca por título, filtros e ordenação."""

    filters = MovieFilters(q=q, genero=genero, ano=ano, ordem=ordem)
    return await service.list_movies(session, filters, page, page_size)


@router.get("/{sk_movie_id}", response_model=MovieDetail)
async def get_movie(
    sk_movie_id: Annotated[str, Path(max_length=SK_MAX_LENGTH)], session: DbSession
) -> MovieDetail:
    """Retorna o detalhe completo de um filme."""

    try:
        return await service.get_movie(session, sk_movie_id)
    except service.MovieNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Filme não encontrado"
        ) from exc
