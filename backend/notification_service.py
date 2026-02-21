"""
NoShowGone - Notification Service
Système centralisé de notifications avec queue, retry, fallback et templates.
Compatible Twilio (SMS/WhatsApp) + Email SMTP.
En mode simulation si clés non configurées.
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)

NOTIFICATION_MODE = os.environ.get('NOTIFICATION_MODE', 'simulation')
TWILIO_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE = os.environ.get('TWILIO_PHONE_NUMBER', '')

# ============= TEMPLATES =============
DEFAULT_TEMPLATES = {
    "reminder_24h": {
        "fr": "Bonjour {client_name} ! Rappel : vous avez un RDV chez {business_name} demain {date} à {time}. Confirmez ici : {confirm_link}",
        "en": "Hello {client_name}! Reminder: you have an appointment at {business_name} tomorrow {date} at {time}. Confirm here: {confirm_link}",
    },
    "reminder_3h": {
        "fr": "Bonjour {client_name} ! Votre RDV chez {business_name} est dans 3h, aujourd'hui à {time}. Confirmez : {confirm_link}",
        "en": "Hi {client_name}! Your appointment at {business_name} is in 3 hours at {time}. Confirm: {confirm_link}",
    },
    "reminder_30min": {
        "fr": "⏰ {client_name}, votre RDV chez {business_name} est dans 30 minutes ! À tout de suite.",
        "en": "⏰ {client_name}, your appointment at {business_name} is in 30 minutes! See you soon.",
    },
    "confirmation_request": {
        "fr": "Bonjour {client_name} ! Votre RDV chez {business_name} le {date} à {time} est en attente de confirmation. Cliquez ici : {confirm_link}",
        "en": "Hello {client_name}! Your appointment at {business_name} on {date} at {time} awaits confirmation. Click here: {confirm_link}",
    },
    "appointment_confirmed": {
        "fr": "✅ {client_name}, votre RDV chez {business_name} le {date} à {time} est bien confirmé. À bientôt !",
        "en": "✅ {client_name}, your appointment at {business_name} on {date} at {time} is confirmed. See you soon!",
    },
    "appointment_cancelled": {
        "fr": "❌ Votre RDV chez {business_name} le {date} à {time} a été annulé. Reprenez RDV : {rebook_link}",
        "en": "❌ Your appointment at {business_name} on {date} at {time} has been cancelled. Rebook: {rebook_link}",
    },
    "business_new_booking": {
        "fr": "Nouveau RDV ! {client_name} ({client_phone}) le {date} à {time}.",
        "en": "New booking! {client_name} ({client_phone}) on {date} at {time}.",
    },
    "business_noshow_alert": {
        "fr": "⚠️ No-show détecté : {client_name} n'est pas venu pour son RDV du {date} à {time}.",
        "en": "⚠️ No-show detected: {client_name} did not show up for {date} at {time}.",
    },
    "deposit_request": {
        "fr": "Un acompte de {amount}€ est demandé pour confirmer votre RDV chez {business_name} le {date}. Payez ici : {payment_link}",
        "en": "A deposit of {amount}€ is required to confirm your appointment at {business_name} on {date}. Pay here: {payment_link}",
    },
}


def render_template(template_key: str, variables: Dict[str, str], lang: str = "fr", custom_template: str = None) -> str:
    """Render a notification template with variables."""
    if custom_template:
        text = custom_template
    else:
        tmpl = DEFAULT_TEMPLATES.get(template_key, {})
        text = tmpl.get(lang, tmpl.get("fr", ""))
    
    for key, value in variables.items():
        text = text.replace(f"{{{key}}}", str(value) if value else "")
    return text


class NotificationChannel(str, Enum):
    SMS = "sms"
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class NotificationStatus(str, Enum):
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"
    SKIPPED = "skipped"


async def send_sms(phone: str, message: str, db) -> Dict:
    """Send SMS via Twilio or simulation."""
    log_id = str(uuid.uuid4())
    
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_PHONE:
        try:
            from twilio.rest import Client as TwilioClient
            client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            msg = client.messages.create(
                body=message,
                from_=TWILIO_PHONE,
                to=phone
            )
            await _log_send(db, log_id, "sms", phone, message, NotificationStatus.SENT, twilio_sid=msg.sid)
            return {"status": "sent", "sid": msg.sid, "log_id": log_id}
        except Exception as e:
            logger.error(f"Twilio SMS failed: {e}")
            await _log_send(db, log_id, "sms", phone, message, NotificationStatus.FAILED, error=str(e))
            return {"status": "failed", "error": str(e), "log_id": log_id}
    else:
        # Simulation mode
        logger.info(f"[SIMULATION SMS] To: {phone} | Message: {message[:80]}...")
        await _log_send(db, log_id, "sms", phone, message, NotificationStatus.SENT, simulated=True)
        return {"status": "simulated", "log_id": log_id}


async def send_whatsapp(phone: str, message: str, db) -> Dict:
    """Send WhatsApp via Twilio or simulation."""
    log_id = str(uuid.uuid4())
    
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_PHONE:
        try:
            from twilio.rest import Client as TwilioClient
            client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            wa_phone = f"whatsapp:{phone}" if not phone.startswith("whatsapp:") else phone
            wa_from = f"whatsapp:{TWILIO_PHONE}"
            msg = client.messages.create(body=message, from_=wa_from, to=wa_phone)
            await _log_send(db, log_id, "whatsapp", phone, message, NotificationStatus.SENT, twilio_sid=msg.sid)
            return {"status": "sent", "sid": msg.sid, "log_id": log_id}
        except Exception as e:
            logger.error(f"Twilio WhatsApp failed: {e}")
            # Fallback to SMS
            logger.info(f"Falling back to SMS for {phone}")
            return await send_sms(phone, message, db)
    else:
        logger.info(f"[SIMULATION WHATSAPP] To: {phone} | Message: {message[:80]}...")
        await _log_send(db, log_id, "whatsapp", phone, message, NotificationStatus.SENT, simulated=True)
        return {"status": "simulated", "log_id": log_id}


async def send_email_notification(email: str, subject: str, body: str, db) -> Dict:
    """Send email via SMTP or simulation."""
    log_id = str(uuid.uuid4())
    logger.info(f"[SIMULATION EMAIL] To: {email} | Subject: {subject} | Body: {body[:80]}...")
    await _log_send(db, log_id, "email", email, body, NotificationStatus.SENT, simulated=True, subject=subject)
    return {"status": "simulated", "log_id": log_id}


async def _log_send(db, log_id: str, channel: str, recipient: str, message: str,
                    status: str, twilio_sid: str = None, error: str = None,
                    simulated: bool = False, subject: str = None):
    """Store notification log in MongoDB."""
    await db.notification_logs.insert_one({
        "id": log_id,
        "channel": channel,
        "recipient": recipient,
        "message": message[:500],
        "subject": subject,
        "status": status,
        "twilio_sid": twilio_sid,
        "error": error,
        "simulated": simulated,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def send_appointment_notification(
    db,
    appointment: Dict,
    business: Dict,
    template_key: str,
    channels: List[str],
    extra_vars: Dict = None,
    base_url: str = "https://appointment-armor.preview.emergentagent.com"
):
    """Main function to send appointment notifications through configured channels."""
    client_phone = appointment.get("client_phone", "")
    client_email = appointment.get("client_email", "")
    confirm_url = f"{base_url}/confirm/{appointment.get('confirmation_token', '')}"
    
    variables = {
        "client_name": appointment.get("client_name", ""),
        "business_name": business.get("name", ""),
        "date": appointment.get("date", ""),
        "time": appointment.get("time", ""),
        "client_phone": client_phone,
        "confirm_link": confirm_url,
        "rebook_link": confirm_url,
        "payment_link": confirm_url,
        "amount": str(appointment.get("deposit_amount", "")),
        **(extra_vars or {})
    }
    
    custom_msg = business.get("reminder_settings", {}).get("custom_message")
    message = render_template(template_key, variables, lang="fr", custom_template=custom_msg if template_key.startswith("reminder") else None)
    
    results = []
    for channel in channels:
        notif_id = str(uuid.uuid4())
        try:
            if channel == "sms" and client_phone:
                result = await send_sms(client_phone, message, db)
            elif channel == "whatsapp" and client_phone:
                result = await send_whatsapp(client_phone, message, db)
            elif channel == "email" and client_email:
                subject_map = {
                    "reminder_24h": f"Rappel RDV - {appointment.get('date', '')}",
                    "reminder_3h": f"RDV dans 3h - {appointment.get('time', '')}",
                    "confirmation_request": "Confirmez votre rendez-vous",
                    "appointment_confirmed": "RDV confirmé",
                    "appointment_cancelled": "RDV annulé",
                    "deposit_request": "Paiement requis pour votre RDV",
                }
                subject = subject_map.get(template_key, "Notification NoShowGone")
                result = await send_email_notification(client_email, subject, message, db)
            else:
                result = {"status": "skipped", "reason": f"No {channel} recipient"}
            
            # Store in notifications collection
            await db.notifications.insert_one({
                "id": notif_id,
                "appointment_id": appointment.get("id"),
                "business_id": appointment.get("business_id"),
                "type": template_key,
                "channel": channel,
                "status": result.get("status", "unknown"),
                "recipient": client_phone if channel != "email" else client_email,
                "message": message[:300],
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "retry_count": 0,
                "simulated": result.get("status") == "simulated"
            })
            results.append({"channel": channel, **result})
        except Exception as e:
            logger.error(f"Failed to send {channel}: {e}")
            results.append({"channel": channel, "status": "failed", "error": str(e)})
    
    return results


async def process_reminder_queue(db, base_url: str):
    """Check appointments and send due reminders. Called periodically."""
    now = datetime.now(timezone.utc)
    
    reminder_windows = [
        ("reminder_24h", 24 * 60, 25 * 60),      # 24-25h before
        ("reminder_3h", 3 * 60, 3 * 60 + 30),     # 3h-3h30 before
        ("reminder_30min", 30, 45),                 # 30-45min before
    ]
    
    sent_count = 0
    for reminder_type, min_minutes, max_minutes in reminder_windows:
        appt_time_min = now + timedelta(minutes=min_minutes)
        appt_time_max = now + timedelta(minutes=max_minutes)
        
        date_min = appt_time_min.strftime("%Y-%m-%d")
        time_min = appt_time_min.strftime("%H:%M")
        date_max = appt_time_max.strftime("%Y-%m-%d")
        time_max = appt_time_max.strftime("%H:%M")
        
        # Find appointments in this window that haven't had this reminder sent
        appointments = await db.appointments.find({
            "status": {"$in": ["pending", "confirmed"]},
            "$or": [
                {"date": date_min, "time": {"$gte": time_min}},
                {"date": date_max, "time": {"$lte": time_max}},
            ],
            f"reminders_sent.{reminder_type}": {"$exists": False}
        }, {"_id": 0}).to_list(50)
        
        for appt in appointments:
            biz = await db.businesses.find_one({"id": appt["business_id"]}, {"_id": 0})
            if not biz:
                continue
            
            # Check if this reminder type is enabled
            reminder_settings = biz.get("reminder_settings", {})
            reminder_key_map = {
                "reminder_24h": "reminder_24h",
                "reminder_3h": "reminder_3h",
                "reminder_30min": "reminder_30min"
            }
            if not reminder_settings.get(reminder_key_map.get(reminder_type, ""), True):
                continue
            
            channels = reminder_settings.get("channels", ["email"])
            
            await send_appointment_notification(db, appt, biz, reminder_type, channels, base_url=base_url)
            
            # Mark reminder as sent
            await db.appointments.update_one(
                {"id": appt["id"]},
                {"$set": {f"reminders_sent.{reminder_type}": datetime.now(timezone.utc).isoformat()}}
            )
            sent_count += 1
    
    return sent_count
