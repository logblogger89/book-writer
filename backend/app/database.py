from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


def _apply_migrations(sync_conn):
    """Additive column migrations that create_all cannot handle for existing DBs."""
    inspector = inspect(sync_conn)

    def add_if_missing(table, column, definition):
        cols = [c["name"] for c in inspector.get_columns(table)]
        if column not in cols:
            sync_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))

    add_if_missing("projects", "current_chapter", "INTEGER NOT NULL DEFAULT 0")


async def init_db():
    from app.models import db_models  # noqa: F401 — ensures models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_migrations)
