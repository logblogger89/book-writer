import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import Phase, PhaseStatus, Project, ProjectStatus
from app.models.schemas import AutoPilotToggle, PhaseResponse, RollbackRequest
from app.pipeline import orchestrator
from app.pipeline.phase_graph import PHASE_ORDER
from app.pipeline.rollback_manager import rollback_to_phase
from app.services.artifact_service import get_all_active_artifacts
from app.models.schemas import ArtifactResponse

router = APIRouter(prefix="/api/projects/{project_id}", tags=["pipeline"])


@router.post("/start")
async def start_pipeline(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Block if a live task is actively running
    if project.status == ProjectStatus.running and orchestrator.is_active(project_id):
        raise HTTPException(400, "Pipeline already running")

    # If a live task is paused, just resume it — no new task needed
    if project.status == ProjectStatus.paused and orchestrator.is_active(project_id):
        orchestrator.resume_pipeline(project_id)
        return {"status": "resumed"}

    # For idle, paused-after-restart, or error: find first non-complete phase
    start_from = None
    if project.status not in (ProjectStatus.idle,):
        phases_result = await db.execute(
            select(Phase).where(Phase.project_id == project_id)
        )
        phases_map = {p.phase_key: p for p in phases_result.scalars().all()}
        for pk in PHASE_ORDER:
            p = phases_map.get(pk)
            if p and p.status != PhaseStatus.complete:
                start_from = pk
                break

    background_tasks.add_task(orchestrator.run_pipeline, project_id, start_from=start_from)
    return {"status": "started"}


@router.post("/pause")
async def pause_pipeline(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    orchestrator.pause_pipeline(project_id)
    return {"status": "paused"}


@router.post("/resume")
async def resume_pipeline(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    orchestrator.resume_pipeline(project_id)
    return {"status": "resumed"}


@router.post("/rollback")
async def rollback(
    project_id: str,
    body: RollbackRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if body.to_phase_key not in PHASE_ORDER:
        raise HTTPException(400, f"Unknown phase: {body.to_phase_key}")

    # Stop any running pipeline first
    orchestrator.stop_pipeline(project_id)
    await asyncio.sleep(0.5)  # give background task time to notice stop

    rollback_context = await rollback_to_phase(db, project, body.to_phase_key, body.new_context)

    # Restart pipeline from rolled-back phase
    background_tasks.add_task(
        orchestrator.run_pipeline,
        project_id,
        start_from=body.to_phase_key,
        rollback_context=rollback_context,
    )
    return {"status": "rolling_back", "to_phase": body.to_phase_key}


@router.post("/auto-pilot")
async def toggle_auto_pilot(
    project_id: str,
    body: AutoPilotToggle,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    project.auto_pilot = body.enabled
    await db.commit()
    return {"auto_pilot": project.auto_pilot}


@router.get("/phases", response_model=list[PhaseResponse])
async def get_phases(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project_id)
        .order_by(Phase.id)
    )
    return result.scalars().all()


@router.get("/artifacts")
async def get_artifacts(project_id: str, db: AsyncSession = Depends(get_db)):
    artifacts = await get_all_active_artifacts(db, project_id)
    return {k: {"id": v.id, "type": v.artifact_type, "version": v.version, "content": v.content_json}
            for k, v in artifacts.items()}
