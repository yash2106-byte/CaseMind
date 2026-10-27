"""
OpenRouter provider for free AI models (e.g. LLaMA 3.3 70B, Gemini 2.0 Flash Exp, DeepSeek R1).
Uses httpx to connect to OpenRouter's OpenAI-compatible completions API.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class OpenRouterProvider(BaseProvider):
    """
    AI provider backed by OpenRouter free AI models.
    Supports meta-llama/llama-3.3-70b-instruct:free, google/gemini-2.0-flash-exp:free,
    mistralai/mistral-7b-instruct:free, deepseek/deepseek-r1:free, etc.
    """

    def __init__(self) -> None:
        self.api_key = settings.effective_api_key
        self.model = settings.ai_model or "nvidia/nemotron-3-ultra-550b-a55b:free"
        self.base_url = settings.openrouter_base_url.rstrip("/")
        self.timeout = float(settings.ai_request_timeout_seconds)

        if not self.api_key:
            logger.warning(
                "OpenRouter provider initialized without an API key. "
                "Set OPENROUTER_API_KEY or AI_API_KEY in .env to use live models."
            )

    def _get_headers(self) -> dict[str, str]:
        if not self.api_key:
            raise RuntimeError(
                "OpenRouter API key is missing. Please set OPENROUTER_API_KEY in your environment."
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": settings.openrouter_site_url,
            "X-Title": settings.openrouter_app_name,
            "Content-Type": "application/json",
        }

    async def _call_openrouter(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
    ) -> str:
        """Execute a chat completion call to OpenRouter with timeout."""
        headers = self._get_headers()
        url = f"{self.base_url}/chat/completions"

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    logger.error(
                        f"OpenRouter API returned error {response.status_code}: {response.text}"
                    )
                    raise RuntimeError(
                        f"OpenRouter API error {response.status_code}: {response.text}"
                    )
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content.strip()
            except httpx.TimeoutException as exc:
                logger.error(f"OpenRouter call timed out: {exc}")
                raise RuntimeError(f"OpenRouter request timed out: {exc}") from exc
            except httpx.RequestError as exc:
                logger.error(f"OpenRouter network error: {exc}")
                raise RuntimeError(f"OpenRouter network error: {exc}") from exc

    def _extract_json(self, text: str) -> dict[str, Any]:
        """Extract and parse JSON object from model output."""
        cleaned = text.strip()

        # Handle markdown code blocks
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()

        # Try direct parse
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find { ... } block
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                return json.loads(match.group(0))
            raise

    async def _generate_structured_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any]:
        """
        Call OpenRouter and parse JSON.
        If malformed, retries once with a repair instruction as per PRD Section 6.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw = await self._call_openrouter(messages)
        try:
            return self._extract_json(raw)
        except Exception as e:
            logger.warning(f"Initial model output not valid JSON ({e}). Retrying with repair prompt...")
            repair_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": "Your previous response was not valid JSON. Please reply ONLY with a valid JSON object matching the requested schema without any markdown formatting or commentary.",
                },
            ]
            repair_raw = await self._call_openrouter(repair_messages, temperature=0.0)
            try:
                return self._extract_json(repair_raw)
            except Exception as repair_err:
                logger.error(f"Repair retry also failed: {repair_err}")
                raise RuntimeError("Failed to parse valid JSON from OpenRouter output after retry") from repair_err

    # ── classify ──────────────────────────────────────────────────────────────

    async def classify(
        self, message: str, allowed_issue_types: list[str]
    ) -> dict[str, Any]:
        system_prompt = (
            "You are an AI classifier for an ISP customer support system.\n"
            "Classify the customer's message into exactly one category:\n"
            "- \"internet_connectivity\": The message is about home, broadband, or Wi-Fi connectivity or internet access issues.\n"
            "- \"off_topic\": The message is about something else entirely (e.g. banking, cracked phone screens, weather, etc.).\n"
            "- \"uncertain\": The message is too vague or ambiguous to classify safely.\n\n"
            "Rules:\n"
            f"- Supported issue types: {allowed_issue_types}\n"
            "- Do not classify as internet_connectivity merely because a device or router brand is mentioned in an unrelated context.\n"
            "- Confidence must be a float between 0.0 and 1.0.\n"
            "- Reason should be a concise, user-safe explanation.\n"
            "Respond strictly with a JSON object: {\"category\": string, \"confidence\": float, \"reason\": string}"
        )

        user_prompt = f"Customer message: \"{message}\""

        result = await self._generate_structured_json(system_prompt, user_prompt)

        category = result.get("category")
        valid_categories = {"internet_connectivity", "off_topic", "uncertain"}
        if category not in valid_categories:
            category = "uncertain"

        # Check against allowedIssueTypes
        if category == "internet_connectivity" and "internet_connectivity" not in allowed_issue_types:
            category = "off_topic"

        confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
        reason = str(result.get("reason", "Classification completed."))

        return {
            "category": category,
            "confidence": round(confidence, 2),
            "reason": reason,
        }

    # ── match_case ────────────────────────────────────────────────────────────

    async def match_case(
        self, message: str, candidates: list[dict[str, Any]]
    ) -> dict[str, Any]:
        if not candidates:
            return {
                "matchedCaseId": None,
                "confidence": 0.0,
                "needsConfirmation": False,
                "reason": "No candidate cases provided.",
            }

        valid_candidate_ids = {c["caseId"] for c in candidates}
        candidates_json = json.dumps(candidates, indent=2)

        system_prompt = (
            "You are an AI assistant matching a returning customer's support message to an existing unresolved case.\n"
            "Rules:\n"
            "- Only match if the message refers to the same unresolved internet problem.\n"
            "- You MUST choose matchedCaseId from the provided candidate caseIds, or null if no match.\n"
            "- NEVER invent a caseId.\n"
            "- If multiple candidate cases are similarly plausible, return null and set needsConfirmation to true.\n"
            "- Confidence must be a float between 0.0 and 1.0.\n"
            "Respond strictly with a JSON object: {\"matchedCaseId\": string or null, \"confidence\": float, \"needsConfirmation\": boolean, \"reason\": string}"
        )

        user_prompt = (
            f"Customer message: \"{message}\"\n\n"
            f"Candidate cases:\n{candidates_json}"
        )

        result = await self._generate_structured_json(system_prompt, user_prompt)

        matched_id = result.get("matchedCaseId")
        if matched_id and matched_id not in valid_candidate_ids:
            logger.warning(f"Model returned invalid candidate ID '{matched_id}'. Coercing to null.")
            matched_id = None

        confidence = max(0.0, min(1.0, float(result.get("confidence", 0.0))))
        needs_confirmation = bool(result.get("needsConfirmation", False))

        # Apply confidence threshold guidance from Shared Contract
        if confidence >= 0.80 and matched_id is not None:
            needs_confirmation = False
        elif 0.55 <= confidence < 0.80 and matched_id is not None:
            needs_confirmation = True
        elif confidence < 0.55:
            matched_id = None
            needs_confirmation = False

        reason = str(result.get("reason", "Case matching completed."))

        return {
            "matchedCaseId": matched_id,
            "confidence": round(confidence, 2),
            "needsConfirmation": needs_confirmation,
            "reason": reason,
        }

    # ── extract_outcome ───────────────────────────────────────────────────────

    async def extract_outcome(
        self, message: str, current_step_key: str
    ) -> dict[str, Any]:
        system_prompt = (
            "You are an AI evaluating whether a customer reported the outcome of a troubleshooting step.\n"
            f"Current troubleshooting step: \"{current_step_key}\"\n\n"
            "Outcome categories:\n"
            "- \"failed\": User says the step was tried and did NOT fix the issue (e.g., 'still no connection after rebooting').\n"
            "- \"succeeded\": User explicitly says the issue is fixed (e.g., 'It works now, I can browse').\n"
            "- \"unknown\": User tried the step but result is unclear, contradictory, or not verified.\n"
            "- \"not_provided\": The message does not report an outcome for this troubleshooting step.\n\n"
            "Important guidelines:\n"
            "- 'I rebooted it' is not automatically success.\n"
            "- 'I did it' is usually unknown or not_provided.\n"
            "- Confidence must be a float between 0.0 and 1.0.\n"
            "Respond strictly with a JSON object: {\"outcome\": string, \"confidence\": float, \"evidence\": string}"
        )

        user_prompt = f"Customer message: \"{message}\""

        result = await self._generate_structured_json(system_prompt, user_prompt)

        outcome = result.get("outcome")
        valid_outcomes = {"failed", "succeeded", "unknown", "not_provided"}
        if outcome not in valid_outcomes:
            outcome = "unknown"

        confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
        evidence = str(result.get("evidence", "Outcome extraction completed."))

        return {
            "outcome": outcome,
            "confidence": round(confidence, 2),
            "evidence": evidence,
        }
