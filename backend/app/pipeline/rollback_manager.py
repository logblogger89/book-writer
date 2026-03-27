"""Handles rollback: invalidates downstream phases, restores snapshot, re-queues pipeline."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Artifact, Phase, PhaseStatus, Project, ProjectStatus
from app.pipeline.phase_graph import get_downstream_phases
from app.services.snapshot_service import get_latest_snapshot
from app.ws import event_types as ev
from app.ws.connection_manager import manager as ws_manager

logger = logging.getLogger(__name__)


async def rollback_to_phase(
    db: AsyncSession,
    project: Project,
    to_phase_key: str,
    new_context: str | None = None,
) -> str | None:
    """
    Roll back to `to_phase_key`, invalidating all downstream phases.
    Returns the rollback_context string to inject into the re-run, or None.
    """
    downstream = get_downstream_phases(to_phase_key)

    # Invalidate downstream phases
    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project.id)
        .where(Phase.phase_key.in_(downstream))
    )
    downstream_phases = result.scalars().all()

    for phase in downstream_phases:
        phase.status = PhaseStatus.rolled_back
        phase.iteration += 1
        phase.started_at = None
        phase.completed_at = None
        await ws_manager.broadcast(
            project.id, ev.phase_rolled_back(project.id, phase.phase_key)
        )

    # Soft-deactivate downstream artifacts
    for phase in downstream_phases:
        art_result = await db.execute(
            select(Artifact)
            .where(Artifact.phase_id == phase.id)
            .where(Artifact.is_active == True)
        )
        for artifact in art_result.scalars().all():
            artifact.is_active = False

    # Also reset the target phase itself for re-run
    target_result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project.id)
        .where(Phase.phase_key == to_phase_key)
    )
    target_phase = target_result.scalars().first()
    if target_phase:
        # Deactivate its current artifact
        art_result = await db.execute(
            select(Artifact)
            .where(Artifact.phase_id == target_phase.id)
            .where(Artifact.is_active == True)
        )
        for artifact in art_result.scalars().all():
            artifact.is_active = False

        target_phase.status = PhaseStatus.rolled_back
        target_phase.iteration += 1
        target_phase.started_at = None
        target_phase.completed_at = None
        await ws_manager.broadcast(
            project.id, ev.phase_rolled_back(project.id, to_phase_key)
        )

    # Store new_context in the latest snapshot for the target phase
    if new_context:
        snapshot = await get_latest_snapshot(db, project.id, to_phase_key)
        if snapshot:
            snapshot.user_context_at_restore = new_context

    project.status = ProjectStatus.running
    await db.commit()

    logger.info(
        f"Rollback complete: project={project.id}, to={to_phase_key}, "
        f"invalidated={[p.phase_key for p in downstream_phases]}"
    )

    return new_context
