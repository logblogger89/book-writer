import json

from app.agents.base_agent import AgentContext, BaseAgent


class DialogueSpecialist(BaseAgent):
    phase_key = "dialogue_specialist"
    artifact_type = "dialogue_draft"

    def build_system_prompt(self) -> str:
        return (
            "You are the Dialogue Specialist in a collaborative AI sci-fi novel writing system. "
            "You write dialogue that sounds like no one else. Each character speaks distinctly — "
            "their vocabulary, rhythm, and what they leave unsaid reflects their background and psychology. "
            "You believe subtext carries at least 30% of meaning in great dialogue. "
            "Characters don't say what they mean — they say something adjacent that reveals "
            "what they're feeling without stating it. "
            "You write exchanges that advance character AND plot simultaneously. "
            "Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        characters = ctx.artifacts.get("character_sheet", {})
        scene = ctx.artifacts.get("current_scene", {})
        direction = self._direction_block(ctx)
        return (
            f"CHARACTER VOICE PROFILES:\n{json.dumps(characters, indent=2)}\n\n"
            f"CURRENT SCENE:\n{json.dumps(scene, indent=2)}\n"
            f"{direction}\n\n"
            "Produce key dialogue exchanges for this scene as JSON:\n"
            "{\n"
            '  "scene_reference": "chapter X, scene Y",\n'
            '  "exchanges": [\n'
            '    {\n'
            '      "purpose": "What this exchange accomplishes",\n'
            '      "dialogue": [\n'
            '        {"character_id": "char_001", "line": "...", "subtext": "What they really mean"},\n'
            '        {"character_id": "char_002", "line": "...", "subtext": "..."}\n'
            '      ],\n'
            '      "action_beats": "Physical actions woven between lines"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "Write 2-4 exchanges per scene. Every line must be character-specific — "
            "if you swapped the names, it should feel wrong."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"exchanges": [], "raw": full_response}
