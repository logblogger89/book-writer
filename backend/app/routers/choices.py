import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import ChoiceStatus, PendingChoice, Phase, PhaseStatus, Project
from app.models.schemas import ChoiceResolve, ChoiceResponse
from app.ws import event_types as ev
from app.ws.connection_manager import manager as ws_manager

router = APIRouter(prefix="/api/projects/{project_id}/choices", tags=["choices"])


@router.get("", response_model=list[ChoiceResponse])
async def list_choices(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingChoice)
        .where(PendingChoice.project_id == project_id)
        .order_by(PendingChoice.created_at.desc())
    )
    return result.scalars().all()


@router.get("/pending", response_model=ChoiceResponse | None)
async def get_pending_choice(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingChoice)
        .where(PendingChoice.project_id == project_id)
        .where(PendingChoice.status == ChoiceStatus.pending)
        .order_by(PendingChoice.created_at.desc())
    )
    return result.scalars().first()


@router.post("/{choice_id}/resolve", response_model=ChoiceResponse)
async def resolve_choice(
    project_id: str,
    choice_id: str,
    body: ChoiceResolve,
    db: AsyncSession = Depends(get_db),
):
    choice = await db.get(PendingChoice, choice_id)
    if not choice or choice.project_id != project_id:
        raise HTTPException(404, "Choice not found")
    if choice.status == ChoiceStatus.resolved:
        raise HTTPException(400, "Choice already resolved")

    if body.custom_text:
        choice.chosen_option_id = None
        choice.chosen_custom_text = body.custom_text
    elif body.chosen_option_id:
        # Validate option exists
        valid_ids = [opt["id"] for opt in choice.options_json]
        if body.chosen_option_id not in valid_ids:
            raise HTTPException(400, f"Invalid option id: {body.chosen_option_id}")
        choice.chosen_option_id = body.chosen_option_id
    else:
        raise HTTPException(400, "Must provide chosen_option_id or custom_text")

    choice.status = ChoiceStatus.resolved
    await db.commit()
    await db.refresh(choice)

    await ws_manager.broadcast(
        project_id,
        ev.choice_consumed(project_id, choice.phase_key, choice_id, choice.chosen_option_id),
    )

    return choice


@router.post("/create")
async def create_choice(
    project_id: str,
    phase_key: str,
    options: list[dict],
    db: AsyncSession = Depends(get_db),
):
    """Called by the orchestrator to create a choice for the user."""
    choice = PendingChoice(
        id=str(uuid.uuid4()),
        project_id=project_id,
        phase_key=phase_key,
        options_json=options,
        status=ChoiceStatus.pending,
    )
    db.add(choice)
    await db.commit()
    await db.refresh(choice)

    await ws_manager.broadcast(
        project_id,
        ev.choice_ready(project_id, phase_key, choice.id, options),
    )
    return choice
