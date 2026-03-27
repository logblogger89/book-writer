"""WebSocket event type constants and payload builders."""

from typing import Any


# ── Event name constants ──────────────────────────────────────────────────────

PHASE_STARTED = "phase_started"
PHASE_COMPLETED = "phase_completed"
PHASE_ROLLED_BACK = "phase_rolled_back"
PHASE_ERROR = "phase_error"

STREAM_CHUNK = "stream_chunk"
STREAM_END = "stream_end"

ARTIFACT_READY = "artifact_ready"
ARTIFACT_UPDATED = "artifact_updated"

CHOICE_READY = "choice_ready"
CHOICE_CONSUMED = "choice_consumed"

INTERRUPT_ACKNOWLEDGED = "interrupt_acknowledged"

PIPELINE_STARTED = "pipeline_started"
PIPELINE_PAUSED = "pipeline_paused"
PIPELINE_RESUMED = "pipeline_resumed"
PIPELINE_COMPLETE = "pipeline_complete"
PIPELINE_ERROR = "pipeline_error"

STATE_SYNC = "state_sync"
PING = "ping"
PONG = "pong"

RATE_LIMIT_WAITING = "rate_limit_waiting"
RATE_LIMIT_RESUMED = "rate_limit_resumed"

CHAPTER_STARTED = "chapter_started"
CHAPTER_COMPLETED = "chapter_completed"
CHAPTER_PHASE_PROGRESS = "chapter_phase_progress"


# ── Payload builders ──────────────────────────────────────────────────────────

def phase_started(project_id: str, phase_key: str, iteration: int) -> dict:
    return {"event": PHASE_STARTED, "project_id": project_id, "phase_key": phase_key, "iteration": iteration}


def phase_completed(project_id: str, phase_key: str, iteration: int, duration_ms: int) -> dict:
    return {"event": PHASE_COMPLETED, "project_id": project_id, "phase_key": phase_key, "iteration": iteration, "duration_ms": duration_ms}


def phase_rolled_back(project_id: str, phase_key: str) -> dict:
    return {"event": PHASE_ROLLED_BACK, "project_id": project_id, "phase_key": phase_key}


def phase_error(project_id: str, phase_key: str, error_message: str) -> dict:
    return {"event": PHASE_ERROR, "project_id": project_id, "phase_key": phase_key, "error_message": error_message}


def stream_chunk(project_id: str, phase_key: str, chunk: str, message_id: str) -> dict:
    return {"event": STREAM_CHUNK, "project_id": project_id, "phase_key": phase_key, "chunk": chunk, "message_id": message_id}


def stream_end(project_id: str, phase_key: str, message_id: str, full_content: str) -> dict:
    return {"event": STREAM_END, "project_id": project_id, "phase_key": phase_key, "message_id": message_id, "full_content": full_content}


def artifact_ready(project_id: str, phase_key: str, artifact_type: str, artifact_id: str) -> dict:
    return {"event": ARTIFACT_READY, "project_id": project_id, "phase_key": phase_key, "artifact_type": artifact_type, "artifact_id": artifact_id}


def choice_ready(project_id: str, phase_key: str, choice_id: str, options: list[dict]) -> dict:
    return {"event": CHOICE_READY, "project_id": project_id, "phase_key": phase_key, "choice_id": choice_id, "options": options}


def choice_consumed(project_id: str, phase_key: str, choice_id: str, chosen_option_id: str | None) -> dict:
    return {"event": CHOICE_CONSUMED, "project_id": project_id, "phase_key": phase_key, "choice_id": choice_id, "chosen_option_id": chosen_option_id}


def interrupt_acknowledged(project_id: str, phase_key: str, agent_summary: str) -> dict:
    return {"event": INTERRUPT_ACKNOWLEDGED, "project_id": project_id, "phase_key": phase_key, "agent_summary": agent_summary}


def pipeline_started(project_id: str) -> dict:
    return {"event": PIPELINE_STARTED, "project_id": project_id}


def pipeline_paused(project_id: str, paused_at_phase: str) -> dict:
    return {"event": PIPELINE_PAUSED, "project_id": project_id, "paused_at_phase": paused_at_phase}


def pipeline_resumed(project_id: str) -> dict:
    return {"event": PIPELINE_RESUMED, "project_id": project_id}


def pipeline_complete(project_id: str) -> dict:
    return {"event": PIPELINE_COMPLETE, "project_id": project_id}


def pipeline_error(project_id: str, error_message: str) -> dict:
    return {"event": PIPELINE_ERROR, "project_id": project_id, "error_message": error_message}


def state_sync(payload: dict) -> dict:
    return {"event": STATE_SYNC, **payload}


def rate_limit_waiting(project_id: str, phase_key: str, wait_seconds: int) -> dict:
    return {"event": RATE_LIMIT_WAITING, "project_id": project_id, "phase_key": phase_key, "wait_seconds": wait_seconds}


def rate_limit_resumed(project_id: str, phase_key: str) -> dict:
    return {"event": RATE_LIMIT_RESUMED, "project_id": project_id, "phase_key": phase_key}


def chapter_started(project_id: str, chapter_number: int, total_chapters: int) -> dict:
    return {"event": CHAPTER_STARTED, "project_id": project_id, "chapter_number": chapter_number, "total_chapters": total_chapters}


def chapter_completed(project_id: str, chapter_number: int, total_chapters: int, duration_ms: int) -> dict:
    return {"event": CHAPTER_COMPLETED, "project_id": project_id, "chapter_number": chapter_number, "total_chapters": total_chapters, "duration_ms": duration_ms}


def chapter_phase_progress(project_id: str, chapter_number: int, total_chapters: int, phase_key: str) -> dict:
    return {"event": CHAPTER_PHASE_PROGRESS, "project_id": project_id, "chapter_number": chapter_number, "total_chapters": total_chapters, "phase_key": phase_key}
