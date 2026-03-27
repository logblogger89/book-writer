import json

from app.agents.base_agent import AgentContext, BaseAgent


class LoglineCreator(BaseAgent):
    phase_key = "logline_creator"
    artifact_type = "logline"

    def build_system_prompt(self) -> str:
        return (
            "You are the Logline Creator in a collaborative AI sci-fi novel writing system. "
            "Your job is to distill a user's premise into a razor-sharp, emotionally compelling logline "
            "and foundational creative framework. "
            "You write loglines worthy of the best sci-fi on Goodreads and Amazon — "
            "loglines that make readers instantly want to read the book. "
            "Output valid JSON only when asked for structured output."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        direction = self._direction_block(ctx)
        return (
            f"USER'S INITIAL PREMISE:\n{ctx.premise}\n"
            f"{direction}\n\n"
            "Produce a complete logline artifact as a JSON object with this structure:\n"
            "{\n"
            '  "logline": "A single 1-2 sentence logline (who wants what, why it\'s hard, what\'s at stake)",\n'
            '  "thematic_pillars": ["pillar 1", "pillar 2", "pillar 3"],\n'
            '  "central_conflict": "The core dramatic tension in one sentence",\n'
            '  "hook_elements": ["element that makes this unmissable 1", "element 2"],\n'
            '  "tone": "e.g. dark and cerebral / hopeful and action-packed / bittersweet and literary",\n'
            '  "comparable_titles": ["comp title 1 (reason)", "comp title 2 (reason)"]\n'
            "}\n\n"
            "Make it unforgettable. This logline sets the creative DNA for the entire novel."
        )

    def parse_artifact(self, full_response: str) -> dict:
        # Find JSON block
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"logline": full_response, "thematic_pillars": [], "central_conflict": "", "hook_elements": [], "tone": "", "comparable_titles": []}
