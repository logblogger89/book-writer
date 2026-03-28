import json
import re

from app.agents.base_agent import AgentContext, BaseAgent


class ChapterBeatsCreator(BaseAgent):
    phase_key = "chapter_beats_creator"
    artifact_type = "chapter_beats"

    def build_system_prompt(self) -> str:
        return (
            "You are the Chapter Beats Creator in a collaborative AI sci-fi novel writing system. "
            "You architect novels with the precision of a master storyteller. "
            "You understand Save the Cat, the Hero's Journey, and Story by Robert McKee — "
            "but you don't follow them slavishly. You use structure to serve character. "
            "Every chapter beat must earn its place. Tension must build organically. "
            "The best sci-fi novels reviewed on Goodreads succeed because their plots are propulsive "
            "AND their characters' inner journeys are inseparable from the outer plot. "
            "Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        logline = ctx.artifacts.get("logline", {})
        world_doc = ctx.artifacts.get("world_doc", {})
        characters = ctx.artifacts.get("character_sheet", {})
        science = ctx.artifacts.get("science_notes", {})
        direction = self._direction_block(ctx)
        comparable = self._comparable_titles_block(ctx)
        return (
            f"LOGLINE:\n{json.dumps(logline, indent=2)}\n\n"
            f"WORLD:\n{json.dumps(world_doc, indent=2)}\n\n"
            f"CHARACTERS:\n{json.dumps(characters, indent=2)}\n\n"
            f"SCIENCE NOTES:\n{json.dumps(science, indent=2)}\n"
            f"{comparable}"
            f"{direction}\n\n"
            "Produce a complete novel structure as JSON:\n"
            "{\n"
            '  "total_chapters": 0,\n'
            '  "estimated_word_count": 0,\n'
            '  "acts": [\n'
            '    {\n'
            '      "act_number": 1,\n'
            '      "title": "...",\n'
            '      "purpose": "What this act accomplishes structurally and emotionally",\n'
            '      "chapters": [\n'
            '        {\n'
            '          "chapter_number": 1,\n'
            '          "title": "...",\n'
            '          "beat": "2-3 sentence description of what happens and why it matters",\n'
            '          "pov_character_id": "char_001",\n'
            '          "tension_level": 5,\n'
            '          "emotional_shift": "Character starts feeling X, ends feeling Y",\n'
            '          "key_revelations": ["plot or character revelation in this chapter"],\n'
            '          "thematic_thread": "Which thematic pillar this chapter advances"\n'
            '        }\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            f"{self._chapter_target_line(ctx)}"
            "Tension levels should build across acts (not uniformly — use valleys for breath and weight). "
            "Every character's arc inflection points must be visible in specific chapters."
        )

    def _chapter_target_line(self, ctx: AgentContext) -> str:
        count = ctx.artifacts.get("_chapter_count")
        if count:
            return (
                f"You MUST produce EXACTLY {count} chapters total across 3 acts. "
                f"Do not produce more or fewer than {count} chapters — this is a hard requirement. "
            )
        return "Target 20-30 chapters across 3 acts. "

    def parse_artifact(self, full_response: str) -> dict:
        # Strip markdown code fences
        text = re.sub(r'```(?:json)?\s*', '', full_response).strip()
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try brace-extraction
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
        return {"acts": [], "raw": full_response}
