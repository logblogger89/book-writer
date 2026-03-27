from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.db_models import PhaseStatus, ProjectStatus


# ── Project ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str
    initial_premise: str


class ProjectUpdate(BaseModel):
    title: str


class ProjectResponse(BaseModel):
    id: str
    title: str
    initial_premise: str
    status: ProjectStatus
    auto_pilot: bool
    agent_model_config: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Phase ─────────────────────────────────────────────────────────────────────

class PhaseResponse(BaseModel):
    id: str
    project_id: str
    phase_key: str
    status: PhaseStatus
    iteration: int
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Artifact ──────────────────────────────────────────────────────────────────

class ArtifactResponse(BaseModel):
    id: str
    phase_id: str
    project_id: str
    artifact_type: str
    content_json: dict
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Choice ────────────────────────────────────────────────────────────────────

class ChoiceOption(BaseModel):
    id: str
    label: str
    summary: str
    is_recommended: bool = False


class ChoiceResolve(BaseModel):
    chosen_option_id: str | None = None  # None means custom text
    custom_text: str | None = None


class ChoiceResponse(BaseModel):
    id: str
    project_id: str
    phase_key: str
    options_json: list[dict]
    status: str
    chosen_option_id: str | None
    chosen_custom_text: str | None

    model_config = {"from_attributes": True}


# ── Model config ──────────────────────────────────────────────────────────────

class ModelConfigUpdate(BaseModel):
    phase_key: str
    provider: str  # "gemini" | "anthropic"
    model: str


# ── Pipeline control ──────────────────────────────────────────────────────────

class RollbackRequest(BaseModel):
    to_phase_key: str
    new_context: str | None = None


class AutoPilotToggle(BaseModel):
    enabled: bool


# ── WebSocket state sync ──────────────────────────────────────────────────────

class PhaseStateSummary(BaseModel):
    phase_key: str
    status: PhaseStatus
    iteration: int
    artifact_id: str | None = None


class StateSyncPayload(BaseModel):
    project_id: str
    phases: list[PhaseStateSummary]
    active_phase: str | None
    pipeline_status: ProjectStatus
    auto_pilot: bool
    model_assignments: dict = {}
