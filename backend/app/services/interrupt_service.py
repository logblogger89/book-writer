from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import InterruptQueue, InterruptStatus


async def add_interrupt(db: AsyncSession, project_id: str, phase_key: str, message: str) -> InterruptQueue:
    interrupt = InterruptQueue(project_id=project_id, phase_key=phase_key, message=message)
    db.add(interrupt)
    await db.commit()
    await db.refresh(interrupt)
    return interrupt


async def get_pending_interrupt(db: AsyncSession, project_id: str, phase_key: str) -> InterruptQueue | None:
    result = await db.execute(
        select(InterruptQueue)
        .where(InterruptQueue.project_id == project_id)
        .where(InterruptQueue.phase_key == phase_key)
        .where(InterruptQueue.status == InterruptStatus.pending)
        .order_by(InterruptQueue.created_at.asc())
    )
    return result.scalars().first()


async def consume_interrupt(db: AsyncSession, interrupt: InterruptQueue) -> InterruptQueue:
    interrupt.status = InterruptStatus.consumed
    await db.commit()
    return interrupt
