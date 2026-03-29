"""Top-level async pipeline orchestrator."""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.db_models import (
    PendingChoice,
    Phase,
    PhaseStatus,
    Project,
    ProjectStatus,
)
from app.models.db_models import ChoiceStatus
from app.pipeline.phase_graph import ITERATIVE_PHASES, ON_DEMAND_PHASES, PHASE_ORDER, get_ready_phases
from app.pipeline.phase_runner import run_phase
from app.ws import event_types as ev
from app.ws.connection_manager import manager as ws_manager

logger = logging.getLogger(__name__)

# Per-project control events
_pause_events: dict[str, asyncio.Event] = {}
_stop_events: dict[str, asyncio.Event] = {}
_active_tasks: set[str] = set()


def is_active(project_id: str) -> bool:
    """Returns True if a live asyncio background task is running for this project."""
    return project_id in _active_tasks


def _get_resume_event(project_id: str) -> asyncio.Event:
    if project_id not in _pause_events:
        e = asyncio.Event()
        e.set()  # not paused by default
        _pause_events[project_id] = e
    return _pause_events[project_id]


def _get_stop_event(project_id: str) -> asyncio.Event:
    if project_id not in _stop_events:
        e = asyncio.Event()
        _stop_events[project_id] = e
    return _stop_events[project_id]


def pause_pipeline(project_id: str):
    _get_resume_event(project_id).clear()


def resume_pipeline(project_id: str):
    _get_resume_event(project_id).set()


def stop_pipeline(project_id: str):
    _get_stop_event(project_id).set()
    resume_pipeline(project_id)  # unblock any waits


async def run_pipeline(project_id: str, start_from: str | None = None, rollback_context: str | None = None):
    """Main pipeline loop. Runs in a background asyncio task."""
    _active_tasks.add(project_id)
    try:
        await _run_pipeline_inner(project_id, start_from, rollback_context)
    finally:
        _active_tasks.discard(project_id)


async def _run_pipeline_inner(project_id: str, start_from: str | None = None, rollback_context: str | None = None):
    resume_event = _get_resume_event(project_id)
    stop_event = _get_stop_event(project_id)
    # Reset stop event for fresh run
    stop_event.clear()

    async with AsyncSessionLocal() as db:
        project = await db.get(Project, project_id)
        if not project:
            return

        project.status = ProjectStatus.running
        await db.commit()
        await ws_manager.broadcast(project_id, ev.pipeline_started(project_id))

        try:
            await _run_phases(db, project, resume_event, stop_event, start_from, rollback_context)
        except Exception as e:
            logger.exception(f"Pipeline error for project {project_id}: {e}")
            project.status = ProjectStatus.error
            await db.commit()
            await ws_manager.broadcast(project_id, ev.pipeline_error(project_id, str(e)))
            return

        if stop_event.is_set():
            logger.info(f"Pipeline stopped for project {project_id}")
            return

        project.status = ProjectStatus.complete
        await db.commit()
        await ws_manager.broadcast(project_id, ev.pipeline_complete(project_id))


async def _run_phases(
    db: AsyncSession,
    project: Project,
    resume_event: asyncio.Event,
    stop_event: asyncio.Event,
    start_from: str | None,
    rollback_context: str | None,
):
    started = start_from is None  # if start_from is None, start from beginning

    for phase_key in PHASE_ORDER:
        if stop_event.is_set():
            return

        if not started:
            if phase_key == start_from:
                started = True
            else:
                continue

        # Wait if paused
        if not resume_event.is_set():
            await ws_manager.broadcast(project.id, ev.pipeline_paused(project.id, phase_key))
            project.status = ProjectStatus.paused
            await db.commit()
            await resume_event.wait()
            project.status = ProjectStatus.running
            await db.commit()
            await ws_manager.broadcast(project.id, ev.pipeline_resumed(project.id))

        if stop_event.is_set():
            return

        # Skip on-demand phases (e.g. final_draft_reviewer) — they run via dedicated API
        if phase_key in ON_DEMAND_PHASES:
            continue

        # scene_outliner runs per-chapter (one LLM call per chapter, saves scene_outline_N)
        if phase_key == "scene_outliner":
            logger.info(f"[DEBUG] entering _run_scene_outliner_loop for project {project.id}")
            await _run_scene_outliner_loop(db, project, resume_event, stop_event)
            logger.info(f"[DEBUG] finished _run_scene_outliner_loop for project {project.id}")
            continue

        # Iterative phases (prose_writer, continuity_editor, literary_editor) are handled
        # together by the chapter loop — not individually as top-level phases.
        if phase_key == "prose_writer":
            logger.info(f"[DEBUG] entering _run_chapter_loop for project {project.id}")
            await _run_chapter_loop(db, project, resume_event, stop_event)
            logger.info(f"[DEBUG] finished _run_chapter_loop for project {project.id}")
            continue
        elif phase_key in ITERATIVE_PHASES:
            continue  # handled inside _run_chapter_loop

        # Get phase record
        result = await db.execute(
            select(Phase)
            .where(Phase.project_id == project.id)
            .where(Phase.phase_key == phase_key)
        )
        phase = result.scalars().first()
        if not phase:
            continue

        # Skip already-complete phases (e.g. not rolled back)
        if phase.status == PhaseStatus.complete:
            continue

        # Reset rolled_back phases to pending before running
        if phase.status == PhaseStatus.rolled_back:
            phase.status = PhaseStatus.pending
            await db.commit()

        # Handle choice: auto-pilot or wait for user
        chosen_direction = None
        if not project.auto_pilot:
            # Generate options first, then wait for user to choose
            chosen_direction = await _generate_and_wait_for_choice(
                db, project, phase, resume_event, stop_event
            )
            if stop_event.is_set():
                return
        else:
            # In auto-pilot: let agent pick its own best direction
            chosen_direction = "AI_AUTOPILOT"

        rc = rollback_context if phase_key == start_from else None
        await run_phase(db, project, phase, chosen_direction=chosen_direction, rollback_context=rc)

        # Refresh project to check auto_pilot toggle mid-run
        await db.refresh(project)


# ── Chapter loop helpers ───────────────────────────────────────────────────────

def _build_beats_lookup(chapter_beats_json: dict) -> dict[int, dict]:
    """Flatten acts → chapters into {chapter_number: chapter_beat_dict}."""
    lookup = {}
    for act in chapter_beats_json.get("acts", []):
        for ch in act.get("chapters", []):
            num = ch.get("chapter_number")
            if num is not None:
                lookup[int(num)] = ch
    return lookup


def _build_scenes_lookup(scene_outline_json: dict) -> dict[int, dict]:
    """Map {chapter_number: chapter_scene_dict} from scene_outline."""
    lookup = {}
    for ch in scene_outline_json.get("chapters", []):
        num = ch.get("chapter_number")
        if num is not None:
            lookup[int(num)] = ch
    return lookup


async def _run_scene_outliner_loop(
    db: AsyncSession,
    project: Project,
    resume_event: asyncio.Event,
    stop_event: asyncio.Event,
):
    """Run scene_outliner chapter-by-chapter, saving scene_outline_N per chapter."""
    from app.services.artifact_service import get_active_artifact, get_all_active_artifacts, save_artifact

    all_artifacts = await get_all_active_artifacts(db, project.id)
    chapter_beats_art = all_artifacts.get("chapter_beats")
    if not chapter_beats_art:
        raise RuntimeError("chapter_beats must be complete before scene outlining")

    beats = _build_beats_lookup(chapter_beats_art.content_json)
    total_chapters = len(beats)
    if total_chapters == 0:
        raise RuntimeError("No chapters found in chapter_beats artifact")

    logger.info(f"[DEBUG] scene_outliner loop: total_chapters={total_chapters}")
    scene_phase = await _get_phase(db, project.id, "scene_outliner")
    if not scene_phase:
        raise RuntimeError("scene_outliner phase row missing from database")

    # Already fully complete — skip
    if scene_phase.status == PhaseStatus.complete:
        return

    # Resume: find the last completed scene_outline_N artifact
    start_chapter = 1
    for n in range(total_chapters, 0, -1):
        art = await get_active_artifact(db, project.id, f"scene_outline_{n}")
        if art:
            start_chapter = n + 1
            break

    logger.info(f"[DEBUG] scene_outliner: start_chapter={start_chapter}, total_chapters={total_chapters}, status={scene_phase.status}")
    if start_chapter > total_chapters:
        # All scene artifacts exist but phase not marked complete (e.g. prior crash)
        scene_phase.status = PhaseStatus.complete
        scene_phase.completed_at = datetime.utcnow()
        await db.commit()
        return

    for chapter_num in range(start_chapter, total_chapters + 1):
        if stop_event.is_set():
            return

        if not resume_event.is_set():
            await ws_manager.broadcast(project.id, ev.pipeline_paused(project.id, "scene_outliner"))
            project.status = ProjectStatus.paused
            await db.commit()
            await resume_event.wait()
            project.status = ProjectStatus.running
            await db.commit()
            await ws_manager.broadcast(project.id, ev.pipeline_resumed(project.id))

        if stop_event.is_set():
            return

        beat = beats.get(chapter_num, {})
        await save_artifact(db, scene_phase.id, project.id, "current_chapter_beat", beat)

        scene_phase.iteration = chapter_num
        await db.commit()

        scene_art = await _run_iterative_phase(db, project, scene_phase, chapter_num)
        if not scene_art:
            raise RuntimeError(f"Scene outliner failed for chapter {chapter_num}")

    scene_phase.status = PhaseStatus.complete
    scene_phase.completed_at = datetime.utcnow()
    await db.commit()


async def _get_phase(db: AsyncSession, project_id: str, phase_key: str) -> Phase | None:
    result = await db.execute(
        select(Phase)
        .where(Phase.project_id == project_id)
        .where(Phase.phase_key == phase_key)
    )
    return result.scalars().first()


async def _build_prior_summaries(db: AsyncSession, project_id: str, up_to_chapter: int) -> list[dict]:
    """Return a list of summary dicts from completed edited_chapter_N artifacts (N < up_to_chapter)."""
    from app.services.artifact_service import get_active_artifact
    summaries = []
    for n in range(1, up_to_chapter):
        art = await get_active_artifact(db, project_id, f"edited_chapter_{n}")
        if art and art.content_json:
            content = art.content_json
            summaries.append({
                "chapter_number": n,
                "summary": content.get("quality_assessment") or content.get("edited_prose", "")[:500],
            })
    return summaries


async def _run_iterative_phase(
    db: AsyncSession,
    project: Project,
    phase: Phase,
    chapter_number: int,
) -> object | None:
    """Run a single agent for one chapter iteration. Saves a chapter-namespaced artifact.
    Does NOT mark the phase complete — _run_chapter_loop does that after all chapters."""
    from app.agents.base_agent import AgentContext
    from app.pipeline.phase_runner import AGENT_REGISTRY
    from app.services.artifact_service import get_all_active_artifacts, save_chapter_artifact
    from app.services.interrupt_service import consume_interrupt, get_pending_interrupt

    agent_class = AGENT_REGISTRY.get(phase.phase_key)
    if not agent_class:
        logger.error(f"No agent registered for phase: {phase.phase_key}")
        return None

    agent = agent_class()

    if project.agent_model_config:
        cfg = project.agent_model_config.get(phase.phase_key)
        if cfg:
            agent.model_override = cfg.get("model")
            agent.provider_override = cfg.get("provider")

    # Mark phase as running for this chapter
    phase.status = PhaseStatus.running
    phase.started_at = datetime.utcnow()
    await db.commit()

    await ws_manager.broadcast(
        project.id, ev.phase_started(project.id, phase.phase_key, chapter_number)
    )

    all_artifacts = await get_all_active_artifacts(db, project.id)
    artifacts_dict = {a_type: art.content_json for a_type, art in all_artifacts.items()}

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

    if project.chapter_count:
        artifacts_dict['_chapter_count'] = project.chapter_count

    ctx = AgentContext(
        project_id=project.id,
        phase_id=phase.id,
        phase_key=phase.phase_key,
        premise=premise,
        artifacts=artifacts_dict,
        chosen_direction="AI_AUTOPILOT",  # always autopilot in the chapter loop
        interrupt_message=interrupt_message,
        iteration=chapter_number,
    )

    try:
        start_time = datetime.utcnow()

        full_response = await agent.stream_to_ws_and_db(
            db, ctx, agent.build_user_prompt(ctx), sequence_order=chapter_number
        )

        artifact_content = agent.parse_artifact(full_response)
        logger.info(f"[DEBUG] save_chapter_artifact: base_type={agent.artifact_type}, chapter_number={chapter_number}, type={type(chapter_number)}")
        artifact = await save_chapter_artifact(
            db,
            phase_id=phase.id,
            project_id=project.id,
            base_type=agent.artifact_type,
            content_json=artifact_content,
            chapter_number=chapter_number,
        )
        logger.info(f"[DEBUG] saved artifact type: {artifact.artifact_type}")

        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        await ws_manager.broadcast(
            project.id,
            ev.phase_completed(project.id, phase.phase_key, chapter_number, duration_ms),
        )
        await ws_manager.broadcast(
            project.id,
            ev.artifact_ready(project.id, phase.phase_key, f"{agent.artifact_type}_{chapter_number}", artifact.id),
        )

        return artifact

    except Exception as e:
        logger.exception(f"Phase {phase.phase_key} chapter {chapter_number} failed: {e}")
        phase.status = PhaseStatus.error
        await db.commit()
        await ws_manager.broadcast(
            project.id, ev.phase_error(project.id, phase.phase_key, str(e))
        )
        return None


async def _run_chapter_loop(
    db: AsyncSession,
    project: Project,
    resume_event: asyncio.Event,
    stop_event: asyncio.Event,
):
    """Run prose_writer → continuity_editor → literary_editor for every chapter."""
    from app.services.artifact_service import get_all_active_artifacts, save_artifact

    # Load prerequisite artifacts
    all_artifacts = await get_all_active_artifacts(db, project.id)
    chapter_beats_art = all_artifacts.get("chapter_beats")
    if not chapter_beats_art:
        raise RuntimeError("chapter_beats must be complete before prose generation")

    beats = _build_beats_lookup(chapter_beats_art.content_json)
    total_chapters = len(beats)
    if total_chapters == 0:
        raise RuntimeError("No chapters found in chapter_beats artifact")

    # Resume from where we left off
    await db.refresh(project)
    start_chapter = project.current_chapter + 1
    if start_chapter > total_chapters:
        return  # already fully complete

    # Get the three phase rows
    prose_phase = await _get_phase(db, project.id, "prose_writer")
    continuity_phase = await _get_phase(db, project.id, "continuity_editor")
    literary_phase = await _get_phase(db, project.id, "literary_editor")
    if not prose_phase or not continuity_phase or not literary_phase:
        raise RuntimeError("Iterative phase rows missing from database")

    # Mark prose_writer running as the umbrella status for the entire loop
    prose_phase.status = PhaseStatus.running
    prose_phase.started_at = datetime.utcnow()
    await db.commit()

    for chapter_num in range(start_chapter, total_chapters + 1):
        if stop_event.is_set():
            return

        # Pause handling
        if not resume_event.is_set():
            await ws_manager.broadcast(project.id, ev.pipeline_paused(project.id, "prose_writer"))
            project.status = ProjectStatus.paused
            await db.commit()
            await resume_event.wait()
            project.status = ProjectStatus.running
            await db.commit()
            await ws_manager.broadcast(project.id, ev.pipeline_resumed(project.id))

        if stop_event.is_set():
            return

        chapter_start = datetime.utcnow()
        await ws_manager.broadcast(project.id, ev.chapter_started(project.id, chapter_num, total_chapters))

        # Write ephemeral routing artifacts (overwritten each chapter — intentional)
        beat = beats.get(chapter_num, {})
        await save_artifact(db, prose_phase.id, project.id, "current_chapter_beat", beat)

        # Load this chapter's scene outline (produced by scene_outliner loop)
        from app.services.artifact_service import get_active_artifact
        scene_art = await get_active_artifact(db, project.id, f"scene_outline_{chapter_num}")
        scene_data = scene_art.content_json if scene_art else {}
        await save_artifact(db, prose_phase.id, project.id, "current_scene_outline", scene_data)

        # Build prior chapter summaries for prose_writer and continuity_editor
        prior_summaries = await _build_prior_summaries(db, project.id, chapter_num)
        await save_artifact(db, prose_phase.id, project.id, "prior_prose_summaries", prior_summaries)

        # ── prose_writer ──
        await ws_manager.broadcast(project.id, ev.chapter_phase_progress(project.id, chapter_num, total_chapters, "prose_writer"))
        prose_phase.iteration = chapter_num
        await db.commit()
        prose_art = await _run_iterative_phase(db, project, prose_phase, chapter_num)
        if not prose_art:
            raise RuntimeError(f"Prose writer failed for chapter {chapter_num}")

        # Feed prose into continuity_editor as current_prose
        await save_artifact(db, prose_phase.id, project.id, "current_prose", prose_art.content_json)

        # ── continuity_editor ──
        await ws_manager.broadcast(project.id, ev.chapter_phase_progress(project.id, chapter_num, total_chapters, "continuity_editor"))
        continuity_phase.iteration = chapter_num
        await db.commit()
        continuity_art = await _run_iterative_phase(db, project, continuity_phase, chapter_num)
        if not continuity_art:
            raise RuntimeError(f"Continuity editor failed for chapter {chapter_num}")

        # Feed continuity report into literary_editor (it reads "continuity_report" key)
        await save_artifact(db, prose_phase.id, project.id, "continuity_report", continuity_art.content_json)

        # ── literary_editor ──
        await ws_manager.broadcast(project.id, ev.chapter_phase_progress(project.id, chapter_num, total_chapters, "literary_editor"))
        literary_phase.iteration = chapter_num
        await db.commit()
        literary_art = await _run_iterative_phase(db, project, literary_phase, chapter_num)
        if not literary_art:
            raise RuntimeError(f"Literary editor failed for chapter {chapter_num}")

        # Persist chapter completion
        project.current_chapter = chapter_num
        await db.commit()

        duration_ms = int((datetime.utcnow() - chapter_start).total_seconds() * 1000)
        await ws_manager.broadcast(project.id, ev.chapter_completed(project.id, chapter_num, total_chapters, duration_ms))

        # Respect co-pilot toggle: if user switched mode, pause before next chapter
        await db.refresh(project)
        if not project.auto_pilot and chapter_num < total_chapters:
            resume_event.clear()
            project.status = ProjectStatus.paused
            await db.commit()
            await ws_manager.broadcast(project.id, ev.pipeline_paused(project.id, "prose_writer"))

    # All chapters done — mark all three phases complete
    now = datetime.utcnow()
    for phase in [prose_phase, continuity_phase, literary_phase]:
        phase.status = PhaseStatus.complete
        phase.completed_at = now
    await db.commit()


async def _generate_and_wait_for_choice(
    db: AsyncSession,
    project: Project,
    phase: Phase,
    resume_event: asyncio.Event,
    stop_event: asyncio.Event,
) -> str | None:
    """Generate options via the agent, emit choice_ready WS event, wait for resolution."""
    from app.pipeline.phase_runner import AGENT_REGISTRY
    from app.agents.base_agent import AgentContext
    from app.services.artifact_service import get_all_active_artifacts
    import uuid

    # Mark phase as awaiting choice
    phase.status = PhaseStatus.awaiting_choice
    await db.commit()

    # Generate options
    agent_class = AGENT_REGISTRY.get(phase.phase_key)
    if not agent_class:
        return None

    agent = agent_class()
    all_artifacts = await get_all_active_artifacts(db, project.id)
    artifacts_dict = {a_type: art.content_json for a_type, art in all_artifacts.items()}

    _premise = project.initial_premise
    if project.sub_genre:
        _premise = f"[Sub-genre: {project.sub_genre}]\n{_premise}"

    if project.chapter_count:
        artifacts_dict['_chapter_count'] = project.chapter_count

    ctx = AgentContext(
        project_id=project.id,
        phase_id=phase.id,
        phase_key=phase.phase_key,
        premise=_premise,
        artifacts=artifacts_dict,
        iteration=phase.iteration,
    )

    try:
        options_response = await agent.stream_to_ws_and_db(
            db, ctx, agent.build_options_prompt(ctx), sequence_order=0
        )
        options = await agent.extract_options(options_response)
        if not options:
            options = [{"id": "A", "label": "Proceed with AI's judgment", "summary": "Let the AI make the best creative choice based on context.", "is_recommended": True}]
    except Exception as e:
        logger.error(f"Option generation failed for {phase.phase_key}: {e}")
        return None

    # Create PendingChoice record and emit WS event
    choice_id = str(uuid.uuid4())
    choice = PendingChoice(
        id=choice_id,
        project_id=project.id,
        phase_key=phase.phase_key,
        options_json=options,
        status=ChoiceStatus.pending,
    )
    db.add(choice)
    await db.commit()

    from app.ws import event_types as ev
    await ws_manager.broadcast(
        project.id,
        ev.choice_ready(project.id, phase.phase_key, choice_id, options),
    )

    # Wait for resolution
    while True:
        if stop_event.is_set():
            return None

        await db.refresh(choice)
        if choice.status == ChoiceStatus.resolved:
            if choice.chosen_custom_text:
                return choice.chosen_custom_text
            for opt in choice.options_json:
                if opt["id"] == choice.chosen_option_id:
                    return opt["summary"]
            return options[0]["summary"]

        await asyncio.sleep(0.5)
