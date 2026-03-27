from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import Phase, PhaseStatus, Project
from datetime import datetime

from app.models.schemas import ModelConfigUpdate, ProjectCreate, ProjectResponse, ProjectUpdate
from app.pipeline.phase_graph import PHASE_ORDER

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(title=body.title, initial_premise=body.initial_premise)
    db.add(project)
    await db.flush()

    # Pre-create all phase rows in pending state
    for phase_key in PHASE_ORDER:
        db.add(Phase(project_id=project.id, phase_key=phase_key))

    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.title = body.title.strip()
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.get("/{project_id}/model-config")
async def get_model_config(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.agent_model_config or {}


@router.patch("/{project_id}/model-config")
async def update_model_config(
    project_id: str,
    body: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    current = dict(project.agent_model_config or {})
    current[body.phase_key] = {"provider": body.provider, "model": body.model}
    project.agent_model_config = current
    await db.commit()
    return current
