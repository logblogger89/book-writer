import json

from app.agents.base_agent import AgentContext, BaseAgent


class WorldBuilder(BaseAgent):
    phase_key = "world_builder"
    artifact_type = "world_doc"

    def build_system_prompt(self) -> str:
        return (
            "You are the World Builder in a collaborative AI sci-fi novel writing system. "
            "You create immersive, internally consistent science fiction universes that feel "
            "utterly real — the kind reviewers on Goodreads call 'richly imagined' and 'unlike anything else.' "
            "Every element of your world must serve the story's thematic pillars. "
            "Ground technology and society in cause-and-effect logic. "
            "Output valid JSON only when producing structured output."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        logline = ctx.artifacts.get("logline", {})
        direction = self._direction_block(ctx)
        comparable = self._comparable_titles_block(ctx)
        return (
            f"LOGLINE & CREATIVE FRAMEWORK:\n{json.dumps(logline, indent=2)}\n"
            f"{comparable}"
            f"{direction}\n\n"
            "Build a complete world document as a JSON object:\n"
            "{\n"
            '  "world_name": "...",\n'
            '  "era": "e.g. 2387 CE / post-Collapse year 142",\n'
            '  "elevator_pitch": "This world in 2-3 sentences",\n'
            '  "core_technologies": [\n'
            '    {"name": "...", "description": "...", "narrative_purpose": "why this tech matters to the story"}\n'
            '  ],\n'
            '  "social_structure": "Detailed description of how society is organized",\n'
            '  "factions": [\n'
            '    {"name": "...", "ideology": "...", "power_base": "...", "relationship_to_protagonist": "..."}\n'
            '  ],\n'
            '  "history_timeline": [\n'
            '    {"year": "...", "event": "...", "significance": "why this shaped the present"}\n'
            '  ],\n'
            '  "physical_laws": ["any deviations from real physics and their rules"],\n'
            '  "key_locations": [\n'
            '    {"name": "...", "description": "...", "atmosphere": "...", "story_role": "..."}\n'
            '  ],\n'
            '  "daily_life": "What ordinary people experience day to day",\n'
            '  "central_tension": "The world-level conflict that the novel\'s story emerges from"\n'
            "}\n\n"
            "Make every detail feel earned and specific. Avoid generic sci-fi tropes unless you subvert them.\n\n"
            "NAMING: Do NOT use generic sci-fi naming patterns — no 'The Alliance', 'Nexus Corp', 'New Earth', "
            "'The Federation', 'Terra Nova', 'The Collective'. World names, faction names, and location names "
            "must feel culturally and linguistically native to this specific world's history, dominant language "
            "roots, and social evolution. Names should be pronounceable but unmistakably belong to this world alone."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"world_name": "Unknown", "raw": full_response}
