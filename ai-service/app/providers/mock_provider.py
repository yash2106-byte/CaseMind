"""
Deterministic mock provider for offline testing.
Uses keyword matching and text similarity — no API keys required.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from app.providers.base import BaseProvider


# ─── Keyword sets ─────────────────────────────────────────────────────────────

# Strong internet-connectivity indicators
_INTERNET_KEYWORDS = {
    "internet",
    "wifi",
    "wi-fi",
    "broadband",
    "connection",
    "connected",
    "disconnecting",
    "disconnected",
    "disconnect",
    "network",
    "online",
    "offline",
    "router",
    "modem",
    "ethernet",
    "lan",
    "wan",
    "dns",
    "ip address",
    "bandwidth",
    "latency",
    "ping",
    "download",
    "upload",
    "buffering",
    "streaming",
    "loading",
    "browse",
    "browsing",
    "web",
    "website",
    "sites",
    "pages",
    "speed",
    "slow",
    "outage",
    "fiber",
    "fibre",
    "dsl",
    "isp",
    "cable internet",
    "signal",
    "no service",
    "no access",
}

# Phrases that strongly indicate connectivity issues (multi-word)
_INTERNET_PHRASES = [
    "internet is down",
    "internet not working",
    "internet keeps",
    "internet went out",
    "internet dropped",
    "internet stopped",
    "internet issue",
    "internet problem",
    "internet connection",
    "internet access",
    "can't connect",
    "cannot connect",
    "can not connect",
    "can't get online",
    "cannot get online",
    "no internet",
    "no connection",
    "no connectivity",
    "wi-fi not working",
    "wifi not working",
    "wifi is down",
    "wifi keeps dropping",
    "wifi disconnects",
    "broadband down",
    "broadband not working",
    "broadband issue",
    "network issue",
    "network problem",
    "network down",
    "nothing loads",
    "pages won't load",
    "can't load",
    "sites won't load",
    "can't browse",
    "can't open websites",
    "router not working",
    "modem not working",
    "connection drops",
    "connection keeps dropping",
    "connection unstable",
    "speed is slow",
    "very slow internet",
    "extremely slow",
    "keeps disconnecting",
    "keeps dropping",
    "goes in and out",
    "intermittent connection",
    "spotty connection",
    "no signal",
    "lost connection",
    "losing connection",
]

# Off-topic signals — topics clearly outside ISP connectivity support
_OFFTOPIC_KEYWORDS = {
    "bank",
    "pin",
    "password reset",
    "credit card",
    "delivery",
    "shipping",
    "order",
    "refund",
    "billing",
    "invoice",
    "phone screen",
    "cracked",
    "broken screen",
    "battery",
    "camera",
    "printer",
    "microwave",
    "oven",
    "washing machine",
    "car",
    "flight",
    "hotel",
    "restaurant",
    "recipe",
    "weather",
    "pizza",
    "homework",
    "math",
    "exam",
    "grade",
    "appointment",
    "doctor",
    "dentist",
    "insurance",
    "mortgage",
    "rent",
    "movie",
    "game",
    "music",
    "spotify",
    "netflix",
    "youtube",
    "tv remote",
    "air conditioner",
    "plumber",
    "electrician",
    "mobile data",
    "cellular",
    "sim card",
    "text message",
    "voicemail",
}

_OFFTOPIC_PHRASES = [
    "change my bank",
    "reset my password",
    "phone screen is cracked",
    "mobile data is slow",
    "cancel my subscription",
    "update my address",
    "track my order",
    "return my product",
    "book a flight",
    "schedule an appointment",
    "my phone is broken",
    "tv remote not working",
    "air conditioner broken",
    "help me with my homework",
    "what's the weather",
    "set an alarm",
    "play some music",
    "my printer won't print",
]


class MockProvider(BaseProvider):
    """
    Deterministic AI provider using keyword and similarity matching.
    Designed for reliable offline testing with no external dependencies.
    """

    # ── classify ──────────────────────────────────────────────────────────────

    async def classify(
        self, message: str, allowed_issue_types: list[str]
    ) -> dict[str, Any]:
        lower = message.lower().strip()

        # Score internet relevance
        internet_score = self._score_internet(lower)

        # Score off-topic relevance
        offtopic_score = self._score_offtopic(lower)

        # Decision logic
        if internet_score >= 2 and internet_score > offtopic_score:
            # Strong internet signal
            confidence = min(0.95, 0.70 + internet_score * 0.05)
            if "internet_connectivity" in allowed_issue_types:
                return {
                    "category": "internet_connectivity",
                    "confidence": round(confidence, 2),
                    "reason": "The message describes an internet connectivity problem.",
                }
            else:
                return {
                    "category": "off_topic",
                    "confidence": 0.80,
                    "reason": "The message is about internet connectivity, but that issue type is not currently allowed.",
                }

        if offtopic_score >= 2 and offtopic_score > internet_score:
            return {
                "category": "off_topic",
                "confidence": min(0.95, 0.70 + offtopic_score * 0.05),
                "reason": "The message is about a topic outside internet connectivity support.",
            }

        if internet_score == 1 and offtopic_score == 0:
            # Weak internet signal — could be uncertain
            if "internet_connectivity" in allowed_issue_types:
                return {
                    "category": "internet_connectivity",
                    "confidence": 0.72,
                    "reason": "The message may relate to internet connectivity but is not fully clear.",
                }

        if internet_score == 0 and offtopic_score == 0:
            # No clear signal at all
            return {
                "category": "uncertain",
                "confidence": 0.40,
                "reason": "The message is too vague to classify confidently.",
            }

        if offtopic_score >= 1 and internet_score == 0:
            return {
                "category": "off_topic",
                "confidence": 0.75,
                "reason": "The message appears to be about a topic outside internet connectivity support.",
            }

        # Mixed or weak signals
        return {
            "category": "uncertain",
            "confidence": 0.50,
            "reason": "The message contains mixed signals and cannot be classified confidently.",
        }

    def _score_internet(self, text: str) -> int:
        """Count internet-relevance signals in the text."""
        score = 0
        for phrase in _INTERNET_PHRASES:
            if phrase in text:
                score += 2
        for kw in _INTERNET_KEYWORDS:
            if re.search(r"\b" + re.escape(kw) + r"\b", text):
                score += 1
        return score

    def _score_offtopic(self, text: str) -> int:
        """Count off-topic signals in the text."""
        score = 0
        for phrase in _OFFTOPIC_PHRASES:
            if phrase in text:
                score += 2
        for kw in _OFFTOPIC_KEYWORDS:
            if re.search(r"\b" + re.escape(kw) + r"\b", text):
                score += 1
        return score

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

        lower = message.lower().strip()
        scored: list[tuple[str, float]] = []

        for c in candidates:
            title_lower = c.get("title", "").lower()
            summary_lower = c.get("problemSummary", "").lower()
            combined = f"{title_lower} {summary_lower}"

            # SequenceMatcher for fuzzy text similarity
            title_sim = SequenceMatcher(None, lower, title_lower).ratio()
            summary_sim = SequenceMatcher(None, lower, summary_lower).ratio()
            combined_sim = SequenceMatcher(None, lower, combined).ratio()

            # Keyword overlap boost
            msg_words = set(re.findall(r"\w+", lower))
            case_words = set(re.findall(r"\w+", combined))
            common = msg_words & case_words
            # Remove stop words from common
            stop = {"the", "a", "an", "is", "it", "my", "i", "and", "or", "but", "not", "no", "to", "of", "in", "on", "for", "with", "as", "at", "by"}
            meaningful_common = common - stop
            keyword_boost = min(0.3, len(meaningful_common) * 0.06)

            # Continuity phrases like "same issue", "still down", "again"
            continuity_boost = 0.0
            continuity_patterns = [
                "same issue", "same problem", "still down", "still not",
                "still broken", "again", "like yesterday", "like before",
                "came back", "happening again", "not fixed", "still no",
                "keeps happening", "recurring",
            ]
            for pat in continuity_patterns:
                if pat in lower:
                    continuity_boost += 0.15
                    break

            # Base similarity is the max of the three approaches
            base_sim = max(title_sim, summary_sim, combined_sim)
            final_score = min(1.0, base_sim + keyword_boost + continuity_boost)

            scored.append((c["caseId"], final_score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)
        best_id, best_score = scored[0]

        # Check if multiple candidates are similarly plausible
        if len(scored) > 1:
            second_score = scored[1][1]
            if best_score - second_score < 0.10 and best_score >= 0.55:
                return {
                    "matchedCaseId": None,
                    "confidence": best_score,
                    "needsConfirmation": True,
                    "reason": "Multiple cases are similarly plausible. User confirmation needed.",
                }

        # Apply threshold policy
        if best_score >= 0.80:
            return {
                "matchedCaseId": best_id,
                "confidence": round(best_score, 2),
                "needsConfirmation": False,
                "reason": "Strong match based on message similarity to the case description.",
            }
        elif best_score >= 0.55:
            return {
                "matchedCaseId": best_id,
                "confidence": round(best_score, 2),
                "needsConfirmation": True,
                "reason": "Moderate match. User confirmation is recommended.",
            }
        else:
            return {
                "matchedCaseId": None,
                "confidence": round(best_score, 2),
                "needsConfirmation": False,
                "reason": "No confident match found among the candidates.",
            }

    # ── extract_outcome ───────────────────────────────────────────────────────

    async def extract_outcome(
        self, message: str, current_step_key: str
    ) -> dict[str, Any]:
        lower = message.lower().strip()

        # ── Check for explicit success ────────────────────────────────────────
        success_patterns = [
            "it works", "it's working", "working now", "works now",
            "fixed", "it's fixed", "problem solved", "issue resolved",
            "back online", "can browse", "can open", "can load",
            "internet is back", "connection is back", "connected now",
            "everything works", "all good", "working again",
            "up and running", "back to normal", "loads fine",
            "pages load", "sites load", "browsing works",
            "issue is fixed", "problem is fixed",
            "yes it worked", "that worked", "that fixed it",
        ]
        for pat in success_patterns:
            if pat in lower:
                return {
                    "outcome": "succeeded",
                    "confidence": 0.92,
                    "evidence": f"Customer indicates the issue is fixed: '{pat}' detected.",
                }

        # ── Check for explicit failure ────────────────────────────────────────
        failure_patterns = [
            "still down", "still not working", "still broken",
            "didn't work", "did not work", "didn't help",
            "did not help", "no change", "nothing changed",
            "same problem", "same issue", "not fixed",
            "still no internet", "still no connection",
            "still can't", "still cannot", "still disconnecting",
            "no luck", "no improvement", "worse now",
            "made it worse", "failed", "doesn't work",
            "does not work", "no internet",
            "still offline", "still can not",
            "tried it but", "still no",
        ]
        for pat in failure_patterns:
            if pat in lower:
                return {
                    "outcome": "failed",
                    "confidence": 0.94,
                    "evidence": f"Customer indicates the step did not resolve the issue: '{pat}' detected.",
                }

        # ── Check for unknown / tried but unclear ─────────────────────────────
        unknown_patterns = [
            "not sure", "i'm not sure", "don't know",
            "hard to tell", "can't tell", "unclear",
            "haven't tested", "haven't checked",
            "haven't tried yet", "will try later",
            "lights are different", "something changed",
            "maybe", "possibly", "might be",
            "i think so", "seems like", "not certain",
            "i did it", "i tried", "done it",
        ]
        for pat in unknown_patterns:
            if pat in lower:
                return {
                    "outcome": "unknown",
                    "confidence": 0.78,
                    "evidence": f"Customer tried the step but result is unclear: '{pat}' detected.",
                }

        # ── Check if customer is even talking about the step ──────────────────
        step_ref_patterns = [
            "turned it", "restarted", "rebooted", "power cycled",
            "checked", "looked at", "tested", "tried",
            "plugged", "unplugged", "connected",
        ]
        mentions_step = any(pat in lower for pat in step_ref_patterns)

        if mentions_step:
            # They mention doing something, but no clear outcome
            return {
                "outcome": "unknown",
                "confidence": 0.65,
                "evidence": "Customer mentions attempting the step but does not indicate a clear outcome.",
            }

        # ── No outcome mentioned at all ───────────────────────────────────────
        return {
            "outcome": "not_provided",
            "confidence": 0.85,
            "evidence": "The message does not report an outcome for the current troubleshooting step.",
        }
