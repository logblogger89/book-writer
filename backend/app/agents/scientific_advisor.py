import json

from app.agents.base_agent import AgentContext, BaseAgent


class ScientificAdvisor(BaseAgent):
    phase_key = "scientific_advisor"
    artifact_type = "science_notes"

    def build_system_prompt(self) -> str:
        return (
            "You are the Scientific Advisor in a collaborative AI sci-fi novel writing system. "
            "Your role is to add hard-science texture to the world without constraining the author's imagination. "
            "You NEVER veto creative choices — you enrich them. For every speculative technology or phenomenon, "
            "you find the real science closest to it, explain how it could plausibly work, and suggest "
            "ways the author can reference this to make readers feel the world is genuinely coherent. "
            "Think Kim Stanley Robinson meets Andy Weir. Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        world_doc = ctx.artifacts.get("world_doc", {})
        logline = ctx.artifacts.get("logline", {})
        direction = self._direction_block(ctx)
        return (
            f"LOGLINE:\n{json.dumps(logline, indent=2)}\n\n"
            f"WORLD DOCUMENT:\n{json.dumps(world_doc, indent=2)}\n"
            f"{direction}\n\n"
            "Produce science annotations as a JSON object:\n"
            "{\n"
            '  "technology_annotations": [\n'
            '    {\n'
            '      "tech_name": "name from world doc",\n'
            '      "real_science_basis": "closest real-world science",\n'
            '      "plausibility_rating": "hard/soft/speculative/fantasy",\n'
            '      "how_it_could_work": "brief mechanistic explanation",\n'
            '      "author_notes": "how to reference this naturally in prose",\n'
            '      "narrative_tensions": "scientific complications that could create story conflict"\n'
            '    }\n'
            '  ],\n'
            '  "world_physics_consistency": "Overall assessment of physical coherence",\n'
            '  "recommended_details": ["specific sensory/technical details to include in prose for authenticity"],\n'
            '  "scientific_plot_opportunities": ["science-based conflicts or revelations that could enrich the story"]\n'
            "}\n\n"
            "Be a creative collaborator, not a fact-checker."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"raw": full_response}
