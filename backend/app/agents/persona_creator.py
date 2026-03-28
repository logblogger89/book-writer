import json
import re

from app.agents.base_agent import AgentContext, BaseAgent


class PersonaCreator(BaseAgent):
    phase_key = "persona_creator"
    artifact_type = "character_sheet"

    def build_system_prompt(self) -> str:
        return (
            "You are the Persona Creator in a collaborative AI sci-fi novel writing system. "
            "You create characters so vivid they feel like real people readers will remember for years. "
            "Every character is a product of the specific world they inhabit — their beliefs, speech, "
            "and wounds are shaped by that world's society, history, and technology. "
            "Characters have contradictions. Their arcs are earned, not generic. "
            "Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        logline = ctx.artifacts.get("logline", {})
        world_doc = ctx.artifacts.get("world_doc", {})
        direction = self._direction_block(ctx)
        comparable = self._comparable_titles_block(ctx)
        return (
            f"LOGLINE:\n{json.dumps(logline, indent=2)}\n\n"
            f"WORLD DOCUMENT:\n{json.dumps(world_doc, indent=2)}\n"
            f"{comparable}"
            f"{direction}\n\n"
            "Create a full character roster as a JSON object:\n"
            "{\n"
            '  "characters": [\n'
            '    {\n'
            '      "id": "char_001",\n'
            '      "name": "...",\n'
            '      "role": "protagonist|antagonist|supporting|minor",\n'
            '      "age": 0,\n'
            '      "occupation": "...",\n'
            '      "faction_affiliation": "...",\n'
            '      "background": "3-4 sentences on formative experiences",\n'
            '      "core_wound": "The deep hurt driving their behavior",\n'
            '      "motivation": "What they want and why",\n'
            '      "fear": "What they are most afraid of losing or becoming",\n'
            '      "arc": "Where they start emotionally vs. where they end",\n'
            '      "contradictions": ["believable internal contradictions"],\n'
            '      "voice_profile": {\n'
            '        "speech_style": "e.g. clipped and precise / flowery and evasive",\n'
            '        "vocabulary_level": "e.g. technical / colloquial / archaic",\n'
            '        "verbal_tics": ["phrases or patterns unique to this character"],\n'
            '        "emotional_register": "how emotion leaks into their speech"\n'
            '      },\n'
            '      "physical_description": "Specific, memorable, not generic",\n'
            '      "relationships": {"Exact Character Name": "how this character relates to them"}\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "Create 1 protagonist, 1 antagonist, and 3-4 supporting characters. "
            "Make the antagonist genuinely understandable — their worldview should be coherent, "
            "even if wrong. The best sci-fi antagonists believe they are the hero.\n\n"
            "IMPORTANT: Character names MUST feel culturally and linguistically native to "
            "the specific world described above — derived from its society, dominant cultures, "
            "history, and technology level. "
            "Explicitly banned name patterns: 'Elias', 'Elara', 'Kira', 'Zara', 'Ren', 'Jax', "
            "'Thorne', 'Kane', 'Vasquez', 'Carter', 'Nova', 'Lyra', 'Orion'. "
            "Draw from real non-Western naming traditions (Yoruba, Bengali, Quechua, Kazakh, Malay, "
            "Hausa, Tamil, etc.) OR invent names that sound native to this world's specific society. "
            "Every name should feel like it could only belong to someone from THIS world."
        )

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
        return {"characters": [], "raw": full_response}
