"""Schemas Pydantic de entrada e saída das avaliações de filmes."""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

# Limites alinhados às colunas de movie_reviews e à CHECK nota_range.
MAX_NOME = 120
MAX_COMENTARIO = 4000
MIN_NOTA = 0
MAX_NOTA = 10
# Meia estrela no frontend: nota = estrelas × 2, logo passos de 0.5.
PASSO_NOTA = 0.5
# Casas decimais da média em dim_reviews (API e seed).
CASAS_MEDIA = 2


def _as_utc(value: datetime) -> datetime:
    """created_at vem do CURRENT_TIMESTAMP do SQLite: UTC, mas sem fuso gravado."""

    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_NOME)]
Comentario = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_COMENTARIO)
]
# strict: só números; recusa true/false e "7.5" em vez de convertê-los.
Nota = Annotated[float, Field(ge=MIN_NOTA, le=MAX_NOTA, multiple_of=PASSO_NOTA, strict=True)]
DataUtc = Annotated[datetime, AfterValidator(_as_utc)]


class ReviewCreate(BaseModel):
    """Payload de criação de avaliação."""

    model_config = ConfigDict(extra="forbid")

    nome: Nome
    nota: Nota
    comentario: Comentario


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_movie_review_id: str
    sk_movie_id: str
    nome: str
    nota: float
    comentario: str
    created_at: DataUtc
