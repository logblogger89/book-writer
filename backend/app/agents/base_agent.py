"""Abstract base class for all expert agents."""

import asyncio
import json
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import AsyncGenerator

import anthropic as anthropic_sdk
from google import genai
from google.genai import types as genai_types
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.db_models import ExpertMessage, MessageRole
from app.ws import event_types as ev
from app.ws.connection_manager import manager as ws_manager

logger = logging.getLogger(__name__)

gemini_client = genai.Client(api_key=settings.gemini_api_key)
anthropic_client = anthropic_sdk.AsyncAnthropic(api_key=settings.anthropic_api_key)


class AgentContext:
    """Holds all inputs an agent needs to run."""

    def __init__(
        self,
        project_id: str,
        phase_id: str,
        phase_key: str,
        premise: str,
        artifacts: dict,
        chosen_direction: str | None = None,
        interrupt_message: str | None = None,
        rollback_context: str | None = None,
        previous_artifact_summary: str | None = None,
        iteration: int = 1,
    ):
        self.project_id = project_id
        self.phase_id = phase_id
        self.phase_key = phase_key
        self.premise = premise
        self.artifacts = artifacts
        self.chosen_direction = chosen_direction
        self.interrupt_message = interrupt_message
        self.rollback_context = rollback_context
        self.previous_artifact_summary = previous_artifact_summary
        self.iteration = iteration


class BaseAgent(ABC):
    phase_key: str = ""
    artifact_type: str = ""

    def __init__(self):
        self.model = settings.agent_models.get(self.phase_key, "gemini-3.1-pro-preview")
        self.model_override: str | None = None
        self.provider_override: str | None = None

    @property
    def effective_model(self) -> str:
        return self.model_override or self.model

    @property
    def effective_provider(self) -> str:
        if self.provider_override:
            return self.provider_override
        return "anthropic" if self.effective_model.startswith("claude") else "gemini"

    @abstractmethod
    def build_system_prompt(self) -> str:
        pass

    @abstractmethod
    def build_user_prompt(self, ctx: AgentContext) -> str:
        pass

    @abstractmethod
    def parse_artifact(self, full_response: str) -> dict:
        pass

    def build_options_prompt(self, ctx: AgentContext) -> str:
        """Builds a prompt asking for 3 creative options only (no full output)."""
        return (
            f"PREMISE:\n{ctx.premise}\n\n"
            f"EXISTING CONTEXT:\n{json.dumps(ctx.artifacts, indent=2)}\n"
            + self._direction_block(ctx)
            + "\n\n---\n"
            "Generate exactly 3 creative options for this phase. "
            "Format as a JSON array between <OPTIONS> and </OPTIONS> tags:\n"
            "<OPTIONS>\n"
            "[\n"
            '  {"id": "A", "label": "Short title", "summary": "2-3 sentence creative direction", "is_recommended": true},\n'
            '  {"id": "B", "label": "Short title", "summary": "2-3 sentence creative direction", "is_recommended": false},\n'
            '  {"id": "C", "label": "Short title", "summary": "2-3 sentence creative direction", "is_recommended": false}\n'
            "]\n"
            "</OPTIONS>\n\n"
            "Only output the OPTIONS block — no full artifact yet."
        )

    async def _stream_gemini(self, prompt: str, system: str) -> AsyncGenerator[str, None]:
        """Async generator yielding text chunks from Gemini."""
        stream = await gemini_client.aio.models.generate_content_stream(
            model=self.effective_model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=8096,
            ),
        )
        async for chunk in stream:
            for part in (chunk.candidates[0].content.parts if chunk.candidates else []):
                if not part.text or getattr(part, "thought", False):
                    continue
                yield part.text

    async def _stream_anthropic(self, prompt: str, system: str) -> AsyncGenerator[str, None]:
        """Async generator yielding text chunks from Anthropic Claude."""
        async with anthropic_client.messages.stream(
            model=self.effective_model,
            max_tokens=8096,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def stream_to_ws_and_db(
        self,
        db: AsyncSession,
        ctx: AgentContext,
        prompt: str,
        sequence_order: int = 0,
        system_override: str | None = None,
    ) -> str:
        """Stream response from the configured provider, emit WS events, save to DB. Returns full content."""
        message_id = str(uuid.uuid4())
        system = system_override or self.build_system_prompt()
        full_content = ""

        max_retries = 5
        for attempt in range(max_retries):
            try:
                if self.effective_provider == "anthropic":
                    async for text in self._stream_anthropic(prompt, system):
                        full_content += text
                        await ws_manager.broadcast(
                            ctx.project_id,
                            ev.stream_chunk(ctx.project_id, ctx.phase_key, text, message_id),
                        )
                else:
                    async for text in self._stream_gemini(prompt, system):
                        full_content += text
                        await ws_manager.broadcast(
                            ctx.project_id,
                            ev.stream_chunk(ctx.project_id, ctx.phase_key, text, message_id),
                        )
                break  # success — exit retry loop
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = (
                    isinstance(e, anthropic_sdk.RateLimitError)
                    or "429" in str(e)
                    or "quota" in err_str
                    or "resource exhausted" in err_str
                    or "rate" in err_str
                    or "overloaded" in err_str
                )
                if not is_rate_limit or attempt >= max_retries - 1:
                    logger.error(f"API error in {self.phase_key} ({self.effective_provider}/{self.effective_model}): {e}")
                    raise
                # Extract retry-after or default to 60s
                retry_after = 60
                try:
                    import re
                    match = re.search(r"retry.after[\"'\s:]+(\d+)", str(e), re.IGNORECASE)
                    if match:
                        retry_after = int(match.group(1))
                except Exception:
                    pass
                logger.warning(f"Rate limit hit in {self.phase_key}, waiting {retry_after}s (attempt {attempt + 1}/{max_retries})")
                await ws_manager.broadcast(
                    ctx.project_id,
                    ev.rate_limit_waiting(ctx.project_id, ctx.phase_key, retry_after),
                )
                await asyncio.sleep(retry_after)
                await ws_manager.broadcast(
                    ctx.project_id,
                    ev.rate_limit_resumed(ctx.project_id, ctx.phase_key),
                )
                # Reset for clean retry
                full_content = ""
                message_id = str(uuid.uuid4())

        await ws_manager.broadcast(
            ctx.project_id,
            ev.stream_end(ctx.project_id, ctx.phase_key, message_id, full_content),
        )

        msg = ExpertMessage(
            phase_id=ctx.phase_id,
            role=MessageRole.agent,
            content=full_content,
            sequence_order=sequence_order,
        )
        db.add(msg)
        await db.flush()

        return full_content

    async def extract_options(self, response_text: str) -> list[dict] | None:
        start = response_text.find("<OPTIONS>")
        end = response_text.find("</OPTIONS>")
        if start == -1 or end == -1:
            return None
        json_str = response_text[start + len("<OPTIONS>"):end].strip()
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return None

    def _direction_block(self, ctx: AgentContext) -> str:
        parts = []
        if ctx.rollback_context:
            parts.append(
                f"\n\nROLLBACK CONTEXT — This phase is being re-run with new user direction:\n"
                f'"{ctx.rollback_context}"\n'
                "Do NOT simply reproduce your previous output. Build something meaningfully different."
            )
            if ctx.previous_artifact_summary:
                parts.append(f"\nPrevious output (for reference only):\n{ctx.previous_artifact_summary}")
        if ctx.chosen_direction and ctx.chosen_direction not in ("NEEDS_OPTIONS", "AI_AUTOPILOT"):
            parts.append(
                f"\n\nCREATIVE DIRECTION (USER SELECTED):\n"
                f'"{ctx.chosen_direction}"\n'
                "Incorporate this as the central premise of your output."
            )
        if ctx.interrupt_message:
            parts.append(
                f"\n\nUSER INTERRUPT — Incorporate before completing your output:\n"
                f'"{ctx.interrupt_message}"'
            )
        return "".join(parts)
