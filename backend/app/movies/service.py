"""Regras de negócio e mapeamento ORM → schemas do domínio de filmes."""

from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import response_cache
from app.movies import repository
from app.movies.models import DimMovie, DimReview, PersonType, generate_surrogate_key
from app.movies.schemas import (
    Creditos,
    MovieCreate,
    MovieDetail,
    MovieFilters,
    MovieListItem,
    MovieUpdate,
    Page,
    PerformanceOut,
    PessoaRef,
    ReviewSummaryOut,
    check_year_matches_date,
)

MAX_ATORES_DETALHE = 10
# Prefixo dos id_filme gerados pela API; não colide com os ids numéricos do TMDB.
LOCAL_ID_PREFIX = "local-"
SCALAR_FIELDS = (
    "titulo",
    "ano_lancamento",
    "data_lancamento",
    "sinopse",
    "duracao_minutos",
    "status_filme",
    "url_poster",
)
# Ano e data são tratados em _apply_release_fields para manter a consistência entre eles.
UPDATABLE_FIELDS = (frozenset(SCALAR_FIELDS) - {"ano_lancamento", "data_lancamento"}) | {"id_filme"}


MOVIE_NOT_FOUND = "Filme não encontrado"


class MovieNotFoundError(Exception):
    """Filme inexistente para o identificador informado."""


class MovieConflictError(Exception):
    """Escrita violaria uma restrição de unicidade (ex.: id_filme repetido)."""


class MovieValidationError(Exception):
    """Dados válidos isoladamente, mas inconsistentes com o estado salvo do filme."""

    def __init__(self, campo: str, mensagem: str) -> None:
        super().__init__(mensagem)
        self.campo = campo


def _review_summary(summary: DimReview | None) -> ReviewSummaryOut:
    if summary is None:
        return ReviewSummaryOut(nota_media=None, qtd_avaliacoes=0)
    return ReviewSummaryOut(
        nota_media=summary.nota_media_usuarios,
        qtd_avaliacoes=summary.qtd_avaliacoes_usuarios,
    )


def _people_refs(movie: DimMovie, tipo: PersonType, limit: int | None = None) -> list[PessoaRef]:
    pessoas = sorted(
        (p for p in movie.people if p.tipo_pessoa == tipo),
        key=lambda p: (p.nome_pessoa, p.sk_person_id),
    )
    return [PessoaRef(sk_person_id=p.sk_person_id, nome=p.nome_pessoa) for p in pessoas[:limit]]


def _names(refs: list[PessoaRef]) -> list[str]:
    return [ref.nome for ref in refs]


def to_list_item(movie: DimMovie) -> MovieListItem:
    """Card de filme; exige gêneros e resumo de avaliações já carregados."""

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
    creditos = Creditos(
        diretores=_people_refs(movie, "Diretor"),
        atores=_people_refs(movie, "Ator", limit=MAX_ATORES_DETALHE),
        roteiristas=_people_refs(movie, "Roteirista"),
    )
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
        diretores=_names(creditos.diretores),
        atores=_names(creditos.atores),
        roteiristas=_names(creditos.roteiristas),
        produtoras=[company.nome_produtora for company in movie.companies],
        creditos=creditos,
        performance=PerformanceOut.model_validate(performance) if performance else None,
        avaliacoes=_review_summary(movie.reviews_summary),
    )


async def list_movies(
    session: AsyncSession, filters: MovieFilters, page: int, page_size: int
) -> Page[MovieListItem]:
    # Chave com os parâmetros já validados: "?page=1" e a URL sem query caem na mesma entrada.
    key = ("movies", filters, page, page_size)
    return await response_cache.get_or_load(
        key, lambda: _load_movies(session, filters, page, page_size)
    )


async def _load_movies(
    session: AsyncSession, filters: MovieFilters, page: int, page_size: int
) -> Page[MovieListItem]:
    movies, total = await repository.list_movies(
        session, filters, offset=(page - 1) * page_size, limit=page_size
    )
    return Page[MovieListItem](
        items=[to_list_item(movie) for movie in movies],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_movie(session: AsyncSession, sk_movie_id: str) -> MovieDetail:
    movie = await repository.get_movie(session, sk_movie_id)
    if movie is None:
        raise MovieNotFoundError(sk_movie_id)
    return _to_detail(movie)


def _generate_id_filme() -> str:
    return f"{LOCAL_ID_PREFIX}{uuid4().hex}"


async def _ensure_unique_id_filme(
    session: AsyncSession, id_filme: str, sk_movie_id: str | None = None
) -> None:
    if await repository.id_filme_exists(session, id_filme, exclude_sk_movie_id=sk_movie_id):
        raise MovieConflictError(f"id_filme '{id_filme}' já cadastrado")


async def _commit_and_reload(session: AsyncSession, sk_movie_id: str) -> MovieDetail:
    try:
        # O flush grava filme e créditos antes de o índice FTS lê-los na mesma transação.
        await session.flush()
        await repository.sync_search_index(session, sk_movie_id)
        await session.commit()
    except IntegrityError as exc:
        # Rede de segurança para escritas concorrentes que passaram pelas checagens prévias.
        await session.rollback()
        raise MovieConflictError("conflito de unicidade ao salvar o filme") from exc
    response_cache.clear()
    movie = await repository.get_movie(session, sk_movie_id, refresh=True)
    if movie is None:
        raise MovieNotFoundError(sk_movie_id)
    return _to_detail(movie)


async def create_movie(session: AsyncSession, payload: MovieCreate) -> MovieDetail:
    id_filme = payload.id_filme or _generate_id_filme()
    await _ensure_unique_id_filme(session, id_filme)

    # Chave gerada aqui (e não no flush) para que todo erro de gravação passe pelo
    # tratamento de IntegrityError em _commit_and_reload.
    movie = DimMovie(
        **payload.model_dump(include=set(SCALAR_FIELDS)),
        sk_movie_id=generate_surrogate_key(),
        id_filme=id_filme,
        genres=await repository.resolve_genres(session, payload.generos),
        people=await repository.resolve_directors(session, payload.diretores),
    )
    session.add(movie)
    return await _commit_and_reload(session, movie.sk_movie_id)


def _apply_release_fields(movie: DimMovie, payload: MovieUpdate) -> None:
    enviados = payload.model_fields_set
    if "data_lancamento" in enviados:
        movie.data_lancamento = payload.data_lancamento
        if "ano_lancamento" not in enviados and payload.data_lancamento is not None:
            movie.ano_lancamento = payload.data_lancamento.year
    if "ano_lancamento" in enviados:
        movie.ano_lancamento = payload.ano_lancamento
    try:
        check_year_matches_date(movie.ano_lancamento, movie.data_lancamento)
    except ValueError as exc:
        raise MovieValidationError("ano_lancamento", str(exc)) from exc


async def _replace_directors(session: AsyncSession, movie: DimMovie, nomes: list[str]) -> None:
    """Troca só os diretores; atores e roteiristas do filme são preservados."""

    outros = [p for p in movie.people if p.tipo_pessoa != repository.DIRETOR]
    movie.people = [*outros, *await repository.resolve_directors(session, nomes)]


async def update_movie(
    session: AsyncSession, sk_movie_id: str, payload: MovieUpdate
) -> MovieDetail:
    movie = await repository.get_movie(session, sk_movie_id)
    if movie is None:
        raise MovieNotFoundError(sk_movie_id)

    if payload.id_filme is not None and payload.id_filme != movie.id_filme:
        await _ensure_unique_id_filme(session, payload.id_filme, sk_movie_id)
    for campo in payload.model_fields_set & UPDATABLE_FIELDS:
        setattr(movie, campo, getattr(payload, campo))
    _apply_release_fields(movie, payload)
    if payload.generos is not None:
        movie.genres = await repository.resolve_genres(session, payload.generos)
    if payload.diretores is not None:
        await _replace_directors(session, movie, payload.diretores)
    return await _commit_and_reload(session, sk_movie_id)


async def delete_movie(session: AsyncSession, sk_movie_id: str) -> None:
    if not await repository.delete_movie(session, sk_movie_id):
        raise MovieNotFoundError(sk_movie_id)
    await session.commit()
    response_cache.clear()
