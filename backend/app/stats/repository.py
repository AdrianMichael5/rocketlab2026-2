"""Consultas agregadas do domínio de estatísticas.

Toda agregação (COUNT, AVG, SUM, GROUP BY, ORDER BY/LIMIT) acontece no SQL;
o Python só recebe as linhas prontas.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.movies.models import (
    DimGenre,
    DimMovie,
    DimReview,
    FactMoviePerformance,
    MovieReview,
    bridge_movie_genre,
)

TOP_N = 10
MIN_AVALIACOES_RANKING = 3
CASAS_DECIMAIS = 1


def _media(expr: Any) -> Any:
    return func.round(expr, CASAS_DECIMAIS)


def _nota_externa(coluna: Any) -> Any:
    """nota_imdb/nota_tmdb = 0 no CSV significa "sem votos"; NULLIF tira da média."""

    return _media(func.avg(func.nullif(coluna, 0)))


async def get_resumo(session: AsyncSession) -> Row[Any]:
    stmt = select(
        select(func.count()).select_from(DimMovie).scalar_subquery().label("total_filmes"),
        select(func.count()).select_from(MovieReview).scalar_subquery().label("total_avaliacoes"),
        select(_media(func.avg(MovieReview.nota))).scalar_subquery().label("media_geral"),
    )
    return (await session.execute(stmt)).one()


async def list_top_avaliados(session: AsyncSession) -> Sequence[Row[Any]]:
    stmt = (
        select(
            DimMovie.sk_movie_id,
            DimMovie.titulo,
            DimMovie.ano_lancamento,
            DimMovie.url_poster,
            DimReview.nota_media_usuarios.label("nota_media"),
            DimReview.qtd_avaliacoes_usuarios.label("qtd_avaliacoes"),
        )
        .join(DimReview, DimReview.sk_movie_id == DimMovie.sk_movie_id)
        .where(DimReview.qtd_avaliacoes_usuarios >= MIN_AVALIACOES_RANKING)
        .order_by(
            DimReview.nota_media_usuarios.desc(),
            DimReview.qtd_avaliacoes_usuarios.desc(),
            DimMovie.titulo.collate("NOCASE"),
            DimMovie.sk_movie_id,
        )
        .limit(TOP_N)
    )
    return (await session.execute(stmt)).all()


async def list_top_lucro(session: AsyncSession) -> Sequence[Row[Any]]:
    # Sem orçamento ou sem receita o lucro do CSV é só a receita (ou −orçamento).
    stmt = (
        select(
            DimMovie.sk_movie_id,
            DimMovie.titulo,
            DimMovie.ano_lancamento,
            DimMovie.url_poster,
            FactMoviePerformance.lucro_usd,
        )
        .join(FactMoviePerformance, FactMoviePerformance.sk_movie_id == DimMovie.sk_movie_id)
        .where(
            FactMoviePerformance.orcamento_usd.is_not(None),
            FactMoviePerformance.receita_usd.is_not(None),
        )
        .order_by(
            FactMoviePerformance.lucro_usd.desc(),
            DimMovie.titulo.collate("NOCASE"),
            DimMovie.sk_movie_id,
        )
        .limit(TOP_N)
    )
    return (await session.execute(stmt)).all()


async def list_generos(session: AsyncSession) -> Sequence[Row[Any]]:
    """Médias por gênero só sobre filmes com avaliação de usuário.

    Assim usuários, IMDb e TMDB são comparados no mesmo conjunto de filmes.
    A média dos usuários é ponderada por avaliação (soma das notas / quantidade).
    """

    avaliacoes = (
        select(
            MovieReview.sk_movie_id,
            func.sum(MovieReview.nota).label("soma"),
            func.count().label("qtd"),
        )
        .group_by(MovieReview.sk_movie_id)
        .subquery()
    )
    media_usuarios = _media(func.sum(avaliacoes.c.soma) / func.sum(avaliacoes.c.qtd))
    stmt = (
        select(
            DimGenre.nome_genero.label("genero"),
            func.count().label("qtd_filmes_avaliados"),
            func.sum(avaliacoes.c.qtd).label("qtd_avaliacoes"),
            media_usuarios.label("media_usuarios"),
            _nota_externa(FactMoviePerformance.nota_imdb).label("media_imdb"),
            _nota_externa(FactMoviePerformance.nota_tmdb).label("media_tmdb"),
        )
        .select_from(bridge_movie_genre)
        .join(DimGenre, DimGenre.sk_genre_id == bridge_movie_genre.c.sk_genre_id)
        .join(avaliacoes, avaliacoes.c.sk_movie_id == bridge_movie_genre.c.sk_movie_id)
        .outerjoin(
            FactMoviePerformance,
            FactMoviePerformance.sk_movie_id == bridge_movie_genre.c.sk_movie_id,
        )
        .group_by(DimGenre.sk_genre_id, DimGenre.nome_genero)
        .order_by(media_usuarios.desc(), DimGenre.nome_genero.collate("NOCASE"))
    )
    return (await session.execute(stmt)).all()


async def list_filmes_por_ano(session: AsyncSession) -> Sequence[Row[Any]]:
    stmt = (
        select(DimMovie.ano_lancamento.label("ano"), func.count().label("qtd_filmes"))
        .where(DimMovie.ano_lancamento.is_not(None))
        .group_by(DimMovie.ano_lancamento)
        .order_by(DimMovie.ano_lancamento)
    )
    return (await session.execute(stmt)).all()
