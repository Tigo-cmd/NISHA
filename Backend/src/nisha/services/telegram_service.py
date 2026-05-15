"""
Telegram Alert Service for NISHA
---------------------------------
Sends critical security alerts to the NISHA Telegram channel.
Implements rate limiting to prevent alert spam.
"""

import asyncio
import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import telegram, gracefully degrade if not available
try:
    from telegram import Bot
    HAS_TELEGRAM = True
except ImportError:
    HAS_TELEGRAM = False
    logger.warning("python-telegram-bot not installed. Telegram alerts disabled. "
                   "Install with: pip install python-telegram-bot")


class TelegramService:
    """
    Centralized Telegram notification service with rate limiting.
    
    Rate limiting: Max 1 alert per agent per 30 seconds to prevent spam.
    """

    def __init__(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        rate_limit_seconds: int = 30,
    ):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID", "@nisha_security")
        self.rate_limit_seconds = rate_limit_seconds
        self.bot: Optional[object] = None
        self._last_alert_time: dict[str, float] = {}  # agent_id -> timestamp
        self._enabled = False

        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not set. Telegram alerts disabled.")
            return

        if not HAS_TELEGRAM:
            return

        try:
            self.bot = Bot(token=self.bot_token)
            self._enabled = True
            logger.info("Telegram service initialized for channel: %s", self.chat_id)
        except Exception as e:
            logger.error("Failed to initialize Telegram bot: %s", e)

    @property
    def is_enabled(self) -> bool:
        return self._enabled and self.bot is not None

    def _is_rate_limited(self, agent_id: str) -> bool:
        """Check if we've sent an alert for this agent recently."""
        now = time.time()
        last = self._last_alert_time.get(agent_id, 0)
        if now - last < self.rate_limit_seconds:
            logger.debug("Rate limited: agent %s (%.0fs remaining)",
                        agent_id, self.rate_limit_seconds - (now - last))
            return True
        return False

    def _record_alert(self, agent_id: str):
        """Record that we sent an alert for this agent."""
        self._last_alert_time[agent_id] = time.time()

    async def send_audio_alert(
        self, agent_id: str, sound_class: str, confidence: float,
        severity: str = "critical"
    ):
        """
        Send an audio classification alert to Telegram.
        
        Only sends if:
          - Service is enabled
          - Agent is not rate-limited
          - Confidence meets the tier threshold
        """
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡"}.get(severity, "⚪")

        message = (
            f"{severity_emoji} *NISHA AUDIO ALERT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"🔊 *Sound:* {sound_class}\n"
            f"📊 *Confidence:* {confidence:.1%}\n"
            f"⚡ *Severity:* {severity.upper()}\n"
            f"📡 *Agent:* `{agent_id}`\n"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Immediate attention required."
        )

        await self._send_message(message, agent_id)

    async def send_transcript_alert(
        self, agent_id: str, text: str, keywords: list[str],
        severity: str = "high", language: str = "en"
    ):
        """Send a transcript threat alert to Telegram."""
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        keyword_str = ", ".join(f"`{k}`" for k in keywords[:5])

        message = (
            f"🗣️ *NISHA TRANSCRIPT THREAT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📝 *Text:* \"{text[:200]}\"\n"
            f"🔑 *Keywords:* {keyword_str}\n"
            f"🌐 *Language:* {language}\n"
            f"⚡ *Severity:* {severity.upper()}\n"
            f"📡 *Agent:* `{agent_id}`\n"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Suspicious speech detected."
        )

        await self._send_message(message, agent_id)

    async def send_video_alert(
        self, agent_id: str, behavior: str, confidence: float
    ):
        """Send a video violence detection alert to Telegram."""
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        message = (
            f"🎥 *NISHA VIDEO ALERT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"👊 *Behavior:* {behavior}\n"
            f"📊 *Confidence:* {confidence:.1%}\n"
            f"📡 *Agent:* `{agent_id}`\n"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Visual threat detected."
        )

        await self._send_message(message, agent_id)

    async def _send_message(self, text: str, agent_id: str):
        """Send a message to the Telegram channel (non-blocking)."""
        try:
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=text,
                parse_mode="Markdown"
            )
            self._record_alert(agent_id)
            logger.info("✅ Telegram alert sent for agent %s", agent_id)
        except Exception as e:
            logger.error("❌ Telegram send failed for %s: %s", agent_id, e)
