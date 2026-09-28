"""Schemas Pydantic de entrada e saída do domínio de filmes."""

from dataclasses import dataclass
from datetime import date
from typing import Annotated, Generic, Literal, Self, TypeVar

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    TypeAdapter,
    ValidationError,
    model_validator,
)

T = TypeVar("T")

MovieOrder = Literal["titulo", "ano", "nota"]

# Limites de escrita, alinhados ao tamanho das colunas em app/movies/models.py.
MIN_ANO_LANCAMENTO = 1888
MAX_ANO_LANCAMENTO = 2100
MAX_DURACAO_MINUTOS = 1000
MAX_NOMES_POR_LISTA = 20


def _dedupe_casefold(nomes: list[str]) -> list[str]:
    """Remove nomes repetidos (sem diferenciar caixa), preservando a primeira ocorrência."""

    vistos: set[str] = set()
    unicos: list[str] = []
    for nome in nomes:
        chave = nome.casefold()
        if chave not in vistos:
            vistos.add(chave)
            unicos.append(nome)
    return unicos


def _check_release_year(value: date) -> date:
    if not MIN_ANO_LANCAMENTO <= value.year <= MAX_ANO_LANCAMENTO:
        raise ValueError(
            f"ano da data de lançamento deve estar entre "
            f"{MIN_ANO_LANCAMENTO} e {MAX_ANO_LANCAMENTO}"
        )
    return value


def check_year_matches_date(ano: int | None, data: date | None) -> None:
    """Garante que ano_lancamento e data_lancamento, quando ambos existem, concordam."""

    if ano is not None and data is not None and ano != data.year:
        raise ValueError("ano_lancamento difere do ano de data_lancamento")


def _blank_to_none(value: object) -> object:
    """Texto vazio ou só com espaços vira NULL, como na carga dos CSVs."""

    if isinstance(value, str) and not value.strip():
        return None
    return value


_HTTP_URL = TypeAdapter(HttpUrl)


def _check_http_url(value: str) -> str:
    """Aceita só URLs http(s) absolutas; o texto original é mantido como enviado."""

    try:
        _HTTP_URL.validate_python(value)
    except ValidationError as exc:
        raise ValueError("url_poster deve ser uma URL http(s) absoluta") from exc
    return value


def _text(max_length: int, min_length: int = 0) -> StringConstraints:
    return StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)


Titulo = Annotated[str, _text(500, min_length=1)]
IdFilme = Annotated[str, _text(50, min_length=1)]
AnoLancamento = Annotated[int, Field(ge=MIN_ANO_LANCAMENTO, le=MAX_ANO_LANCAMENTO)]
DataLancamento = Annotated[date, AfterValidator(_check_release_year)]
DuracaoMinutos = Annotated[int, Field(ge=0, le=MAX_DURACAO_MINUTOS)]
# Textos opcionais: None quando vazios; o BeforeValidator roda antes de strip/limites.
StatusFilme = Annotated[Annotated[str, _text(50)] | None, BeforeValidator(_blank_to_none)]
Sinopse = Annotated[Annotated[str, _text(4000)] | None, BeforeValidator(_blank_to_none)]
UrlPoster = Annotated[
    Annotated[str, _text(2048), AfterValidator(_check_http_url)] | None,
    BeforeValidator(_blank_to_none),
]
Diretores = Annotated[
    list[Annotated[str, _text(255, min_length=1)]],
    Field(max_length=MAX_NOMES_POR_LISTA),
    AfterValidator(_dedupe_casefold),
]
Generos = Annotated[
    list[Annotated[str, _text(50, min_length=1)]],
    Field(max_length=MAX_NOMES_POR_LISTA),
    AfterValidator(_dedupe_casefold),
]

# Campos que, se enviados no PATCH, não podem ser nulos.
NON_NULLABLE_UPDATE_FIELDS = ("titulo", "id_filme", "diretores", "generos")


class MovieCreate(BaseModel):
    """Payload de criação de filme."""

    model_config = ConfigDict(extra="forbid")

    titulo: Titulo
    id_filme: IdFilme | None = None
    ano_lancamento: AnoLancamento | None = None
    data_lancamento: DataLancamento | None = None
    sinopse: Sinopse = None
    duracao_minutos: DuracaoMinutos | None = None
    status_filme: StatusFilme = None
    url_poster: UrlPoster = None
    diretores: Diretores = []
    generos: Generos = []

    @model_validator(mode="after")
    def _sync_year_with_date(self) -> Self:
        check_year_matches_date(self.ano_lancamento, self.data_lancamento)
        if self.ano_lancamento is None and self.data_lancamento is not None:
            self.ano_lancamento = self.data_lancamento.year
        return self


class MovieUpdate(BaseModel):
    """Payload de atualização parcial; só os campos enviados são aplicados."""

    model_config = ConfigDict(extra="forbid")

    titulo: Titulo | None = None
    id_filme: IdFilme | None = None
    ano_lancamento: AnoLancamento | None = None
    data_lancamento: DataLancamento | None = None
    sinopse: Sinopse = None
    duracao_minutos: DuracaoMinutos | None = None
    status_filme: StatusFilme = None
    url_poster: UrlPoster = None
    diretores: Diretores | None = None
    generos: Generos | None = None

    @model_validator(mode="after")
    def _reject_null_required(self) -> Self:
        nulos = [
            campo
            for campo in NON_NULLABLE_UPDATE_FIELDS
            if campo in self.model_fields_set and getattr(self, campo) is None
        ]
        if nulos:
            raise ValueError(f"campos não aceitam null: {', '.join(nulos)}")
        check_year_matches_date(self.ano_lancamento, self.data_lancamento)
        return self


@dataclass(frozen=True)
class MovieFilters:
    """Critérios opcionais da listagem de filmes."""

    q: str | None = None
    genero: str | None = None
    ano: int | None = None
    ordem: MovieOrder = "titulo"


class Page(BaseModel, Generic[T]):
    """Envelope padrão de respostas paginadas."""

    items: list[T]
    total: int
    page: int
    page_size: int


class MovieListItem(BaseModel):
    sk_movie_id: str
    titulo: str
    ano_lancamento: int | None
    url_poster: str | None
    generos: list[str]
    nota_media: float | None
    qtd_avaliacoes: int


class PerformanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    orcamento_usd: float | None
    receita_usd: float | None
    lucro_usd: float | None
    orcamento_brl: float | None
    receita_brl: float | None
    lucro_brl: float | None
    popularidade: float | None
    nota_tmdb: float | None
    qtd_tmdb: int | None
    nota_imdb: float | None
    qtd_imdb: int | None


class ReviewSummaryOut(BaseModel):
    nota_media: float | None
    qtd_avaliacoes: int


class PessoaRef(BaseModel):
    """Pessoa citada no detalhe do filme, com a chave para navegar até ela."""

    sk_person_id: str
    nome: str


class Creditos(BaseModel):
    diretores: list[PessoaRef]
    atores: list[PessoaRef]
    roteiristas: list[PessoaRef]


class MovieDetail(BaseModel):
    sk_movie_id: str
    id_filme: str
    titulo: str
    data_lancamento: date | None
    ano_lancamento: int | None
    duracao_minutos: int | None
    status_filme: str | None
    sinopse: str | None
    url_poster: str | None
    url_backdrop: str | None
    generos: list[str]
    diretores: list[str]
    atores: list[str]
    roteiristas: list[str]
    produtoras: list[str]
    # Mesmas pessoas das listas de nomes acima, com sk_person_id (links no frontend).
    creditos: Creditos
    performance: PerformanceOut | None
    avaliacoes: ReviewSummaryOut
