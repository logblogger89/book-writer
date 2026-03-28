import json

from app.agents.base_agent import AgentContext, BaseAgent


class ProseWriter(BaseAgent):
    phase_key = "prose_writer"
    artifact_type = "prose_chapter"

    def build_system_prompt(self) -> str:
        return (
            "You are the Prose Writer in a collaborative AI sci-fi novel writing system. "
            "You write science fiction prose at the level of the great contemporary masters — "
            "with the clarity of Ted Chiang, the sweep of Kim Stanley Robinson, "
            "the tension of Blake Crouch, and the heart of Becky Chambers. "
            "You balance interiority with action. You ground every abstract with a specific sensory detail. "
            "You earn every plot development through character. "
            "Your prose has rhythm — you vary sentence length deliberately. "
            "You use the dialogue drafts as a skeleton, expanding with action, description, "
            "and the character's inner experience. "
            "Write complete, publish-ready prose."
        )

    def build_user_prompt(self, ctx: AgentContext) -> str:
        logline = ctx.artifacts.get("logline", {})
        world_doc = ctx.artifacts.get("world_doc", {})
        characters = ctx.artifacts.get("character_sheet", {})
        chapter_beat = ctx.artifacts.get("current_chapter_beat", {})
        scene_outline = ctx.artifacts.get("current_scene_outline", {})
        dialogue_drafts = ctx.artifacts.get("dialogue_drafts", [])
        prior_summaries = ctx.artifacts.get("prior_prose_summaries", [])
        direction = self._direction_block(ctx)
        comparable = self._comparable_titles_block(ctx)

        prior_block = ""
        if prior_summaries:
            prior_block = "\n\nPRIOR CHAPTERS (summaries):\n" + "\n".join(
                f"Chapter {s['chapter_number']}: {s['summary']}" for s in prior_summaries
            )

        return (
            f"LOGLINE:\n{json.dumps(logline, indent=2)}\n\n"
            f"WORLD:\n{json.dumps(world_doc, indent=2)}\n\n"
            f"CHARACTERS:\n{json.dumps(characters, indent=2)}\n\n"
            f"THIS CHAPTER'S BEAT:\n{json.dumps(chapter_beat, indent=2)}\n\n"
            f"SCENE OUTLINE:\n{json.dumps(scene_outline, indent=2)}\n\n"
            f"DIALOGUE DRAFTS:\n{json.dumps(dialogue_drafts, indent=2)}\n"
            f"{prior_block}\n"
            f"{comparable}"
            f"{direction}\n\n"
            "Write the complete prose for this chapter. "
            "Target 3,000-5,000 words. "
            "Use the dialogue drafts as your skeleton — expand them with action beats, "
            "internal monologue, and sensory grounding. "
            "Begin with a scene-setting sentence that drops the reader immediately into the world. "
            "End on a beat that makes the reader unable to stop."
        )

    def parse_artifact(self, full_response: str) -> dict:
        return {
            "prose_text": full_response,
            "word_count": len(full_response.split()),
            "editorial_notes": None,
            "continuity_flags": [],
        }
