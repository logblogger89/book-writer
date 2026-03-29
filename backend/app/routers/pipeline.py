import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import Artifact, Phase, PhaseStatus, Project, ProjectStatus
from app.models.schemas import ArtifactResponse, ArtifactUpdate, AutoPilotToggle, PhaseResponse, RollbackRequest
from app.pipeline import orchestrator
from app.pipeline.phase_graph import PHASE_ORDER
from app.pipeline.rollback_manager import rollback_to_phase
from app.services.artifact_service import get_all_active_artifacts

logger = logging.getLogger(__name__)

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


@router.patch("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    project_id: str,
    artifact_id: str,
    body: ArtifactUpdate,
    db: AsyncSession = Depends(get_db),
):
    artifact = await db.get(Artifact, artifact_id)
    if not artifact or artifact.project_id != project_id:
        raise HTTPException(404, "Artifact not found")
    artifact.content_json = body.content_json
    artifact.version = artifact.version + 1
    await db.commit()
    await db.refresh(artifact)
    return artifact


# ── Final Draft Review (on-demand) ───────────────────────────────────────────

@router.post("/review")
async def run_final_review(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger the final draft reviewer. Only available when pipeline is complete."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.status != ProjectStatus.complete:
        raise HTTPException(400, "Pipeline must be complete before running review")

    background_tasks.add_task(_run_review_task, project_id)
    return {"status": "review_started"}


async def _run_review_task(project_id: str):
    """Background task that runs the final draft reviewer agent."""
    from app.database import AsyncSessionLocal
    from app.pipeline.phase_runner import run_phase
    from app.ws import event_types as ev
    from app.ws.connection_manager import manager as ws_manager

    async with AsyncSessionLocal() as db:
        project = await db.get(Project, project_id)
        if not project:
            return

        # Get or create the phase record
        result = await db.execute(
            select(Phase)
            .where(Phase.project_id == project_id)
            .where(Phase.phase_key == "final_draft_reviewer")
        )
        phase = result.scalars().first()
        if not phase:
            phase = Phase(project_id=project_id, phase_key="final_draft_reviewer")
            db.add(phase)
            await db.flush()

        # Reset phase for a fresh run
        phase.status = PhaseStatus.pending
        phase.iteration += 1
        await db.commit()

        # Broadcast review started
        await ws_manager.broadcast(project_id, {
            "event": "review_started", "project_id": project_id,
        })

        await run_phase(db, project, phase, chosen_direction="AI_AUTOPILOT")

        # Broadcast review complete
        await ws_manager.broadcast(project_id, {
            "event": "review_complete", "project_id": project_id,
        })


class AutoFixRequest(BaseModel):
    finding_ids: list[str] | None = None  # None = fix all


@router.post("/auto-fix")
async def run_auto_fix(
    project_id: str,
    body: AutoFixRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Apply auto-fixes based on review findings."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Verify review artifact exists
    from app.services.artifact_service import get_active_artifact
    review_art = await get_active_artifact(db, project_id, "final_review")
    if not review_art:
        raise HTTPException(400, "No review results found. Run review first.")

    background_tasks.add_task(_run_auto_fix_task, project_id, body.finding_ids)
    return {"status": "auto_fix_started"}


async def _run_auto_fix_task(project_id: str, finding_ids: list[str] | None):
    """Background task that applies auto-fixes chapter by chapter."""
    from app.database import AsyncSessionLocal
    from app.agents.auto_fixer import AutoFixer
    from app.agents.base_agent import AgentContext
    from app.services.artifact_service import get_active_artifact, get_all_active_artifacts, save_artifact
    from app.ws import event_types as ev
    from app.ws.connection_manager import manager as ws_manager
    from datetime import datetime

    async with AsyncSessionLocal() as db:
        project = await db.get(Project, project_id)
        if not project:
            return

        review_art = await get_active_artifact(db, project_id, "final_review")
        if not review_art:
            return

        review_data = review_art.content_json
        categories = review_data.get("categories", {})

        # Collect all findings grouped by chapter
        chapter_findings: dict[int, list[dict]] = {}
        for cat_key, cat_data in categories.items():
            for finding in cat_data.get("findings", []):
                ch = finding.get("chapter", 1)
                if finding_ids is not None and finding.get("id") not in finding_ids:
                    continue
                chapter_findings.setdefault(ch, []).append(finding)

        if not chapter_findings:
            await ws_manager.broadcast(project_id, {
                "event": "auto_fix_complete",
                "project_id": project_id,
                "chapters_fixed": 0,
            })
            return

        # Get the reviewer phase for artifact ownership
        result = await db.execute(
            select(Phase)
            .where(Phase.project_id == project_id)
            .where(Phase.phase_key == "final_draft_reviewer")
        )
        phase = result.scalars().first()
        if not phase:
            return

        await ws_manager.broadcast(project_id, {
            "event": "auto_fix_started",
            "project_id": project_id,
            "total_chapters": len(chapter_findings),
        })

        agent = AutoFixer()
        if project.agent_model_config:
            cfg = project.agent_model_config.get("final_draft_reviewer")
            if cfg:
                agent.model_override = cfg.get("model")
                agent.provider_override = cfg.get("provider")

        chapters_fixed = 0
        all_fix_results = []

        for chapter_num in sorted(chapter_findings.keys()):
            findings = chapter_findings[chapter_num]

            # Get the current edited chapter
            edited_art = await get_active_artifact(db, project_id, f"edited_chapter_{chapter_num}")
            if not edited_art:
                continue

            original_prose = edited_art.content_json.get("edited_prose", "")

            await ws_manager.broadcast(project_id, {
                "event": "auto_fix_progress",
                "project_id": project_id,
                "chapter": chapter_num,
            })

            phase.status = PhaseStatus.running
            phase.started_at = datetime.utcnow()
            await db.commit()

            await ws_manager.broadcast(
                project_id, ev.phase_started(project_id, "final_draft_reviewer", chapter_num)
            )

            all_artifacts = await get_all_active_artifacts(db, project_id)
            artifacts_dict = {a_type: art.content_json for a_type, art in all_artifacts.items()}
            artifacts_dict["_fix_chapter_num"] = chapter_num
            artifacts_dict["_fix_original_prose"] = original_prose
            artifacts_dict["_fix_findings"] = findings

            ctx = AgentContext(
                project_id=project_id,
                phase_id=phase.id,
                phase_key="final_draft_reviewer",
                premise=project.initial_premise,
                artifacts=artifacts_dict,
                chosen_direction="AI_AUTOPILOT",
                iteration=chapter_num,
            )

            try:
                full_response = await agent.stream_to_ws_and_db(
                    db, ctx, agent.build_user_prompt(ctx), sequence_order=chapter_num,
                )
                fix_result = agent.parse_artifact(full_response)

                # Update the edited chapter with fixed prose
                if fix_result.get("edited_prose"):
                    edited_content = dict(edited_art.content_json)
                    edited_content["edited_prose"] = fix_result["edited_prose"]
                    if fix_result.get("word_count"):
                        edited_content["word_count"] = fix_result["word_count"]
                    await save_artifact(db, phase.id, project_id, f"edited_chapter_{chapter_num}", edited_content)
                    await db.commit()

                    await ws_manager.broadcast(project_id, ev.artifact_ready(
                        project_id, "final_draft_reviewer", f"edited_chapter_{chapter_num}", edited_art.id,
                    ))

                all_fix_results.extend(fix_result.get("fixes_applied", []))
                chapters_fixed += 1

                await ws_manager.broadcast(
                    project_id, ev.phase_completed(project_id, "final_draft_reviewer", chapter_num, 0),
                )

            except Exception as e:
                logger.exception(f"Auto-fix failed for chapter {chapter_num}: {e}")
                await ws_manager.broadcast(
                    project_id, ev.phase_error(project_id, "final_draft_reviewer", str(e)),
                )

        # Save fix results as artifact
        await save_artifact(db, phase.id, project_id, "auto_fix_report", {
            "chapters_fixed": chapters_fixed,
            "fixes_applied": all_fix_results,
        })
        await db.commit()

        phase.status = PhaseStatus.complete
        phase.completed_at = datetime.utcnow()
        await db.commit()

        await ws_manager.broadcast(project_id, {
            "event": "auto_fix_complete",
            "project_id": project_id,
            "chapters_fixed": chapters_fixed,
        })
        await ws_manager.broadcast(project_id, ev.artifact_ready(
            project_id, "final_draft_reviewer", "auto_fix_report", "",
        ))
