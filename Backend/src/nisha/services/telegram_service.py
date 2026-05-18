"""
Telegram Alert Service for NISHA
---------------------------------
Sends critical security alerts to the NISHA Telegram channel.
Implements rate limiting to prevent alert spam.
Includes reverse geocoding for street-level location context.
"""

import asyncio
import logging
import os
import time
from io import BytesIO
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

# Try to import telegram, gracefully degrade if not available
try:
    from telegram import Bot
    HAS_TELEGRAM = True
except ImportError:
    HAS_TELEGRAM = False
    logger.warning("python-telegram-bot not installed. Telegram alerts disabled. "
                   "Install with: pip install python-telegram-bot")


async def reverse_geocode(lat: float, lng: float) -> str:
    """Reverse geocode GPS coordinates to a human-readable address using OpenStreetMap Nominatim.

    Returns the formatted address string, or a fallback GPS string if the lookup fails.
    """
    if lat is None or lng is None:
        return "Unknown location"

    try:
        url = (
            f"https://nominatim.openstreetmap.org/reverse"
            f"?lat={lat}&lon={lng}&format=json&addressdetails=1"
        )
        headers = {"User-Agent": "NISHA-Security/1.0"}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("display_name", f"{lat:.6f}, {lng:.6f}")
    except Exception as e:
        logger.debug("Reverse geocode failed: %s", e)

    return f"{lat:.6f}, {lng:.6f}"


def _format_location_block(location_data: dict | None, address: str | None = None) -> str:
    """Build the location lines for a Telegram alert message."""
    if not location_data:
        return ""
    
    lat = location_data.get("lat")
    lng = location_data.get("lng")
    if lat is None or lng is None:
        return ""

    lines = []
    if address and address != "Unknown location":
        lines.append(f"📍 *Address:* {address}")
    lines.append(
        f"🗺️ *GPS:* [{lat:.6f}, {lng:.6f}]"
        f"(https://www.google.com/maps/search/?api=1&query={lat},{lng})"
    )
    return "\n".join(lines) + "\n"


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

    async def _resolve_location(self, location_data: dict | None) -> tuple[dict | None, str | None]:
        """Fetch and reverse-geocode location data. Returns (location_data, address_string)."""
        if not location_data:
            return None, None
        lat = location_data.get("lat")
        lng = location_data.get("lng")
        if lat is None or lng is None:
            return None, None
        address = await reverse_geocode(lat, lng)
        return location_data, address

    # ─── Audio Alert ────────────────────────────────────────────────
    async def send_audio_alert(
        self, agent_id: str, sound_class: str, confidence: float,
        severity: str = "critical",
        audio_data: bytes | None = None,
        location_data: dict | None = None,
    ):
        """
        Send an audio classification alert to Telegram.
        
        If audio_data is provided, the raw audio is sent as an attachment.
        Location is reverse-geocoded to include a street address.
        """
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        location_data, address = await self._resolve_location(location_data)
        loc_block = _format_location_block(location_data, address)

        severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡"}.get(severity, "⚪")

        message = (
            f"{severity_emoji} *NISHA AUDIO ALERT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"🔊 *Sound:* {sound_class}\n"
            f"📊 *Confidence:* {confidence:.1%}\n"
            f"⚡ *Severity:* {severity.upper()}\n"
            f"📡 *Agent:* `{agent_id}`\n"
            f"{loc_block}"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Immediate attention required."
        )

        if audio_data:
            await self._send_audio(audio_data, message, agent_id)
        else:
            await self._send_message(message, agent_id)

    # ─── Transcript Alert ───────────────────────────────────────────
    async def send_transcript_alert(
        self, agent_id: str, text: str, keywords: list[str],
        severity: str = "high", language: str = "en",
        location_data: dict | None = None,
        audio_data: bytes | None = None,
    ):
        """Send a transcript threat alert to Telegram with location and audio evidence."""
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        location_data, address = await self._resolve_location(location_data)
        loc_block = _format_location_block(location_data, address)

        keyword_str = ", ".join(f"`{k}`" for k in keywords[:5])

        message = (
            f"🗣️ *NISHA TRANSCRIPT THREAT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📝 *Text:* \"{text[:200]}\"\n"
            f"🔑 *Keywords:* {keyword_str}\n"
            f"🌐 *Language:* {language}\n"
            f"⚡ *Severity:* {severity.upper()}\n"
            f"📡 *Agent:* `{agent_id}`\n"
            f"{loc_block}"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Suspicious speech detected."
        )

        if audio_data:
            await self._send_audio(audio_data, message, agent_id)
        else:
            await self._send_message(message, agent_id)

    # ─── Video / Visual Threat Alert ────────────────────────────────
    async def send_video_alert(
        self, agent_id: str, behavior: str, confidence: float, 
        weapons: list[dict] = None, photo_bytes: bytes = None,
        location_data: dict = None
    ):
        """Send a video threat alert with optional photo and reverse-geocoded location."""
        if not self.is_enabled:
            return
        if self._is_rate_limited(agent_id):
            return

        location_data, address = await self._resolve_location(location_data)
        loc_block = _format_location_block(location_data, address)

        weapon_str = ""
        if weapons:
            weapon_list = [w['class'] for w in weapons]
            weapon_str = f"🔫 *Weapons:* {', '.join(weapon_list)}\n"

        message = (
            f"🚨 *NISHA VISUAL THREAT*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"👊 *Behavior:* {behavior}\n"
            f"{weapon_str}"
            f"📊 *Confidence:* {confidence:.1%}\n"
            f"{loc_block}"
            f"📡 *Agent:* `{agent_id}`\n"
            f"🕐 *Time:* {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ Visual threat detected. See attached evidence."
        )

        if photo_bytes:
            await self._send_photo(photo_bytes, message, agent_id)
        else:
            await self._send_message(message, agent_id)

    # ─── Low-level senders ──────────────────────────────────────────
    async def _send_audio(self, audio_bytes: bytes, caption: str, agent_id: str):
        """Send an audio file with caption to the Telegram channel."""
        try:
            audio_stream = BytesIO(audio_bytes)
            audio_stream.name = "alert_audio.wav"
            await self.bot.send_audio(
                chat_id=self.chat_id,
                audio=audio_stream,
                caption=caption[:1024],  # Telegram caption limit
                parse_mode="Markdown"
            )
            self._record_alert(agent_id)
            logger.info("✅ Telegram audio alert sent for agent %s", agent_id)
        except Exception as e:
            logger.error("❌ Telegram audio send failed for %s: %s", agent_id, e)
            # Fallback to text-only if audio send fails
            await self._send_message(caption, agent_id)

    async def _send_photo(self, photo_bytes: bytes, caption: str, agent_id: str):
        """Send a photo with caption to the Telegram channel."""
        try:
            await self.bot.send_photo(
                chat_id=self.chat_id,
                photo=photo_bytes,
                caption=caption[:1024],  # Telegram caption limit
                parse_mode="Markdown"
            )
            self._record_alert(agent_id)
            logger.info("✅ Telegram photo alert sent for agent %s", agent_id)
        except Exception as e:
            logger.error("❌ Telegram photo send failed for %s: %s", agent_id, e)

    async def _send_message(self, text: str, agent_id: str):
        """Send a message to the Telegram channel (non-blocking)."""
        try:
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=text,
                parse_mode="Markdown",
                disable_web_page_preview=False
            )
            self._record_alert(agent_id)
            logger.info("✅ Telegram alert sent for agent %s", agent_id)
        except Exception as e:
            logger.error("❌ Telegram send failed for %s: %s", agent_id, e)
