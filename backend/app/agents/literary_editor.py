import json

from app.agents.base_agent import AgentContext, BaseAgent


class LiteraryEditor(BaseAgent):
    phase_key = "literary_editor"
    artifact_type = "edited_chapter"

    def build_system_prompt(self) -> str:
        return (
            "You are the Literary Editor in a collaborative AI sci-fi novel writing system. "
            "You are the final quality gate. You make targeted, surgical improvements to prose — "
            "you never rewrite for rewriting's sake. You improve rhythm, clarity, and resonance. "
            "You confirm thematic coherence with the novel's logline. "
            "For every change you suggest, you explain why. "
            "You preserve the voice — your job is to make the author sound more like themselves. "
            "You are the difference between a good sci-fi novel and a 5-star Goodreads review."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        logline = ctx.artifacts.get("logline", {})
        current_prose = ctx.artifacts.get("current_prose", {})
        continuity_report = ctx.artifacts.get("continuity_report", {})
        direction = self._direction_block(ctx)
        return (
            f"LOGLINE & THEMES:\n{json.dumps(logline, indent=2)}\n\n"
            f"CONTINUITY REPORT:\n{json.dumps(continuity_report, indent=2)}\n\n"
            f"PROSE TO EDIT:\n{json.dumps(current_prose, indent=2)}\n"
            f"{direction}\n\n"
            "Produce the edited chapter as JSON:\n"
            "{\n"
            '  "chapter_number": 0,\n'
            '  "edited_prose": "The full revised prose text",\n'
            '  "word_count": 0,\n'
            '  "editorial_notes": [\n'
            '    {"location": "...", "change": "what was changed", "reason": "why"}\n'
            '  ],\n'
            '  "thematic_alignment": "How well this chapter serves the novel\'s thematic pillars",\n'
            '  "quality_assessment": "One paragraph honest assessment"\n'
            "}\n\n"
            "The edited prose field should contain the complete, publish-ready chapter text. "
            "Address all critical continuity flags from the continuity report."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"edited_prose": full_response, "word_count": len(full_response.split()), "editorial_notes": [], "raw": full_response}
