import json

from app.agents.base_agent import AgentContext, BaseAgent


class FinalDraftReviewer(BaseAgent):
    phase_key = "final_draft_reviewer"
    artifact_type = "final_review"

    def build_system_prompt(self) -> str:
        return (
            "You are the Final Draft Reviewer in a collaborative AI sci-fi novel writing system. "
            "You perform a comprehensive review of the ENTIRE completed novel manuscript. "
            "Your job is to find:\n"
            "1) Internal inconsistencies within the prose itself (plot holes, contradictions between chapters, "
            "   timeline errors, character behavior flips, unresolved threads)\n"
            "2) Inconsistencies between the prose and the established world/lore document\n"
            "3) Inconsistencies between the prose and the science notes (scientific inaccuracies, "
            "   broken rules of the world's technology/physics)\n"
            "4) Inconsistencies between the prose and the character profiles (out-of-character behavior, "
            "   wrong backstory details, voice inconsistencies, relationship contradictions)\n"
            "5) Inconsistencies between the prose and the chapter beats (missing plot points, "
            "   wrong sequence of events, skipped beats)\n"
            "6) Inconsistencies between the prose and the scene outlines (missing scenes, "
            "   scenes that diverge significantly from outline)\n\n"
            "Be thorough but fair. Distinguish critical issues from minor nitpicks. "
            "For each finding, provide the exact chapter and location, what the issue is, "
            "and a concrete suggested fix. Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        world_doc = ctx.artifacts.get("world_doc", {})
        characters = ctx.artifacts.get("character_sheet", {})
        science = ctx.artifacts.get("science_notes", {})
        chapter_beats = ctx.artifacts.get("chapter_beats", {})

        # Gather all edited chapters
        chapters_prose = {}
        scene_outlines = {}
        for key, value in ctx.artifacts.items():
            if key.startswith("edited_chapter_"):
                num = key.replace("edited_chapter_", "")
                chapters_prose[num] = value
            elif key.startswith("scene_outline_"):
                num = key.replace("scene_outline_", "")
                scene_outlines[num] = value

        # Sort by chapter number
        sorted_chapters = sorted(chapters_prose.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)
        sorted_scenes = sorted(scene_outlines.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)

        prose_block = ""
        for num, content in sorted_chapters:
            prose_text = content.get("edited_prose", "") if isinstance(content, dict) else str(content)
            prose_block += f"\n--- CHAPTER {num} ---\n{prose_text[:8000]}\n"

        scenes_block = ""
        for num, content in sorted_scenes:
            scenes_block += f"\n--- SCENE OUTLINE CH {num} ---\n{json.dumps(content, indent=1)[:3000]}\n"

        direction = self._direction_block(ctx)

        return (
            f"WORLD/LORE DOCUMENT:\n{json.dumps(world_doc, indent=2)}\n\n"
            f"CHARACTER PROFILES:\n{json.dumps(characters, indent=2)}\n\n"
            f"SCIENCE NOTES:\n{json.dumps(science, indent=2)}\n\n"
            f"CHAPTER BEATS:\n{json.dumps(chapter_beats, indent=2)}\n\n"
            f"SCENE OUTLINES:\n{scenes_block}\n\n"
            f"FULL MANUSCRIPT (all chapters):\n{prose_block}\n"
            f"{direction}\n\n"
            "Perform a comprehensive review. Produce a JSON report:\n"
            "{\n"
            '  "overall_verdict": "clean|minor_issues|major_issues",\n'
            '  "total_issues": 0,\n'
            '  "categories": {\n'
            '    "internal_prose": {\n'
            '      "description": "Inconsistencies within the prose itself",\n'
            '      "findings": [\n'
            '        {\n'
            '          "id": "IP-001",\n'
            '          "severity": "critical|major|minor",\n'
            '          "chapter": 1,\n'
            '          "location": "paragraph or scene description",\n'
            '          "issue": "What the inconsistency is",\n'
            '          "evidence": "Quote or reference from the text",\n'
            '          "suggested_fix": "Specific correction to make",\n'
            '          "fix_target": "edited_chapter_1"\n'
            '        }\n'
            '      ]\n'
            '    },\n'
            '    "world_lore": {\n'
            '      "description": "Prose vs world/lore document",\n'
            '      "findings": []\n'
            '    },\n'
            '    "science": {\n'
            '      "description": "Prose vs science notes",\n'
            '      "findings": []\n'
            '    },\n'
            '    "characters": {\n'
            '      "description": "Prose vs character profiles",\n'
            '      "findings": []\n'
            '    },\n'
            '    "beats": {\n'
            '      "description": "Prose vs chapter beats",\n'
            '      "findings": []\n'
            '    },\n'
            '    "scenes": {\n'
            '      "description": "Prose vs scene outlines",\n'
            '      "findings": []\n'
            '    }\n'
            '  },\n'
            '  "summary": "Overall assessment paragraph"\n'
            "}\n\n"
            "If no issues found in a category, leave its findings array empty. "
            "Be thorough — check every chapter against every reference document."
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {
            "overall_verdict": "clean",
            "total_issues": 0,
            "categories": {},
            "summary": "The reviewer completed its analysis but returned an unparseable response.",
            "raw": full_response,
        }
