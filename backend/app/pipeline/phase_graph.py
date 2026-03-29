"""DAG definition for the novel-writing pipeline."""

from collections import deque

# All phases in topological order
PHASE_ORDER = [
    "logline_creator",
    "world_builder",
    "scientific_advisor",
    "persona_creator",
    "chapter_beats_creator",
    "scene_outliner",
    "prose_writer",
    "continuity_editor",
    "literary_editor",
    "final_draft_reviewer",
]

# Direct dependencies for each phase
PHASE_DEPENDENCIES: dict[str, list[str]] = {
    "logline_creator": [],
    "world_builder": ["logline_creator"],
    "scientific_advisor": ["world_builder"],
    "persona_creator": ["world_builder"],
    "chapter_beats_creator": ["persona_creator", "scientific_advisor"],
    "scene_outliner": ["chapter_beats_creator"],
    "prose_writer": ["scene_outliner"],
    "continuity_editor": ["prose_writer"],
    "literary_editor": ["continuity_editor"],
    "final_draft_reviewer": ["literary_editor"],
}

# Human-readable display names
PHASE_DISPLAY_NAMES: dict[str, str] = {
    "logline_creator": "Logline Creator",
    "world_builder": "World Builder",
    "scientific_advisor": "Scientific Advisor",
    "persona_creator": "Persona Creator",
    "chapter_beats_creator": "Chapter Beats",
    "scene_outliner": "Scene Outliner",
    "prose_writer": "Prose Writer",
    "continuity_editor": "Continuity Editor",
    "literary_editor": "Literary Editor",
    "final_draft_reviewer": "Draft Reviewer",
}

# Phases that run iteratively (per chapter)
ITERATIVE_PHASES = {"prose_writer", "continuity_editor", "literary_editor"}

# Phases that run on-demand (not part of the automatic pipeline)
ON_DEMAND_PHASES = {"final_draft_reviewer"}


def get_ready_phases(completed: set[str], running: set[str]) -> list[str]:
    """Return phases whose dependencies are all complete and aren't already running/done."""
    ready = []
    for phase in PHASE_ORDER:
        if phase in completed or phase in running:
            continue
        deps = PHASE_DEPENDENCIES[phase]
        if all(d in completed for d in deps):
            ready.append(phase)
    return ready


def get_downstream_phases(from_phase: str) -> list[str]:
    """Return all phases that transitively depend on from_phase (BFS), excluding from_phase itself."""
    downstream = []
    visited = set()
    queue = deque([from_phase])
    while queue:
        current = queue.popleft()
        for phase, deps in PHASE_DEPENDENCIES.items():
            if current in deps and phase not in visited:
                visited.add(phase)
                downstream.append(phase)
                queue.append(phase)
    return downstream


def get_parallel_groups() -> list[list[str]]:
    """Return phases grouped by execution wave (all phases in a group can run in parallel)."""
    completed: set[str] = set()
    groups = []
    remaining = list(PHASE_ORDER)
    while remaining:
        wave = [p for p in remaining if all(d in completed for d in PHASE_DEPENDENCIES[p])]
        if not wave:
            break
        groups.append(wave)
        for p in wave:
            completed.add(p)
            remaining.remove(p)
    return groups
