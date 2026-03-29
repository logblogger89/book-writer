import json

from app.agents.base_agent import AgentContext, BaseAgent


class AutoFixer(BaseAgent):
    phase_key = "final_draft_reviewer"
    artifact_type = "auto_fix_result"

    def build_system_prompt(self) -> str:
        return (
            "You are the Auto-Fix Editor in a collaborative AI sci-fi novel writing system. "
            "You receive a chapter's prose along with a list of specific issues found by the reviewer. "
            "Your job is to apply the suggested fixes to the prose, making minimal changes — "
            "only fix what is flagged, do not rewrite or restyle anything else. "
            "Preserve the author's voice, style, and all content that is not flagged. "
            "Output valid JSON."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        chapter_num = ctx.artifacts.get("_fix_chapter_num", 1)
        original_prose = ctx.artifacts.get("_fix_original_prose", "")
        findings = ctx.artifacts.get("_fix_findings", [])
        direction = self._direction_block(ctx)

        return (
            f"CHAPTER {chapter_num} — ORIGINAL PROSE:\n{original_prose}\n\n"
            f"ISSUES TO FIX:\n{json.dumps(findings, indent=2)}\n"
            f"{direction}\n\n"
            "Apply ONLY the listed fixes. Output JSON:\n"
            "{\n"
            '  "chapter_number": ' + str(chapter_num) + ',\n'
            '  "edited_prose": "the full chapter text with fixes applied",\n'
            '  "fixes_applied": [\n'
            '    {\n'
            '      "id": "the finding id (e.g. IP-001)",\n'
            '      "status": "fixed|skipped",\n'
            '      "note": "brief description of what was changed or why skipped"\n'
            '    }\n'
            '  ],\n'
            '  "word_count": 0\n'
            "}"
        )

    def parse_artifact(self, full_response: str) -> dict:
        start = full_response.find("{")
        end = full_response.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(full_response[start:end])
            except json.JSONDecodeError:
                pass
        return {"edited_prose": full_response, "fixes_applied": [], "raw": full_response}
