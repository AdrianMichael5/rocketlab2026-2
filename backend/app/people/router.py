"""Endpoints HTTP do domínio de pessoas."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DEFAULT_PAGE_SIZE, DbSession, PageParam, PageSizeParam, SkPathId
from app.people import service
from app.people.schemas import PersonDetail

router = APIRouter()


@router.get("/{sk_person_id}", response_model=PersonDetail)
async def get_person(
    sk_person_id: SkPathId,
    session: DbSession,
    page: PageParam = 1,
    page_size: PageSizeParam = DEFAULT_PAGE_SIZE,
) -> PersonDetail:
    """Retorna a pessoa e os filmes dela paginados, do mais recente ao mais antigo."""

    try:
        return await service.get_person(session, sk_person_id, page, page_size)
    except service.PersonNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=service.PERSON_NOT_FOUND
        ) from exc
