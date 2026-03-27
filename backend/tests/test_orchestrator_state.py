"""
Unit tests for orchestrator state management:
  - _active_tasks tracking
  - is_active()
  - pause_pipeline / resume_pipeline event semantics
  - stop_pipeline unblocks resume waits
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers to reset module-level state between tests
# ---------------------------------------------------------------------------

def reset_orchestrator():
    """Clear all in-memory state in the orchestrator module."""
    from app.pipeline import orchestrator as orch
    orch._pause_events.clear()
    orch._stop_events.clear()
    orch._active_tasks.clear()


@pytest.fixture(autouse=True)
def clean_state():
    reset_orchestrator()
    yield
    reset_orchestrator()


# ---------------------------------------------------------------------------
# is_active / _active_tasks
# ---------------------------------------------------------------------------

class TestIsActive:
    def test_inactive_by_default(self):
        from app.pipeline import orchestrator as orch
        assert orch.is_active("proj-1") is False

    def test_active_after_add(self):
        from app.pipeline import orchestrator as orch
        orch._active_tasks.add("proj-1")
        assert orch.is_active("proj-1") is True

    def test_inactive_after_discard(self):
        from app.pipeline import orchestrator as orch
        orch._active_tasks.add("proj-1")
        orch._active_tasks.discard("proj-1")
        assert orch.is_active("proj-1") is False

    def test_multiple_projects_independent(self):
        from app.pipeline import orchestrator as orch
        orch._active_tasks.add("proj-1")
        assert orch.is_active("proj-1") is True
        assert orch.is_active("proj-2") is False

    @pytest.mark.asyncio
    async def test_run_pipeline_marks_active_then_clears(self):
        """run_pipeline should add to _active_tasks and remove when done."""
        from app.pipeline import orchestrator as orch

        calls = []

        async def fake_inner(project_id, start_from, rollback_context):
            calls.append(("inner_start", project_id))
            assert orch.is_active(project_id), "Should be active during run"
            calls.append(("inner_end", project_id))

        with patch.object(orch, "_run_pipeline_inner", side_effect=fake_inner):
            await orch.run_pipeline("proj-1")

        assert ("inner_start", "proj-1") in calls
        assert orch.is_active("proj-1") is False, "Should be inactive after completion"

    @pytest.mark.asyncio
    async def test_run_pipeline_clears_active_on_exception(self):
        """Even if _run_pipeline_inner raises, _active_tasks should be cleaned up."""
        from app.pipeline import orchestrator as orch

        async def boom(project_id, start_from, rollback_context):
            raise RuntimeError("simulated crash")

        with patch.object(orch, "_run_pipeline_inner", side_effect=boom):
            with pytest.raises(RuntimeError):
                await orch.run_pipeline("proj-crash")

        assert orch.is_active("proj-crash") is False


# ---------------------------------------------------------------------------
# pause_pipeline / resume_pipeline
# ---------------------------------------------------------------------------

class TestPauseResume:
    def test_resume_event_set_by_default(self):
        from app.pipeline import orchestrator as orch
        event = orch._get_resume_event("proj-1")
        assert event.is_set(), "Resume event should be set (not paused) by default"

    def test_pause_clears_event(self):
        from app.pipeline import orchestrator as orch
        orch.pause_pipeline("proj-1")
        assert not orch._get_resume_event("proj-1").is_set()

    def test_resume_sets_event(self):
        from app.pipeline import orchestrator as orch
        orch.pause_pipeline("proj-1")
        orch.resume_pipeline("proj-1")
        assert orch._get_resume_event("proj-1").is_set()

    def test_pause_idempotent(self):
        from app.pipeline import orchestrator as orch
        orch.pause_pipeline("proj-1")
        orch.pause_pipeline("proj-1")
        assert not orch._get_resume_event("proj-1").is_set()

    def test_resume_idempotent(self):
        from app.pipeline import orchestrator as orch
        orch.resume_pipeline("proj-1")
        orch.resume_pipeline("proj-1")
        assert orch._get_resume_event("proj-1").is_set()

    def test_projects_have_independent_events(self):
        from app.pipeline import orchestrator as orch
        orch.pause_pipeline("proj-1")
        assert not orch._get_resume_event("proj-1").is_set()
        assert orch._get_resume_event("proj-2").is_set()


# ---------------------------------------------------------------------------
# stop_pipeline
# ---------------------------------------------------------------------------

class TestStopPipeline:
    def test_stop_sets_stop_event(self):
        from app.pipeline import orchestrator as orch
        orch.stop_pipeline("proj-1")
        assert orch._get_stop_event("proj-1").is_set()

    def test_stop_also_resumes_so_paused_task_can_exit(self):
        """stop_pipeline must set the resume event so a waiting coroutine can unblock."""
        from app.pipeline import orchestrator as orch
        orch.pause_pipeline("proj-1")
        assert not orch._get_resume_event("proj-1").is_set()
        orch.stop_pipeline("proj-1")
        assert orch._get_resume_event("proj-1").is_set(), "Stop must unblock any waiting resume"

    @pytest.mark.asyncio
    async def test_stop_event_clear_on_new_run(self):
        """run_pipeline resets the stop event at the start of a new run."""
        from app.pipeline import orchestrator as orch

        # Pre-set the stop event (simulating a previous stopped run)
        orch._get_stop_event("proj-1").set()

        recorded = {}

        async def fake_inner(project_id, start_from, rollback_context):
            recorded["stop_was_set"] = orch._get_stop_event(project_id).is_set()

        with patch.object(orch, "_run_pipeline_inner", side_effect=fake_inner):
            await orch.run_pipeline("proj-1")

        assert recorded.get("stop_was_set") is False, "Stop event should be cleared at start of new run"


# ---------------------------------------------------------------------------
# _active_tasks concurrent safety (basic)
# ---------------------------------------------------------------------------

class TestConcurrentProjects:
    @pytest.mark.asyncio
    async def test_two_projects_run_independently(self):
        from app.pipeline import orchestrator as orch

        results = {}

        async def fake_inner(project_id, start_from, rollback_context):
            results[project_id] = orch.is_active(project_id)
            await asyncio.sleep(0)  # yield

        with patch.object(orch, "_run_pipeline_inner", side_effect=fake_inner):
            await asyncio.gather(
                orch.run_pipeline("proj-A"),
                orch.run_pipeline("proj-B"),
            )

        assert results["proj-A"] is True
        assert results["proj-B"] is True
        assert not orch.is_active("proj-A")
        assert not orch.is_active("proj-B")
