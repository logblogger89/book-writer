import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import gemini_client
from app.database import get_db
from app.models.db_models import Phase, PhaseStatus, Project
from datetime import datetime

from app.models.schemas import ModelConfigUpdate, ProjectCreate, ProjectResponse, ProjectUpdate
from app.pipeline.phase_graph import PHASE_ORDER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/suggest")
async def suggest_novel(sub_genre: str | None = Query(default=None)):
    genre_line = f"Sub-genre: {sub_genre}." if sub_genre else "Pick any compelling sci-fi sub-genre."
    prompt = (
        f"You are a creative sci-fi writing assistant. {genre_line}\n"
        "Generate a single compelling sci-fi novel title and a vivid 2–3 sentence premise.\n"
        "The premise should name the protagonist, their goal, the central conflict, and what is at stake.\n"
        "Return valid JSON only — no markdown fences, no explanation:\n"
        '{"title": "...", "premise": "..."}'
    )
    try:
        resp = await gemini_client.aio.models.generate_content(
            model="gemini-3.1-flash-lite-preview", contents=prompt
        )
        text = resp.text.strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
    except Exception as e:
        logger.error(f"suggest_novel error: {e}")
    return {"title": "", "premise": ""}


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(
        title=body.title,
        initial_premise=body.initial_premise,
        sub_genre=body.sub_genre,
        chapter_count=body.chapter_count,
    )
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
