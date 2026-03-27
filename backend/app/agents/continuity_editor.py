import json

from app.agents.base_agent import AgentContext, BaseAgent


class ContinuityEditor(BaseAgent):
    phase_key = "continuity_editor"
    artifact_type = "continuity_report"

    def build_system_prompt(self) -> str:
        return (
            "You are the Continuity Editor in a collaborative AI sci-fi novel writing system. "
            "You are the guardian of internal consistency. You catch: "
            "character behavior that contradicts established psychology, "
            "world-rule violations, timeline errors, "
            "characters knowing things they couldn't yet know, "
            "unresolved plot threads, and factual inconsistencies. "
            "You are rigorous but not pedantic — you distinguish critical breaks from minor slips. "
            "You provide specific, actionable fixes. Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        world_doc = ctx.artifacts.get("world_doc", {})
        characters = ctx.artifacts.get("character_sheet", {})
        chapter_beats = ctx.artifacts.get("chapter_beats", {})
        current_prose = ctx.artifacts.get("current_prose", {})
        prior_prose = ctx.artifacts.get("prior_prose_summaries", [])
        direction = self._direction_block(ctx)
        return (
            f"WORLD RULES:\n{json.dumps(world_doc, indent=2)}\n\n"
            f"CHARACTERS:\n{json.dumps(characters, indent=2)}\n\n"
            f"STORY BEATS:\n{json.dumps(chapter_beats, indent=2)}\n\n"
            f"CURRENT CHAPTER PROSE:\n{json.dumps(current_prose, indent=2)}\n\n"
            f"PRIOR CHAPTERS:\n{json.dumps(prior_prose, indent=2)}\n"
            f"{direction}\n\n"
            "Produce a continuity report as JSON:\n"
            "{\n"
            '  "chapter_number": 0,\n'
            '  "overall_verdict": "pass|minor_issues|major_issues",\n'
            '  "flags": [\n'
            '    {\n'
            '      "type": "character|world_rule|timeline|knowledge|plot_thread|other",\n'
            '      "severity": "critical|minor",\n'
            '      "location": "paragraph/scene description",\n'
            '      "description": "What the issue is",\n'
            '      "suggested_fix": "Specific proposed correction"\n'
            '    }\n'
            '  ],\n'
            '  "unresolved_threads": ["plot threads opened but not yet resolved"],\n'
            '  "continuity_summary": "One paragraph summary of the chapter\'s consistency"\n'
            "}\n\n"
            "If overall_verdict is 'pass', the prose_writer output can proceed to literary editing."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"overall_verdict": "pass", "flags": [], "raw": full_response}
