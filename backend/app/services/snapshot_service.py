from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Artifact, ExpertMessage, Phase, PhaseSnapshot


async def save_snapshot(db: AsyncSession, phase: Phase, input_artifacts: dict) -> PhaseSnapshot:
    """Capture full state of a completed phase for future rollback."""
    # Collect all messages for this phase
    result = await db.execute(
        select(ExpertMessage)
        .where(ExpertMessage.phase_id == phase.id)
        .order_by(ExpertMessage.sequence_order)
    )
    messages = [
        {"role": m.role, "content": m.content, "is_interrupt": m.is_interrupt}
        for m in result.scalars().all()
    ]

    # Get the phase's artifact
    art_result = await db.execute(
        select(Artifact)
        .where(Artifact.phase_id == phase.id)
        .where(Artifact.is_active == True)
    )
    artifact = art_result.scalars().first()
    artifact_data = artifact.content_json if artifact else None
    artifact_type = artifact.artifact_type if artifact else None
    artifact_id = artifact.id if artifact else None

    snapshot_data = {
        "phase_key": phase.phase_key,
        "iteration": phase.iteration,
        "messages": messages,
        "artifact": artifact_data,
        "artifact_type": artifact_type,
        "artifact_id": artifact_id,
        "input_artifacts": input_artifacts,
    }

    snapshot = PhaseSnapshot(
        project_id=phase.project_id,
        phase_key=phase.phase_key,
        iteration=phase.iteration,
        snapshot_data=snapshot_data,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


async def get_latest_snapshot(
    db: AsyncSession, project_id: str, phase_key: str
) -> PhaseSnapshot | None:
    result = await db.execute(
        select(PhaseSnapshot)
        .where(PhaseSnapshot.project_id == project_id)
        .where(PhaseSnapshot.phase_key == phase_key)
        .order_by(PhaseSnapshot.iteration.desc())
    )
    return result.scalars().first()
