import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import anthropic_client, gemini_client
from app.database import get_db
from app.models.db_models import Artifact, Phase, PhaseStatus, Project
from datetime import datetime

from app.models.schemas import ModelConfigUpdate, ProjectCreate, ProjectResponse, ProjectUpdate
from app.pipeline.phase_graph import PHASE_ORDER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/suggest-loglines")
async def suggest_loglines(
    sub_genre: str | None = Query(default=None),
    provider: str = Query(default="gemini"),
    model: str = Query(default="gemini-3.1-flash-lite-preview"),
):
    genre_line = f"Sub-genre: {sub_genre}." if sub_genre else "Pick any compelling sci-fi sub-genre."
    prompt = (
        f"You are a creative sci-fi writing assistant. {genre_line}\n"
        "Generate a novel title and exactly 3 logline options for a sci-fi novel.\n"
        "Each option must take a DISTINCT creative angle — different in tone, focus, or thematic emphasis.\n"
        "Do NOT name any characters — describe them by role or occupation only "
        "(e.g. 'a deep-sea archivist', 'a syndicate of mud-divers', 'the colony's last engineer').\n"
        "TITLES: Do NOT use 'The [Noun] of [Abstract Noun]s' formulas. "
        "Titles should be unexpected and specific.\n"
        "Push toward collective protagonists, institutional corruption, "
        "mundane professions in extraordinary situations, or non-human perspectives.\n\n"
        "Return valid JSON only — no markdown fences, no explanation:\n"
        '{\n'
        '  "options": [\n'
        '    {\n'
        '      "title": "novel title that fits this specific logline",\n'
        '      "logline": "1-2 sentence logline",\n'
        '      "thematic_pillars": ["pillar 1", "pillar 2", "pillar 3"],\n'
        '      "central_conflict": "core dramatic tension in one sentence",\n'
        '      "hook_elements": ["element 1", "element 2"],\n'
        '      "tone": "e.g. gritty and cerebral / hopeful and kinetic",\n'
        '      "comparable_titles": ["Comp Title (reason)","Comp Title 2 (reason)"]\n'
        '    }\n'
        '  ]\n'
        '}'
    )
    try:
        if provider == "anthropic":
            resp = await anthropic_client.messages.create(
                model=model, max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
        else:
            resp = await gemini_client.aio.models.generate_content(model=model, contents=prompt)
            text = resp.text.strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
    except Exception as e:
        logger.error(f"suggest_loglines error: {e}")
    return {"title": "", "options": []}


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    # Derive initial_premise from logline artifact if provided
    initial_premise = body.initial_premise
    if body.logline_artifact:
        initial_premise = body.logline_artifact.get("logline", "") or initial_premise

    project = Project(
        title=body.title,
        initial_premise=initial_premise,
        sub_genre=body.sub_genre,
        chapter_count=body.chapter_count,
    )
    db.add(project)
    await db.flush()

    # Pre-create all phase rows in pending state
    logline_phase = None
    for phase_key in PHASE_ORDER:
        phase = Phase(project_id=project.id, phase_key=phase_key)
        db.add(phase)
        if phase_key == "logline_creator":
            logline_phase = phase

    await db.flush()  # get phase IDs

    # Pre-save logline artifact and mark phase complete so pipeline skips it
    if body.logline_artifact and logline_phase:
        db.add(Artifact(
            phase_id=logline_phase.id,
            project_id=project.id,
            artifact_type="logline",
            content_json=body.logline_artifact,
        ))
        logline_phase.status = PhaseStatus.complete
        logline_phase.completed_at = datetime.utcnow()

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
