"""Endpoints HTTP do domínio de filmes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.movies import service
from app.movies.schemas import (
    MovieCreate,
    MovieDetail,
    MovieFilters,
    MovieListItem,
    MovieOrder,
    MovieUpdate,
    Page,
)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
# Limites superiores mantêm OFFSET e ano dentro do INTEGER de 64 bits do SQLite.
MAX_PAGE = 10_000
MIN_ANO = 1800
MAX_ANO = 2200
SK_MAX_LENGTH = 64

router = APIRouter()

MOVIE_NOT_FOUND = "Filme não encontrado"

DbSession = Annotated[AsyncSession, Depends(get_db)]
SkMovieId = Annotated[str, Path(max_length=SK_MAX_LENGTH)]


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
async def get_movie(sk_movie_id: SkMovieId, session: DbSession) -> MovieDetail:
    """Retorna o detalhe completo de um filme."""

    try:
        return await service.get_movie(session, sk_movie_id)
    except service.MovieNotFoundError as exc:
        raise _not_found() from exc


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=MOVIE_NOT_FOUND)


def _conflict(exc: service.MovieConflictError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("", response_model=MovieDetail, status_code=status.HTTP_201_CREATED)
async def create_movie(payload: MovieCreate, session: DbSession) -> MovieDetail:
    """Cadastra um filme, reaproveitando diretores e gêneros existentes pelo nome."""

    try:
        return await service.create_movie(session, payload)
    except service.MovieConflictError as exc:
        raise _conflict(exc) from exc


@router.patch("/{sk_movie_id}", response_model=MovieDetail)
async def update_movie(
    sk_movie_id: SkMovieId, payload: MovieUpdate, session: DbSession
) -> MovieDetail:
    """Atualiza parcialmente um filme; listas enviadas substituem as atuais."""

    try:
        return await service.update_movie(session, sk_movie_id, payload)
    except service.MovieNotFoundError as exc:
        raise _not_found() from exc
    except service.MovieConflictError as exc:
        raise _conflict(exc) from exc
    except service.MovieValidationError as exc:
        # Mesmo formato de `detail` que o FastAPI usa nos erros de validação do corpo.
        detail = [{"loc": ["body", exc.campo], "msg": str(exc), "type": "value_error"}]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail
        ) from exc


@router.delete("/{sk_movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_movie(sk_movie_id: SkMovieId, session: DbSession) -> Response:
    """Remove o filme com avaliações, resumo, métricas e vínculos."""

    try:
        await service.delete_movie(session, sk_movie_id)
    except service.MovieNotFoundError as exc:
        raise _not_found() from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
