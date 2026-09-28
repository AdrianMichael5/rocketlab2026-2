"""Schemas Pydantic de saída do domínio de estatísticas."""

from pydantic import BaseModel, ConfigDict


class _RowOut(BaseModel):
    """Lido direto das linhas (Row) das consultas agregadas."""

    model_config = ConfigDict(from_attributes=True)


class ResumoOut(_RowOut):
    total_filmes: int
    total_avaliacoes: int
    media_geral: float | None


class RankedMovieOut(_RowOut):
    sk_movie_id: str
    titulo: str
    ano_lancamento: int | None
    url_poster: str | None


class TopAvaliadoOut(RankedMovieOut):
    nota_media: float
    qtd_avaliacoes: int


class TopLucroOut(RankedMovieOut):
    lucro_usd: float


class GeneroStatsOut(_RowOut):
    genero: str
    qtd_filmes_avaliados: int
    qtd_avaliacoes: int
    media_usuarios: float
    media_imdb: float | None
    media_tmdb: float | None


class AnoStatsOut(_RowOut):
    ano: int
    qtd_filmes: int


class StatsOut(BaseModel):
    resumo: ResumoOut
    top_avaliados: list[TopAvaliadoOut]
    top_lucro: list[TopLucroOut]
    generos: list[GeneroStatsOut]
    filmes_por_ano: list[AnoStatsOut]
