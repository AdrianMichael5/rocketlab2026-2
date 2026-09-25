"""Acesso a dados do domínio de filmes."""

from typing import Any

from sqlalchemy import ColumnElement, Select, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, selectinload

from app.movies.models import DimGenre, DimMovie, DimReview, bridge_movie_genre
from app.movies.schemas import MovieFilters, MovieOrder


def _apply_filters(stmt: Select, filters: MovieFilters) -> Select:
    if filters.q:
        stmt = stmt.where(func.lower(DimMovie.titulo).contains(filters.q.lower(), autoescape=True))
    if filters.ano is not None:
        stmt = stmt.where(DimMovie.ano_lancamento == filters.ano)
    if filters.genero:
        # EXISTS evita duplicar filmes com vários gêneros e mantém o total correto.
        stmt = stmt.where(
            exists()
            .where(bridge_movie_genre.c.sk_movie_id == DimMovie.sk_movie_id)
            .where(bridge_movie_genre.c.sk_genre_id == DimGenre.sk_genre_id)
            .where(func.lower(DimGenre.nome_genero) == filters.genero.lower())
        )
    return stmt


def _order_by(ordem: MovieOrder) -> tuple[ColumnElement[Any], ...]:
    criteria: tuple[ColumnElement[Any], ...]
    if ordem == "ano":
        criteria = (DimMovie.ano_lancamento.desc().nulls_last(),)
    elif ordem == "nota":
        criteria = (
            DimReview.nota_media_usuarios.desc().nulls_last(),
            DimReview.qtd_avaliacoes_usuarios.desc().nulls_last(),
        )
    else:
        # NOCASE evita que a collation binária jogue títulos minúsculos para o fim e
        # casa com o índice ix_dim_movies_titulo_nocase (titulo NOCASE, sk_movie_id).
        criteria = (DimMovie.titulo.collate("NOCASE"),)
    # Desempate estável para que a paginação não repita nem pule filmes.
    return (*criteria, DimMovie.sk_movie_id)


async def list_movies(
    session: AsyncSession, filters: MovieFilters, offset: int, limit: int
) -> tuple[list[DimMovie], int]:
    """Retorna uma página de filmes com gêneros e resumo de avaliações carregados."""

    count_stmt = _apply_filters(select(func.count()).select_from(DimMovie), filters)
    total = (await session.execute(count_stmt)).scalar_one()
    if offset >= total:
        # Página além do fim: evita ordenar e percorrer o catálogo inteiro à toa.
        return [], total

    page_stmt = (
        _apply_filters(select(DimMovie).outerjoin(DimMovie.reviews_summary), filters)
        .options(contains_eager(DimMovie.reviews_summary), selectinload(DimMovie.genres))
        .order_by(*_order_by(filters.ordem))
        .offset(offset)
        .limit(limit)
    )
    movies = (await session.scalars(page_stmt)).all()
    return list(movies), total


async def get_movie(session: AsyncSession, sk_movie_id: str) -> DimMovie | None:
    """Busca um filme com todas as relações exibidas no detalhe."""

    stmt = (
        select(DimMovie)
        .where(DimMovie.sk_movie_id == sk_movie_id)
        .options(
            selectinload(DimMovie.genres),
            selectinload(DimMovie.companies),
            selectinload(DimMovie.people),
            selectinload(DimMovie.performance),
            selectinload(DimMovie.reviews_summary),
        )
    )
    return (await session.scalars(stmt)).one_or_none()
