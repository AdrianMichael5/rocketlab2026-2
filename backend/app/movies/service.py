"""Regras de negócio e mapeamento ORM → schemas do domínio de filmes."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.movies import repository
from app.movies.models import DimMovie, DimReview, PersonType
from app.movies.schemas import (
    MovieDetail,
    MovieFilters,
    MovieListItem,
    Page,
    PerformanceOut,
    ReviewSummaryOut,
)

MAX_ATORES_DETALHE = 10


class MovieNotFoundError(Exception):
    """Filme inexistente para o identificador informado."""


def _review_summary(summary: DimReview | None) -> ReviewSummaryOut:
    if summary is None:
        return ReviewSummaryOut(nota_media=None, qtd_avaliacoes=0)
    return ReviewSummaryOut(
        nota_media=summary.nota_media_usuarios,
        qtd_avaliacoes=summary.qtd_avaliacoes_usuarios,
    )


def _people_names(movie: DimMovie, tipo: PersonType) -> list[str]:
    return sorted(p.nome_pessoa for p in movie.people if p.tipo_pessoa == tipo)


def _to_list_item(movie: DimMovie) -> MovieListItem:
    summary = _review_summary(movie.reviews_summary)
    return MovieListItem(
        sk_movie_id=movie.sk_movie_id,
        titulo=movie.titulo,
        ano_lancamento=movie.ano_lancamento,
        url_poster=movie.url_poster,
        generos=[genre.nome_genero for genre in movie.genres],
        nota_media=summary.nota_media,
        qtd_avaliacoes=summary.qtd_avaliacoes,
    )


def _to_detail(movie: DimMovie) -> MovieDetail:
    performance = movie.performance
    return MovieDetail(
        sk_movie_id=movie.sk_movie_id,
        id_filme=movie.id_filme,
        titulo=movie.titulo,
        data_lancamento=movie.data_lancamento,
        ano_lancamento=movie.ano_lancamento,
        duracao_minutos=movie.duracao_minutos,
        status_filme=movie.status_filme,
        sinopse=movie.sinopse,
        url_poster=movie.url_poster,
        url_backdrop=movie.url_backdrop,
        generos=[genre.nome_genero for genre in movie.genres],
        diretores=_people_names(movie, "Diretor"),
        atores=_people_names(movie, "Ator")[:MAX_ATORES_DETALHE],
        roteiristas=_people_names(movie, "Roteirista"),
        produtoras=[company.nome_produtora for company in movie.companies],
        performance=PerformanceOut.model_validate(performance) if performance else None,
        avaliacoes=_review_summary(movie.reviews_summary),
    )


async def list_movies(
    session: AsyncSession, filters: MovieFilters, page: int, page_size: int
) -> Page[MovieListItem]:
    movies, total = await repository.list_movies(
        session, filters, offset=(page - 1) * page_size, limit=page_size
    )
    return Page[MovieListItem](
        items=[_to_list_item(movie) for movie in movies],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_movie(session: AsyncSession, sk_movie_id: str) -> MovieDetail:
    movie = await repository.get_movie(session, sk_movie_id)
    if movie is None:
        raise MovieNotFoundError(sk_movie_id)
    return _to_detail(movie)
