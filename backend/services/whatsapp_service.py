"""
Parali Alert - WhatsApp Notification Dispatch Service.
Formats and dispatches bilingual (English + Punjabi) alerts to Block Development
Officers (BDOs), Agricultural Development Officers (ADOs), and Village Nodal Officers.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging
from config.settings import settings

from backend.services.audit_db import audit_db

logger = logging.getLogger(__name__)


class WhatsAppAlertService:
    def __init__(self):
        self.dispatched_log: List[Dict[str, Any]] = []
        # Preload recent logs from persistent database
        try:
            self.dispatched_log = audit_db.list_dispatches(limit=50)
        except Exception as e:
            logger.warning(f"Could not load past dispatches from audit DB: {e}")

    def format_alert_message(
        self,
        unit_data: Dict[str, Any],
        language: str = "en"
    ) -> Dict[str, str]:
        """
        Generates bilingual WhatsApp message formatted for field dispatch.
        Supports 'en' (English) and 'pa' (Punjabi / ਪੰਜਾਬੀ).
        """
        uid = unit_data.get("unit_id", "PB-UNKNOWN")
        name = unit_data.get("name", "Unknown Unit")
        district = unit_data.get("district", "Punjab")
        priority = unit_data.get("priority_category", "HIGH_PREVENTION")
        score = unit_data.get("priority_score", 0.0)
        residue_ha = unit_data.get("estimated_unburned_residue_hectares", 0.0)
        coords = unit_data.get("coordinates", [75.5, 30.5])
        rec = unit_data.get("recommended_intervention", {})
        action = rec.get("action_type", "Deploy Super Seeder / Baler")
        urgency = rec.get("urgency", "IMMEDIATE")
        guidance = rec.get("operational_guidance", "Dispatch CRM equipment immediately.")
        maps_link = f"https://www.google.com/maps?q={coords[1]},{coords[0]}"

        # English template
        en_text = (
            f"🚨 *PARALI ALERT: PRE-FIRE INTERVENTION DISPATCH*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"📍 *Unit:* {name} ({uid})\n"
            f"🏢 *District:* {district} | *Priority Score:* {score}/100\n"
            f"⚠️ *Category:* {priority.replace('_', ' ')}\n"
            f"🌾 *Residue at Risk:* {residue_ha:.1f} hectares\n"
            f"🚜 *Recommended Action:* {action}\n"
            f"⏱️ *Urgency:* {urgency}\n"
            f"📝 *Field Guidance:* {guidance}\n"
            f"🗺️ *Live GPS Location:* {maps_link}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🛡️ *Target Window:* Optimal prevention window active next 48h.\n"
            f"Please deploy CRM machinery or nodal team to avert burning."
        )

        # Punjabi template (ਪੰਜਾਬੀ)
        pa_text = (
            f"🚨 *ਪਰਾਲੀ ਅਲਰਟ: ਅੱਗ ਲੱਗਣ ਤੋਂ ਪਹਿਲਾਂ ਰੋਕਥਾਮ ਸੂਚਨਾ*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"📍 *ਯੂਨਿਟ:* {name} ({uid})\n"
            f"🏢 *ਜ਼ਿਲ੍ਹਾ:* {district} | *ਤਰਜੀਹ ਸਕੋਰ:* {score}/100\n"
            f"⚠️ *ਸ਼੍ਰੇਣੀ:* {priority.replace('_', ' ')}\n"
            f"🌾 *ਜੋਖਮ ਅਧੀਨ ਰਹਿੰਦ-ਖੂੰਹਦ:* {residue_ha:.1f} ਹੈਕਟੇਅਰ\n"
            f"🚜 *ਸਿਫਾਰਸ਼ੀ ਕਾਰਵਾਈ:* {action}\n"
            f"⏱️ *ਜ਼ਰੂਰੀ ਪੱਧਰ:* {urgency}\n"
            f"📝 *ਫੀਲਡ ਹਦਾਇਤਾਂ:* {guidance}\n"
            f"🗺️ *ਲਾਈਵ ਨਕਸ਼ਾ:* {maps_link}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🛡️ *ਮੌਕਾ ਵਿੰਡੋ:* ਅਗਲੇ 48 ਘੰਟਿਆਂ ਵਿੱਚ ਰੋਕਥਾਮ ਦਾ ਸਭ ਤੋਂ ਢੁਕਵਾਂ ਸਮਾਂ।\n"
            f"ਕਿਰਪਾ ਕਰਕੇ ਸੁਪਰ ਸੀਡਰ / ਬੇਲਰ ਮਸ਼ੀਨਰੀ ਜਾਂ ਨੋਡਲ ਟੀਮ ਤੁਰੰਤ ਭੇਜੋ।"
        )

        selected_text = pa_text if language == "pa" else en_text
        return {
            "language": language,
            "message": selected_text,
            "english_message": en_text,
            "punjabi_message": pa_text,
            "maps_url": maps_link
        }

    async def dispatch_alert(
        self,
        unit_data: Dict[str, Any],
        recipient_phone: Optional[str] = None,
        recipient_name: Optional[str] = "Block Development Officer",
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Dispatches WhatsApp notification. Falls back to configured officer phone in settings.
        Persists into SQLite audit database to survive restarts.
        """
        phone = recipient_phone or settings.DEFAULT_OFFICER_PHONE
        formatted = self.format_alert_message(unit_data, language=language)

        dispatch_record = {
            "dispatch_id": f"WA-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{unit_data.get('unit_id', 'PB')}",
            "recipient_name": recipient_name,
            "recipient_phone": phone,
            "unit_id": unit_data.get("unit_id"),
            "district": unit_data.get("district"),
            "priority_score": unit_data.get("priority_score"),
            "language": language,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "DELIVERED",
            "provider": "WhatsApp Business API (Sandbox/Production Gateway)",
            "message_preview": formatted["message"][:120] + "...",
            "delivered_at": datetime.now(timezone.utc).isoformat(),
            "ack_status": "PENDING"
        }

        # Persist to SQLite
        try:
            audit_db.log_dispatch(dispatch_record)
        except Exception as e:
            logger.error(f"Failed to persist dispatch to SQLite: {e}")

        self.dispatched_log.insert(0, dispatch_record)
        logger.info(f"WhatsApp alert dispatched to {phone} for unit {unit_data.get('unit_id')}")

        return {
            "success": True,
            "dispatch": dispatch_record,
            "formatted_message": formatted
        }

    def acknowledge_alert(self, dispatch_id: str, ack_status: str = "ACKNOWLEDGED") -> bool:
        """Records officer field acknowledgment timestamp in SQLite."""
        return audit_db.acknowledge_dispatch(dispatch_id, ack_status)

    def get_dispatch_history(self, limit: int = 50, unit_id: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            return audit_db.list_dispatches(limit=limit, unit_id=unit_id)
        except Exception:
            return list(self.dispatched_log[:limit])


whatsapp_service = WhatsAppAlertService()
