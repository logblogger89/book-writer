import json

from app.agents.base_agent import AgentContext, BaseAgent


class SceneOutliner(BaseAgent):
    phase_key = "scene_outliner"
    artifact_type = "scene_outline"

    def build_system_prompt(self) -> str:
        return (
            "You are the Scene Outliner in a collaborative AI sci-fi novel writing system. "
            "You break chapters into granular, actable scenes. "
            "Each scene has a clear goal, a conflict that prevents easy achievement, "
            "and an outcome that changes the story's state — however slightly. "
            "Scenes must flow: each scene's ending sets up the next scene's starting condition. "
            "You track emotional state changes and character knowledge carefully. "
            "Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        world_doc = ctx.artifacts.get("world_doc", {})
        characters = ctx.artifacts.get("character_sheet", {})
        chapter_beat = ctx.artifacts.get("current_chapter_beat", {})
        chapter_number = chapter_beat.get("chapter_number", ctx.iteration)
        direction = self._direction_block(ctx)
        return (
            f"CHAPTER {chapter_number} BEAT:\n{json.dumps(chapter_beat, indent=2)}\n\n"
            f"WORLD:\n{json.dumps(world_doc, indent=2)}\n\n"
            f"CHARACTERS:\n{json.dumps(characters, indent=2)}\n"
            f"{direction}\n\n"
            f"Produce a scene outline for Chapter {chapter_number} ONLY as JSON:\n"
            "{\n"
            '  "chapters": [\n'
            '    {\n'
            f'      "chapter_number": {chapter_number},\n'
            '      "scenes": [\n'
            '        {\n'
            '          "scene_number": 1,\n'
            '          "location": "location name from world doc",\n'
            '          "time_of_day": "...",\n'
            '          "pov_character_id": "char_001",\n'
            '          "characters_present": ["char_001", "char_002"],\n'
            '          "scene_goal": "What the POV character is trying to achieve",\n'
            '          "conflict": "What prevents easy achievement",\n'
            '          "outcome": "How the scene ends — state change",\n'
            '          "emotional_arc": "POV character emotion: start -> end",\n'
            '          "dialogue_notes": "Key exchanges needed, referencing voice profiles",\n'
            '          "sensory_anchors": ["specific sensory details to ground the scene"],\n'
            '          "estimated_word_count": 1200\n'
            '        }\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "This chapter should have 2-5 scenes. "
            "Confirm scene outcomes logically connect to the next scene's starting condition."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"chapters": [], "raw": full_response}
