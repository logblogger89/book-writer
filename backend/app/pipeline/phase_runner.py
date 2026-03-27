"""Runs a single phase: builds context, invokes the agent, saves artifacts + snapshot."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import AgentContext, BaseAgent
from app.agents.chapter_beats_creator import ChapterBeatsCreator
from app.agents.continuity_editor import ContinuityEditor
from app.agents.dialogue_specialist import DialogueSpecialist
from app.agents.literary_editor import LiteraryEditor
from app.agents.logline_creator import LoglineCreator
from app.agents.persona_creator import PersonaCreator
from app.agents.prose_writer import ProseWriter
from app.agents.scene_outliner import SceneOutliner
from app.agents.scientific_advisor import ScientificAdvisor
from app.agents.world_builder import WorldBuilder
from app.models.db_models import Artifact, PendingChoice, Phase, PhaseStatus, Project
from app.services.artifact_service import get_all_active_artifacts, save_artifact
from app.services.interrupt_service import consume_interrupt, get_pending_interrupt
from app.services.snapshot_service import save_snapshot
from app.ws import event_types as ev
from app.ws.connection_manager import manager as ws_manager

logger = logging.getLogger(__name__)

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "logline_creator": LoglineCreator,
    "world_builder": WorldBuilder,
    "scientific_advisor": ScientificAdvisor,
    "persona_creator": PersonaCreator,
    "chapter_beats_creator": ChapterBeatsCreator,
    "scene_outliner": SceneOutliner,
    "dialogue_specialist": DialogueSpecialist,
    "prose_writer": ProseWriter,
    "continuity_editor": ContinuityEditor,
    "literary_editor": LiteraryEditor,
}


async def run_phase(
    db: AsyncSession,
    project: Project,
    phase: Phase,
    chosen_direction: str | None = None,
    rollback_context: str | None = None,
) -> Artifact | None:
    """Execute a single phase. Returns the produced artifact (or None on failure)."""
    agent_class = AGENT_REGISTRY.get(phase.phase_key)
    if not agent_class:
        logger.error(f"No agent registered for phase: {phase.phase_key}")
        return None

    agent = agent_class()

    # Apply per-phase model override if configured for this project
    if project.agent_model_config:
        cfg = project.agent_model_config.get(phase.phase_key)
        if cfg:
            agent.model_override = cfg.get("model")
            agent.provider_override = cfg.get("provider")

    # Mark phase as running
    phase.status = PhaseStatus.running
    phase.started_at = datetime.utcnow()
    await db.commit()

    await ws_manager.broadcast(
        project.id, ev.phase_started(project.id, phase.phase_key, phase.iteration)
    )

    # Gather all active artifacts for context
    all_artifacts = await get_all_active_artifacts(db, project.id)
    artifacts_dict = {a_type: art.content_json for a_type, art in all_artifacts.items()}

    # Check for pending interrupt
    interrupt = await get_pending_interrupt(db, project.id, phase.phase_key)
    interrupt_message = None
    if interrupt:
        interrupt_message = interrupt.message
        await consume_interrupt(db, interrupt)
        await ws_manager.broadcast(
            project.id,
            ev.interrupt_acknowledged(project.id, phase.phase_key, f"Incorporating: {interrupt_message[:100]}"),
        )

    premise = project.initial_premise
    if project.sub_genre:
        premise = f"[Sub-genre: {project.sub_genre}]\n{premise}"

    ctx = AgentContext(
        project_id=project.id,
        phase_id=phase.id,
        phase_key=phase.phase_key,
        premise=premise,
        artifacts=artifacts_dict,
        chosen_direction=chosen_direction,
        interrupt_message=interrupt_message,
        rollback_context=rollback_context,
        iteration=phase.iteration,
    )

    try:
        start_time = datetime.utcnow()

        # Run the full output (direction already chosen by orchestrator)
        full_response = await agent.stream_to_ws_and_db(
            db, ctx, agent.build_user_prompt(ctx), sequence_order=0
        )

        artifact_content = agent.parse_artifact(full_response)
        artifact = await save_artifact(
            db,
            phase_id=phase.id,
            project_id=project.id,
            artifact_type=agent.artifact_type,
            content_json=artifact_content,
        )

        # Save snapshot for rollback
        await save_snapshot(db, phase, input_artifacts=artifacts_dict)

        phase.status = PhaseStatus.complete
        phase.completed_at = datetime.utcnow()
        await db.commit()

        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        await ws_manager.broadcast(
            project.id,
            ev.phase_completed(project.id, phase.phase_key, phase.iteration, duration_ms),
        )
        await ws_manager.broadcast(
            project.id,
            ev.artifact_ready(project.id, phase.phase_key, agent.artifact_type, artifact.id),
        )

        return artifact

    except Exception as e:
        logger.exception(f"Phase {phase.phase_key} failed: {e}")
        phase.status = PhaseStatus.error
        await db.commit()
        await ws_manager.broadcast(
            project.id, ev.phase_error(project.id, phase.phase_key, str(e))
        )
        return None
