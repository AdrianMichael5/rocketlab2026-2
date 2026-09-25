"""Schemas Pydantic de entrada e saída do domínio de filmes."""

from dataclasses import dataclass
from datetime import date
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")

MovieOrder = Literal["titulo", "ano", "nota"]


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
    performance: PerformanceOut | None
    avaliacoes: ReviewSummaryOut
