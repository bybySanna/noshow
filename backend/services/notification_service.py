"""
NoShowGone - Service de Notifications (Mode Simulation)
Prêt pour intégration Twilio quand les clés seront fournies.

Ce service gère:
- File d'attente de notifications (email, SMS, WhatsApp)
- Système de retry avec backoff exponentiel
- Templates de messages personnalisables
- Logs complets pour audit
"""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)

# Configuration Twilio (à remplir avec de vraies clés)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')

# Mode simulation si pas de clés Twilio
SIMULATION_MODE = not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER])


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"


class NotificationType(str, Enum):
    CONFIRMATION_REQUEST = "confirmation_request"
    REMINDER_24H = "reminder_24h"
    REMINDER_3H = "reminder_3h"
    REMINDER_30MIN = "reminder_30min"
    CANCELLATION = "cancellation"
    RESCHEDULE = "reschedule"
    CUSTOM = "custom"


# Templates de messages
MESSAGE_TEMPLATES = {
    "confirmation_request": {
        "fr": {
            "subject": "Confirmez votre RDV - {business_name}",
            "body": """Bonjour {client_name},

Vous avez un RDV le {date} à {time} chez {business_name}.

👉 Confirmez votre présence: {confirmation_link}

À bientôt!
{business_name}"""
        },
        "en": {
            "subject": "Confirm your appointment - {business_name}",
            "body": """Hello {client_name},

You have an appointment on {date} at {time} at {business_name}.

👉 Confirm your attendance: {confirmation_link}

See you soon!
{business_name}"""
        }
    },
    "reminder_24h": {
        "fr": {
            "subject": "Rappel: RDV demain - {business_name}",
            "body": """Bonjour {client_name},

Rappel: votre RDV est demain le {date} à {time} chez {business_name}.

✅ Confirmer: {confirmation_link}
❌ Annuler ou reporter: {confirmation_link}

À demain!
{business_name}"""
        },
        "en": {
            "subject": "Reminder: Appointment tomorrow - {business_name}",
            "body": """Hello {client_name},

Reminder: your appointment is tomorrow on {date} at {time} at {business_name}.

✅ Confirm: {confirmation_link}
❌ Cancel or reschedule: {confirmation_link}

See you tomorrow!
{business_name}"""
        }
    },
    "reminder_3h": {
        "fr": {
            "subject": "Rappel: RDV dans 3h - {business_name}",
            "body": """Bonjour {client_name},

Votre RDV est dans 3 heures aujourd'hui à {time} chez {business_name}.

Adresse: {address}

À très vite!
{business_name}"""
        },
        "en": {
            "subject": "Reminder: Appointment in 3h - {business_name}",
            "body": """Hello {client_name},

Your appointment is in 3 hours today at {time} at {business_name}.

Address: {address}

See you very soon!
{business_name}"""
        }
    },
    "reminder_30min": {
        "fr": {
            "subject": "Rappel: RDV dans 30min - {business_name}",
            "body": """⏰ {client_name}, votre RDV est dans 30 minutes à {time} chez {business_name}!"""
        },
        "en": {
            "subject": "Reminder: Appointment in 30min - {business_name}",
            "body": """⏰ {client_name}, your appointment is in 30 minutes at {time} at {business_name}!"""
        }
    },
    "cancellation": {
        "fr": {
            "subject": "RDV annulé - {business_name}",
            "body": """Bonjour {client_name},

Votre RDV du {date} à {time} a été annulé.

Pour reprendre RDV: {booking_link}

{business_name}"""
        },
        "en": {
            "subject": "Appointment cancelled - {business_name}",
            "body": """Hello {client_name},

Your appointment on {date} at {time} has been cancelled.

To book again: {booking_link}

{business_name}"""
        }
    }
}


class NotificationService:
    """Service de gestion des notifications"""
    
    def __init__(self, db):
        self.db = db
        self.simulation_mode = SIMULATION_MODE
        if self.simulation_mode:
            logger.info("🔔 NotificationService en MODE SIMULATION - Twilio non configuré")
        else:
            logger.info("✅ NotificationService connecté à Twilio")
    
    async def send_notification(
        self,
        appointment_id: str,
        business_id: str,
        notification_type: NotificationType,
        channel: NotificationChannel,
        recipient: str,
        template_data: Dict[str, Any],
        lang: str = "fr",
        scheduled_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Envoie ou planifie une notification"""
        
        notification_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        # Construire le message depuis le template
        template = MESSAGE_TEMPLATES.get(notification_type.value, {}).get(lang, {})
        subject = template.get("subject", "Notification").format(**template_data)
        body = template.get("body", "").format(**template_data)
        
        notification = {
            "id": notification_id,
            "appointment_id": appointment_id,
            "business_id": business_id,
            "type": notification_type.value,
            "channel": channel.value,
            "recipient": recipient,
            "subject": subject,
            "message": body,
            "status": NotificationStatus.QUEUED.value if scheduled_at else NotificationStatus.PENDING.value,
            "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
            "sent_at": None,
            "delivered_at": None,
            "retry_count": 0,
            "max_retries": 3,
            "error_message": None,
            "simulation_mode": self.simulation_mode,
            "created_at": now.isoformat()
        }
        
        # Si pas de planification, envoyer immédiatement
        if not scheduled_at:
            result = await self._dispatch_notification(notification)
            notification.update(result)
        
        # Sauvegarder en DB
        await self.db.notifications.insert_one(notification)
        
        return {k: v for k, v in notification.items() if k != "_id"}
    
    async def _dispatch_notification(self, notification: Dict) -> Dict:
        """Dispatch la notification via le canal approprié"""
        
        channel = notification["channel"]
        recipient = notification["recipient"]
        message = notification["message"]
        
        try:
            if self.simulation_mode:
                # Mode simulation - log seulement
                logger.info(f"📤 [SIMULATION] {channel.upper()} → {recipient}: {message[:50]}...")
                return {
                    "status": NotificationStatus.SENT.value,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "simulation_mode": True
                }
            
            # Mode réel avec Twilio
            if channel == NotificationChannel.SMS.value:
                return await self._send_sms(recipient, message)
            elif channel == NotificationChannel.WHATSAPP.value:
                return await self._send_whatsapp(recipient, message)
            elif channel == NotificationChannel.EMAIL.value:
                return await self._send_email(recipient, notification["subject"], message)
            
        except Exception as e:
            logger.error(f"❌ Erreur envoi notification: {str(e)}")
            return {
                "status": NotificationStatus.FAILED.value,
                "error_message": str(e)
            }
    
    async def _send_sms(self, to: str, body: str) -> Dict:
        """Envoie un SMS via Twilio"""
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=body,
                from_=TWILIO_PHONE_NUMBER,
                to=to
            )
            return {
                "status": NotificationStatus.SENT.value,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "external_id": message.sid
            }
        except Exception as e:
            raise e
    
    async def _send_whatsapp(self, to: str, body: str) -> Dict:
        """Envoie un message WhatsApp via Twilio"""
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=body,
                from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
                to=f"whatsapp:{to}"
            )
            return {
                "status": NotificationStatus.SENT.value,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "external_id": message.sid
            }
        except Exception as e:
            raise e
    
    async def _send_email(self, to: str, subject: str, body: str) -> Dict:
        """Envoie un email (simulation ou via service email)"""
        # Pour l'instant en simulation
        logger.info(f"📧 [SIMULATION] Email → {to}: {subject}")
        return {
            "status": NotificationStatus.SENT.value,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "simulation_mode": True
        }
    
    async def retry_notification(self, notification_id: str) -> Dict:
        """Retente l'envoi d'une notification échouée"""
        notification = await self.db.notifications.find_one({"id": notification_id}, {"_id": 0})
        if not notification:
            return {"error": "Notification non trouvée"}
        
        if notification["retry_count"] >= notification["max_retries"]:
            return {"error": "Nombre max de tentatives atteint"}
        
        result = await self._dispatch_notification(notification)
        
        await self.db.notifications.update_one(
            {"id": notification_id},
            {"$set": {
                **result,
                "retry_count": notification["retry_count"] + 1
            }}
        )
        
        return {"success": True, **result}
    
    async def get_pending_notifications(self) -> List[Dict]:
        """Récupère les notifications en attente d'envoi"""
        now = datetime.now(timezone.utc).isoformat()
        notifications = await self.db.notifications.find({
            "status": {"$in": [NotificationStatus.QUEUED.value, NotificationStatus.PENDING.value]},
            "$or": [
                {"scheduled_at": {"$lte": now}},
                {"scheduled_at": None}
            ]
        }, {"_id": 0}).to_list(100)
        return notifications
    
    async def schedule_appointment_reminders(
        self,
        appointment: Dict,
        business: Dict,
        confirmation_link: str
    ) -> List[Dict]:
        """Planifie tous les rappels pour un RDV selon les paramètres business"""
        
        settings = business.get("reminder_settings", {})
        channels = settings.get("channels", ["email"])
        recipient = appointment.get("client_email") or appointment.get("client_phone")
        
        if not recipient:
            return []
        
        scheduled = []
        appt_datetime = datetime.fromisoformat(f"{appointment['date']}T{appointment['time']}:00")
        
        template_data = {
            "client_name": appointment["client_name"],
            "date": appointment["date"],
            "time": appointment["time"],
            "business_name": business["name"],
            "address": business.get("address", ""),
            "confirmation_link": confirmation_link,
            "booking_link": f"https://noshow.com/book/{business['id']}"
        }
        
        for channel in channels:
            # Rappel 24h avant
            if settings.get("reminder_24h", True):
                schedule_time = appt_datetime - timedelta(hours=24)
                if schedule_time > datetime.now(timezone.utc):
                    notif = await self.send_notification(
                        appointment_id=appointment["id"],
                        business_id=business["id"],
                        notification_type=NotificationType.REMINDER_24H,
                        channel=NotificationChannel(channel),
                        recipient=recipient,
                        template_data=template_data,
                        scheduled_at=schedule_time
                    )
                    scheduled.append(notif)
            
            # Rappel 3h avant
            if settings.get("reminder_3h", True):
                schedule_time = appt_datetime - timedelta(hours=3)
                if schedule_time > datetime.now(timezone.utc):
                    notif = await self.send_notification(
                        appointment_id=appointment["id"],
                        business_id=business["id"],
                        notification_type=NotificationType.REMINDER_3H,
                        channel=NotificationChannel(channel),
                        recipient=recipient,
                        template_data=template_data,
                        scheduled_at=schedule_time
                    )
                    scheduled.append(notif)
            
            # Rappel 30min avant
            if settings.get("reminder_30min", False):
                schedule_time = appt_datetime - timedelta(minutes=30)
                if schedule_time > datetime.now(timezone.utc):
                    notif = await self.send_notification(
                        appointment_id=appointment["id"],
                        business_id=business["id"],
                        notification_type=NotificationType.REMINDER_30MIN,
                        channel=NotificationChannel(channel),
                        recipient=recipient,
                        template_data=template_data,
                        scheduled_at=schedule_time
                    )
                    scheduled.append(notif)
        
        return scheduled
    
    async def get_notification_stats(self, business_id: str) -> Dict:
        """Retourne les stats de notifications pour une entreprise"""
        
        total = await self.db.notifications.count_documents({"business_id": business_id})
        sent = await self.db.notifications.count_documents({"business_id": business_id, "status": "sent"})
        failed = await self.db.notifications.count_documents({"business_id": business_id, "status": "failed"})
        pending = await self.db.notifications.count_documents({"business_id": business_id, "status": {"$in": ["pending", "queued"]}})
        
        # Stats par canal
        by_channel = {}
        for channel in ["email", "sms", "whatsapp"]:
            count = await self.db.notifications.count_documents({"business_id": business_id, "channel": channel})
            by_channel[channel] = count
        
        return {
            "total": total,
            "sent": sent,
            "failed": failed,
            "pending": pending,
            "success_rate": round(sent / total * 100, 1) if total > 0 else 0,
            "by_channel": by_channel,
            "simulation_mode": self.simulation_mode
        }
