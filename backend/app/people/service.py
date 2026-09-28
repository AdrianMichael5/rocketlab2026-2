"""Regras e mapeamento ORM → schemas do domínio de pessoas."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.movies.schemas import MovieListItem, Page
from app.movies.service import to_list_item
from app.people import repository
from app.people.schemas import PersonDetail

PERSON_NOT_FOUND = "Pessoa não encontrada"


class PersonNotFoundError(Exception):
    """Pessoa inexistente para o identificador informado."""


async def get_person(
    session: AsyncSession, sk_person_id: str, page: int, page_size: int
) -> PersonDetail:
    person = await repository.get_person(session, sk_person_id)
    if person is None:
        raise PersonNotFoundError(sk_person_id)

    movies, total = await repository.list_person_movies(
        session, sk_person_id, offset=(page - 1) * page_size, limit=page_size
    )
    return PersonDetail(
        sk_person_id=person.sk_person_id,
        nome=person.nome_pessoa,
        tipo=person.tipo_pessoa,
        filmes=Page[MovieListItem](
            items=[to_list_item(movie) for movie in movies],
            total=total,
            page=page,
            page_size=page_size,
        ),
    )
