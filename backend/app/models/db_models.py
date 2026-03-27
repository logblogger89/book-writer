import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.utcnow()


class ProjectStatus(str, PyEnum):
    idle = "idle"
    running = "running"
    paused = "paused"
    awaiting_choice = "awaiting_choice"
    complete = "complete"
    error = "error"


class PhaseStatus(str, PyEnum):
    pending = "pending"
    running = "running"
    awaiting_choice = "awaiting_choice"
    complete = "complete"
    rolled_back = "rolled_back"
    error = "error"


class MessageRole(str, PyEnum):
    agent = "agent"
    user = "user"
    system = "system"


class InterruptStatus(str, PyEnum):
    pending = "pending"
    consumed = "consumed"


class ChoiceStatus(str, PyEnum):
    pending = "pending"
    resolved = "resolved"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    initial_premise: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.idle
    )
    auto_pilot: Mapped[bool] = mapped_column(Boolean, default=False)
    current_chapter: Mapped[int] = mapped_column(Integer, default=0)
    agent_model_config: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    phases: Mapped[list["Phase"]] = relationship(
        "Phase", back_populates="project", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="project", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list["PhaseSnapshot"]] = relationship(
        "PhaseSnapshot", back_populates="project", cascade="all, delete-orphan"
    )
    interrupts: Mapped[list["InterruptQueue"]] = relationship(
        "InterruptQueue", back_populates="project", cascade="all, delete-orphan"
    )
    choices: Mapped[list["PendingChoice"]] = relationship(
        "PendingChoice", back_populates="project", cascade="all, delete-orphan"
    )


class Phase(Base):
    __tablename__ = "phases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    phase_key: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[PhaseStatus] = mapped_column(
        Enum(PhaseStatus), default=PhaseStatus.pending
    )
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="phases")
    messages: Mapped[list["ExpertMessage"]] = relationship(
        "ExpertMessage", back_populates="phase", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="phase", cascade="all, delete-orphan"
    )


class ExpertMessage(Base):
    __tablename__ = "expert_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    phase_id: Mapped[str] = mapped_column(String, ForeignKey("phases.id"))
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_interrupt: Mapped[bool] = mapped_column(Boolean, default=False)
    sequence_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    phase: Mapped["Phase"] = relationship("Phase", back_populates="messages")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    phase_id: Mapped[str] = mapped_column(String, ForeignKey("phases.id"))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    artifact_type: Mapped[str] = mapped_column(String, nullable=False)
    content_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    phase: Mapped["Phase"] = relationship("Phase", back_populates="artifacts")
    project: Mapped["Project"] = relationship("Project", back_populates="artifacts")


class PhaseSnapshot(Base):
    __tablename__ = "phase_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    phase_key: Mapped[str] = mapped_column(String, nullable=False)
    iteration: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    user_context_at_restore: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    project: Mapped["Project"] = relationship("Project", back_populates="snapshots")


class InterruptQueue(Base):
    __tablename__ = "interrupt_queue"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    phase_key: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[InterruptStatus] = mapped_column(
        Enum(InterruptStatus), default=InterruptStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    project: Mapped["Project"] = relationship("Project", back_populates="interrupts")


class PendingChoice(Base):
    __tablename__ = "pending_choices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"))
    phase_key: Mapped[str] = mapped_column(String, nullable=False)
    options_json: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[ChoiceStatus] = mapped_column(
        Enum(ChoiceStatus), default=ChoiceStatus.pending
    )
    chosen_option_id: Mapped[str | None] = mapped_column(String, nullable=True)
    chosen_custom_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    project: Mapped["Project"] = relationship("Project", back_populates="choices")
