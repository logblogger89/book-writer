from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Artifact, Phase  # noqa: F401 (Phase kept for callers)


async def get_active_artifact(db: AsyncSession, project_id: str, artifact_type: str) -> Artifact | None:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.project_id == project_id)
        .where(Artifact.artifact_type == artifact_type)
        .where(Artifact.is_active == True)
        .order_by(Artifact.version.desc())
    )
    return result.scalars().first()


async def get_artifact_by_id(db: AsyncSession, artifact_id: str) -> Artifact | None:
    return await db.get(Artifact, artifact_id)


async def get_all_active_artifacts(db: AsyncSession, project_id: str) -> dict[str, Artifact]:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.project_id == project_id)
        .where(Artifact.is_active == True)
        .order_by(Artifact.version.desc())
    )
    artifacts = result.scalars().all()
    # Return the latest version per artifact_type
    by_type: dict[str, Artifact] = {}
    for a in artifacts:
        if a.artifact_type not in by_type:
            by_type[a.artifact_type] = a
    return by_type


async def save_artifact(
    db: AsyncSession,
    phase_id: str,
    project_id: str,
    artifact_type: str,
    content_json: dict,
) -> Artifact:
    # Deactivate previous versions
    result = await db.execute(
        select(Artifact)
        .where(Artifact.project_id == project_id)
        .where(Artifact.artifact_type == artifact_type)
        .where(Artifact.is_active == True)
    )
    existing = result.scalars().all()
    max_version = 0
    for a in existing:
        a.is_active = False
        if a.version > max_version:
            max_version = a.version

    artifact = Artifact(
        phase_id=phase_id,
        project_id=project_id,
        artifact_type=artifact_type,
        content_json=content_json,
        version=max_version + 1,
        is_active=True,
    )
    db.add(artifact)
    await db.flush()
    return artifact


async def save_chapter_artifact(
    db: AsyncSession,
    phase_id: str,
    project_id: str,
    base_type: str,
    content_json: dict,
    chapter_number: int,
) -> Artifact:
    """Saves an artifact namespaced by chapter number, e.g. prose_chapter_3."""
    return await save_artifact(db, phase_id, project_id, f"{base_type}_{chapter_number}", content_json)


async def get_completed_chapter_numbers(db: AsyncSession, project_id: str) -> list[int]:
    """Returns sorted list of chapter numbers with a completed edited_chapter_N artifact."""
    result = await db.execute(
        select(Artifact)
        .where(Artifact.project_id == project_id)
        .where(Artifact.artifact_type.like("edited_chapter_%"))
        .where(Artifact.is_active == True)
    )
    chapters = []
    for a in result.scalars().all():
        suffix = a.artifact_type.split("_")[-1]
        if suffix.isdigit():
            chapters.append(int(suffix))
    return sorted(chapters)


async def get_artifact_versions(db: AsyncSession, project_id: str, artifact_type: str) -> list[Artifact]:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.project_id == project_id)
        .where(Artifact.artifact_type == artifact_type)
        .order_by(Artifact.version.desc())
    )
    return result.scalars().all()
