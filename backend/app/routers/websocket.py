import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.db_models import Artifact, Phase, Project, ProjectStatus
from app.models.schemas import PhaseStateSummary, StateSyncPayload
from app.pipeline import orchestrator
from app.services.artifact_service import get_all_active_artifacts
from app.services.interrupt_service import add_interrupt
from app.ws import event_types as ev
from app.ws.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)

    try:
        # Send initial state sync
        async with AsyncSessionLocal() as db:
            await _send_state_sync(db, websocket, project_id)

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")
            async with AsyncSessionLocal() as db:
                await _handle_client_event(db, project_id, event, msg)

    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
    except Exception as e:
        logger.error(f"WebSocket error for project {project_id}: {e}")
        manager.disconnect(websocket, project_id)


async def _send_state_sync(db: AsyncSession, websocket: WebSocket, project_id: str):
    project = await db.get(Project, project_id)
    if not project:
        return

    phases_result = await db.execute(
        select(Phase).where(Phase.project_id == project_id)
    )
    phases = phases_result.scalars().all()

    all_artifacts = await get_all_active_artifacts(db, project_id)
    # Build a map: phase_key -> artifact_id
    artifact_by_phase: dict[str, str] = {}
    for art_type, art in all_artifacts.items():
        # Map artifact_type to phase (simple 1:1 in our schema)
        artifact_by_phase[art_type] = art.id

    phase_summaries = []
    for p in phases:
        # Try to find artifact for this phase
        art_result = await db.execute(
            select(Artifact)
            .where(Artifact.phase_id == p.id)
            .where(Artifact.is_active == True)
        )
        art = art_result.scalars().first()
        phase_summaries.append(
            PhaseStateSummary(
                phase_key=p.phase_key,
                status=p.status,
                iteration=p.iteration,
                artifact_id=art.id if art else None,
            )
        )

    # Find active phase
    active = next((p.phase_key for p in phases if p.status.value == "running"), None)

    # If the DB says 'running' but no orchestrator task is alive (e.g. after a server
    # restart), report 'paused' so the frontend shows "Resume" instead of "Pause".
    effective_status = project.status
    if project.status == ProjectStatus.running and not orchestrator.is_active(project_id):
        effective_status = ProjectStatus.paused

    payload = StateSyncPayload(
        project_id=project_id,
        phases=phase_summaries,
        active_phase=active,
        pipeline_status=effective_status,
        auto_pilot=project.auto_pilot,
        model_assignments=project.agent_model_config or {},
    )

    await manager.send_personal(websocket, ev.state_sync(payload.model_dump()))


async def _handle_client_event(db: AsyncSession, project_id: str, event: str, msg: dict):
    if event == "inject_interrupt":
        phase_key = msg.get("phase_key", "")
        message = msg.get("message", "")
        if phase_key and message:
            await add_interrupt(db, project_id, phase_key, message)

    elif event == "pause_pipeline":
        orchestrator.pause_pipeline(project_id)

    elif event == "resume_pipeline":
        orchestrator.resume_pipeline(project_id)

    elif event == "toggle_auto_pilot":
        project = await db.get(Project, project_id)
        if project:
            project.auto_pilot = msg.get("enabled", False)
            await db.commit()

    elif event == "pong":
        pass  # keepalive
