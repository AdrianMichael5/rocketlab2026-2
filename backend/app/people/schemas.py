"""Schemas de saída do domínio de pessoas."""

from pydantic import BaseModel

from app.movies.models import PersonType
from app.movies.schemas import MovieListItem, Page


class PersonDetail(BaseModel):
    sk_person_id: str
    nome: str
    tipo: PersonType
    filmes: Page[MovieListItem]
