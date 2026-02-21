"""
NoShowGone - Service d'Automatisation Post-RDV
100% Automatique - Zéro intervention manuelle

Ce service gère:
- Trigger automatique quand RDV passe à "completed"
- Queue d'envoi avec statuts (à_envoyer, envoyé, échec, retry)
- Multi-canaux avec fallback (SMS → WhatsApp → Email)
- Templates dynamiques par entreprise
- Retry automatique avec backoff exponentiel
- Analytics temps réel pour Business et Admin
"""

import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)

# Configuration Twilio
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')

# Mode simulation si pas de clés
SIMULATION_MODE = not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER])

# SMTP Configuration (pour email fallback)
SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = os.environ.get('SMTP_PORT', '587')
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SMTP_FROM = os.environ.get('SMTP_FROM', 'noreply@noshowgone.com')


class MessageQueueStatus(str, Enum):
    PENDING = "pending"         # À envoyer
    QUEUED = "queued"           # Dans la queue
    SENDING = "sending"         # En cours d'envoi
    SENT = "sent"               # Envoyé avec succès
    DELIVERED = "delivered"     # Livré (confirmé)
    FAILED = "failed"           # Échec définitif
    RETRYING = "retrying"       # En attente de retry
    FALLBACK = "fallback"       # Fallback vers autre canal


class MessageType(str, Enum):
    THANKYOU = "thankyou"                   # Remerciement post-RDV
    REVIEW_REQUEST = "review_request"       # Demande d'avis Google
    LOYALTY_REWARD = "loyalty_reward"       # Récompense fidélité
    WHEEL_OF_FORTUNE = "wheel_of_fortune"   # Roue de la fortune
    CUSTOM = "custom"                       # Message personnalisé


# Templates par défaut pour post-RDV
DEFAULT_POST_RDV_TEMPLATES = {
    "thankyou_standard": {
        "name": "Remerciement Standard",
        "type": "thankyou",
        "message_fr": """Merci {{nom_client}} pour votre visite chez {{nom_entreprise}} ! 

Nous espérons vous revoir très bientôt.

{{nom_entreprise}}""",
        "message_en": """Thank you {{nom_client}} for your visit at {{nom_entreprise}}!

We hope to see you again soon.

{{nom_entreprise}}""",
        "channels": ["sms", "email", "whatsapp"],
        "include_link": False
    },
    "review_request": {
        "name": "Demande d'Avis Google",
        "type": "review_request",
        "message_fr": """{{nom_client}}, merci pour votre visite !

Votre avis compte énormément pour nous. Partagez votre expérience en 30 secondes :

⭐ {{lien_google_avis}}

Merci beaucoup !
{{nom_entreprise}}""",
        "message_en": """{{nom_client}}, thank you for your visit!

Your opinion matters a lot to us. Share your experience in 30 seconds:

⭐ {{lien_google_avis}}

Thank you so much!
{{nom_entreprise}}""",
        "channels": ["sms", "email", "whatsapp"],
        "include_link": True,
        "link_key": "lien_google_avis"
    },
    "loyalty_reward": {
        "name": "Récompense Fidélité",
        "type": "loyalty_reward",
        "message_fr": """{{nom_client}}, merci pour votre fidélité ! 🎉

En tant que client fidèle, profitez de -{{reduction}}% sur votre prochaine visite avec le code : {{code_promo}}

Valable jusqu'au {{date_expiration}}.

À très bientôt !
{{nom_entreprise}}""",
        "message_en": """{{nom_client}}, thank you for your loyalty! 🎉

As a loyal customer, enjoy {{reduction}}% off your next visit with code: {{code_promo}}

Valid until {{date_expiration}}.

See you soon!
{{nom_entreprise}}""",
        "channels": ["sms", "email", "whatsapp"],
        "include_link": False
    },
    "wheel_of_fortune": {
        "name": "Roue de la Fortune",
        "type": "wheel_of_fortune",
        "message_fr": """{{nom_client}}, merci pour votre visite !

🎰 Tentez votre chance à la roue de la fortune et gagnez jusqu'à -50% !

👉 {{lien_roue_fortune}}

Bonne chance !
{{nom_entreprise}}""",
        "message_en": """{{nom_client}}, thank you for your visit!

🎰 Try your luck at the wheel of fortune and win up to 50% off!

👉 {{lien_roue_fortune}}

Good luck!
{{nom_entreprise}}""",
        "channels": ["sms", "email", "whatsapp"],
        "include_link": True,
        "link_key": "lien_roue_fortune"
    }
}


class PostRdvAutomationService:
    """Service d'automatisation post-RDV 100% automatique"""
    
    def __init__(self, db):
        self.db = db
        self.simulation_mode = SIMULATION_MODE
        self.max_retries = 3
        self.retry_delays = [60, 300, 900]  # 1min, 5min, 15min
        if self.simulation_mode:
            logger.info("🤖 PostRdvAutomationService en MODE SIMULATION")
        else:
            logger.info("✅ PostRdvAutomationService connecté")
    
    # ============= TRIGGER AUTOMATIQUE =============
    
    async def trigger_post_rdv(self, appointment_id: str, business_id: str) -> Dict[str, Any]:
        """
        Déclenché automatiquement quand un RDV passe à "completed"
        Crée les messages dans la queue selon les templates de l'entreprise
        """
        now = datetime.now(timezone.utc)
        
        # Récupérer le RDV
        appt = await self.db.appointments.find_one(
            {"id": appointment_id, "business_id": business_id},
            {"_id": 0}
        )
        if not appt:
            return {"error": "Appointment not found"}
        
        # Vérifier qu'on n'a pas déjà envoyé
        existing = await self.db.post_rdv_queue.find_one({
            "appointment_id": appointment_id,
            "status": {"$in": ["sent", "delivered", "sending"]}
        })
        if existing:
            return {"error": "Message already sent for this appointment", "existing_id": existing["id"]}
        
        # Récupérer l'entreprise et ses paramètres
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business not found"}
        
        # Récupérer les templates actifs de l'entreprise
        settings = business.get("post_rdv_settings", {})
        enabled_templates = settings.get("enabled_templates", ["thankyou_standard"])
        preferred_channel = settings.get("preferred_channel", "sms")
        fallback_enabled = settings.get("fallback_enabled", True)
        
        # Préparer les variables dynamiques
        template_vars = {
            "nom_client": appt.get("client_name", "Client"),
            "nom_entreprise": business.get("name", ""),
            "lien_google_avis": settings.get("google_review_link", ""),
            "lien_roue_fortune": settings.get("wheel_of_fortune_link", ""),
            "reduction": settings.get("loyalty_discount", "10"),
            "code_promo": settings.get("promo_code", f"MERCI{now.strftime('%m%y')}"),
            "date_expiration": (now + timedelta(days=30)).strftime("%d/%m/%Y")
        }
        
        # Créer les messages dans la queue
        messages_created = []
        for template_key in enabled_templates:
            template = await self._get_template(business_id, template_key)
            if not template:
                continue
            
            # Personnaliser le message
            lang = business.get("settings", {}).get("lang", "fr")
            message_key = f"message_{lang}"
            message = template.get(message_key, template.get("message_fr", ""))
            
            # Remplacer les variables
            for var, value in template_vars.items():
                message = message.replace(f"{{{{{var}}}}}", str(value))
            
            # Déterminer le destinataire
            recipient = appt.get("client_phone") or appt.get("client_email")
            recipient_email = appt.get("client_email")
            
            if not recipient:
                continue
            
            # Créer l'entrée dans la queue
            queue_entry = {
                "id": str(uuid.uuid4()),
                "appointment_id": appointment_id,
                "business_id": business_id,
                "client_name": appt.get("client_name"),
                "client_phone": appt.get("client_phone"),
                "client_email": recipient_email,
                "template_key": template_key,
                "template_name": template.get("name"),
                "message_type": template.get("type", "thankyou"),
                "message": message,
                "channel": preferred_channel,
                "fallback_channels": ["whatsapp", "email"] if fallback_enabled else [],
                "current_channel_index": 0,
                "recipient": recipient,
                "status": MessageQueueStatus.PENDING.value,
                "retry_count": 0,
                "max_retries": self.max_retries,
                "next_retry_at": None,
                "sent_at": None,
                "delivered_at": None,
                "error_message": None,
                "click_tracking": {
                    "google_review_clicked": False,
                    "wheel_clicked": False,
                    "link_clicked_at": None
                },
                "simulation_mode": self.simulation_mode,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            await self.db.post_rdv_queue.insert_one(queue_entry)
            messages_created.append({k: v for k, v in queue_entry.items() if k != "_id"})
        
        # Lancer l'envoi immédiat en arrière-plan
        for msg in messages_created:
            asyncio.create_task(self.process_queue_item(msg["id"]))
        
        return {
            "success": True,
            "messages_queued": len(messages_created),
            "messages": messages_created
        }
    
    async def _get_template(self, business_id: str, template_key: str) -> Optional[Dict]:
        """Récupère un template (custom ou par défaut)"""
        # Chercher un template custom
        custom = await self.db.post_rdv_templates.find_one(
            {"business_id": business_id, "key": template_key, "active": True},
            {"_id": 0}
        )
        if custom:
            return custom
        
        # Retourner le template par défaut
        return DEFAULT_POST_RDV_TEMPLATES.get(template_key)
    
    # ============= TRAITEMENT DE LA QUEUE =============
    
    async def process_queue_item(self, queue_id: str) -> Dict[str, Any]:
        """Traite un élément de la queue (envoi ou retry)"""
        now = datetime.now(timezone.utc)
        
        # Récupérer et verrouiller l'item
        item = await self.db.post_rdv_queue.find_one_and_update(
            {"id": queue_id, "status": {"$in": ["pending", "retrying"]}},
            {"$set": {"status": "sending", "updated_at": now.isoformat()}},
            return_document=True
        )
        
        if not item:
            return {"error": "Queue item not found or already processed"}
        
        # Tenter l'envoi
        result = await self._send_message(item)
        
        if result["success"]:
            # Succès
            await self.db.post_rdv_queue.update_one(
                {"id": queue_id},
                {"$set": {
                    "status": MessageQueueStatus.SENT.value,
                    "sent_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    "channel": result.get("channel", item["channel"])
                }}
            )
            
            # Logger l'événement
            await self._log_event(item, "sent", result)
            
            return {"success": True, "status": "sent"}
        
        # Échec - tenter fallback ou retry
        return await self._handle_failure(item, result)
    
    async def _send_message(self, item: Dict) -> Dict:
        """Envoie le message via le canal approprié avec vérification des crédits"""
        channel = item["channel"]
        recipient = item["recipient"]
        message = item["message"]
        business_id = item["business_id"]
        
        # Importer le service de crédits
        from services.credits_service import CreditsService, EmailService, CreditType
        credits_service = CreditsService(self.db)
        
        # Mapper le canal au type de crédit
        credit_type_map = {
            "sms": CreditType.SMS,
            "whatsapp": CreditType.WHATSAPP,
            "email": CreditType.EMAIL
        }
        
        credit_type = credit_type_map.get(channel)
        if credit_type:
            # Vérifier les crédits AVANT envoi
            check = await credits_service.check_credits(business_id, credit_type)
            if not check.get("can_send") and not check.get("unlimited"):
                return {
                    "success": False,
                    "error": f"Crédits {channel} épuisés",
                    "channel": channel,
                    "needs_upgrade": True
                }
        
        try:
            if self.simulation_mode:
                # Mode simulation
                logger.info(f"📤 [SIMULATION] {channel.upper()} → {recipient}: {message[:80]}...")
                result = {
                    "success": True,
                    "channel": channel,
                    "simulation": True,
                    "message_id": f"SIM-{uuid.uuid4().hex[:8]}"
                }
            else:
                # Mode réel
                if channel == "sms":
                    result = await self._send_sms(recipient, message)
                elif channel == "whatsapp":
                    result = await self._send_whatsapp(recipient, message)
                elif channel == "email":
                    # Utiliser le service email avec Resend
                    email_service = EmailService(self.db)
                    result = await email_service.send_email(
                        business_id=business_id,
                        to_email=item.get("client_email", recipient),
                        subject=f"Message de {item.get('business_name', 'votre établissement')}",
                        html_content=f"<p>{message.replace(chr(10), '<br>')}</p>",
                        track_usage=False  # On gère les crédits ici
                    )
                else:
                    return {"success": False, "error": f"Unknown channel: {channel}"}
            
            # Consommer le crédit si envoi réussi
            if result.get("success") and credit_type:
                await credits_service.consume_credit(
                    business_id,
                    credit_type,
                    1,
                    {"recipient": recipient, "channel": channel, "queue_id": item["id"]}
                )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Erreur envoi {channel}: {str(e)}")
            return {"success": False, "error": str(e), "channel": channel}
    
    async def _handle_failure(self, item: Dict, result: Dict) -> Dict:
        """Gère les échecs avec fallback et retry"""
        now = datetime.now(timezone.utc)
        
        # Essayer le fallback
        fallback_channels = item.get("fallback_channels", [])
        current_index = item.get("current_channel_index", 0)
        
        if current_index < len(fallback_channels):
            # Tenter le canal suivant
            next_channel = fallback_channels[current_index]
            
            await self.db.post_rdv_queue.update_one(
                {"id": item["id"]},
                {"$set": {
                    "channel": next_channel,
                    "current_channel_index": current_index + 1,
                    "status": MessageQueueStatus.FALLBACK.value,
                    "error_message": f"Fallback de {item['channel']} vers {next_channel}: {result.get('error')}",
                    "updated_at": now.isoformat()
                }}
            )
            
            logger.info(f"🔄 Fallback: {item['channel']} → {next_channel}")
            
            # Réessayer immédiatement avec le nouveau canal
            return await self.process_queue_item(item["id"])
        
        # Pas de fallback disponible, passer en retry
        retry_count = item.get("retry_count", 0)
        
        if retry_count < self.max_retries:
            # Planifier un retry
            delay = self.retry_delays[min(retry_count, len(self.retry_delays) - 1)]
            next_retry = now + timedelta(seconds=delay)
            
            await self.db.post_rdv_queue.update_one(
                {"id": item["id"]},
                {"$set": {
                    "status": MessageQueueStatus.RETRYING.value,
                    "retry_count": retry_count + 1,
                    "next_retry_at": next_retry.isoformat(),
                    "error_message": result.get("error"),
                    "updated_at": now.isoformat()
                }}
            )
            
            logger.info(f"⏰ Retry #{retry_count + 1} planifié dans {delay}s pour {item['id']}")
            
            return {
                "success": False,
                "status": "retrying",
                "next_retry_at": next_retry.isoformat()
            }
        
        # Échec définitif
        await self.db.post_rdv_queue.update_one(
            {"id": item["id"]},
            {"$set": {
                "status": MessageQueueStatus.FAILED.value,
                "error_message": result.get("error"),
                "updated_at": now.isoformat()
            }}
        )
        
        await self._log_event(item, "failed", result)
        
        return {"success": False, "status": "failed", "error": result.get("error")}
    
    # ============= ENVOI RÉEL (Twilio/SMTP) =============
    
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
                "success": True,
                "channel": "sms",
                "message_id": message.sid
            }
        except Exception as e:
            return {"success": False, "error": str(e), "channel": "sms"}
    
    async def _send_whatsapp(self, to: str, body: str) -> Dict:
        """Envoie un WhatsApp via Twilio"""
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=body,
                from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
                to=f"whatsapp:{to}"
            )
            return {
                "success": True,
                "channel": "whatsapp",
                "message_id": message.sid
            }
        except Exception as e:
            return {"success": False, "error": str(e), "channel": "whatsapp"}
    
    async def _send_email(self, to: str, subject: str, body: str) -> Dict:
        """Envoie un email via SMTP"""
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            if not SMTP_HOST:
                # Simulation si pas configuré
                logger.info(f"📧 [SIMULATION] Email → {to}: {subject}")
                return {"success": True, "channel": "email", "simulation": True}
            
            msg = MIMEMultipart()
            msg['From'] = SMTP_FROM
            msg['To'] = to
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            with smtplib.SMTP(SMTP_HOST, int(SMTP_PORT)) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
            
            return {"success": True, "channel": "email"}
            
        except Exception as e:
            return {"success": False, "error": str(e), "channel": "email"}
    
    # ============= LOGGING & ANALYTICS =============
    
    async def _log_event(self, item: Dict, event_type: str, details: Dict):
        """Log un événement pour analytics"""
        log_entry = {
            "id": str(uuid.uuid4()),
            "queue_id": item["id"],
            "appointment_id": item["appointment_id"],
            "business_id": item["business_id"],
            "message_type": item.get("message_type"),
            "channel": item.get("channel"),
            "event_type": event_type,  # sent, failed, clicked
            "details": details,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.post_rdv_logs.insert_one(log_entry)
    
    # ============= WORKER POUR RETRY AUTOMATIQUE =============
    
    async def process_retry_queue(self):
        """Traite les messages en attente de retry (appelé périodiquement)"""
        now = datetime.now(timezone.utc)
        
        # Trouver les messages à retrier
        items = await self.db.post_rdv_queue.find({
            "status": MessageQueueStatus.RETRYING.value,
            "next_retry_at": {"$lte": now.isoformat()}
        }, {"_id": 0}).to_list(100)
        
        results = []
        for item in items:
            # Remettre en pending pour traitement
            await self.db.post_rdv_queue.update_one(
                {"id": item["id"]},
                {"$set": {"status": MessageQueueStatus.PENDING.value}}
            )
            result = await self.process_queue_item(item["id"])
            results.append({"id": item["id"], "result": result})
        
        return {"processed": len(results), "results": results}
    
    # ============= ANALYTICS TEMPS RÉEL =============
    
    async def get_business_analytics(self, business_id: str, days: int = 30) -> Dict:
        """Statistiques pour le dashboard business"""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        pipeline = [
            {"$match": {"business_id": business_id, "created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        status_counts = {}
        async for doc in self.db.post_rdv_queue.aggregate(pipeline):
            status_counts[doc["_id"]] = doc["count"]
        
        # Stats par type de message
        type_pipeline = [
            {"$match": {"business_id": business_id, "created_at": {"$gte": since}}},
            {"$group": {
                "_id": "$message_type",
                "total": {"$sum": 1},
                "sent": {"$sum": {"$cond": [{"$eq": ["$status", "sent"]}, 1, 0]}},
                "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}}
            }}
        ]
        
        by_type = []
        async for doc in self.db.post_rdv_queue.aggregate(type_pipeline):
            by_type.append(doc)
        
        # Taux d'engagement (clics)
        clicked = await self.db.post_rdv_queue.count_documents({
            "business_id": business_id,
            "created_at": {"$gte": since},
            "$or": [
                {"click_tracking.google_review_clicked": True},
                {"click_tracking.wheel_clicked": True}
            ]
        })
        
        total_sent = status_counts.get("sent", 0) + status_counts.get("delivered", 0)
        engagement_rate = (clicked / total_sent * 100) if total_sent > 0 else 0
        
        return {
            "total_messages": sum(status_counts.values()),
            "by_status": status_counts,
            "by_type": by_type,
            "sent": total_sent,
            "failed": status_counts.get("failed", 0),
            "pending": status_counts.get("pending", 0) + status_counts.get("retrying", 0),
            "engagement": {
                "clicks": clicked,
                "rate": round(engagement_rate, 1)
            },
            "period_days": days
        }
    
    async def get_admin_analytics(self) -> Dict:
        """Statistiques globales pour Super Admin"""
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        
        # Volume total aujourd'hui
        today_count = await self.db.post_rdv_queue.count_documents({
            "created_at": {"$gte": f"{today}T00:00:00"}
        })
        
        # Par statut global
        status_pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        global_status = {}
        async for doc in self.db.post_rdv_queue.aggregate(status_pipeline):
            global_status[doc["_id"]] = doc["count"]
        
        # Top entreprises par volume
        top_pipeline = [
            {"$group": {
                "_id": "$business_id",
                "total": {"$sum": 1},
                "sent": {"$sum": {"$cond": [{"$in": ["$status", ["sent", "delivered"]]}, 1, 0]}}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 10}
        ]
        
        top_businesses = []
        async for doc in self.db.post_rdv_queue.aggregate(top_pipeline):
            biz = await self.db.businesses.find_one({"id": doc["_id"]}, {"_id": 0, "name": 1})
            top_businesses.append({
                "business_id": doc["_id"],
                "business_name": biz.get("name") if biz else "Unknown",
                "total": doc["total"],
                "sent": doc["sent"],
                "success_rate": round(doc["sent"] / doc["total"] * 100, 1) if doc["total"] > 0 else 0
            })
        
        # Échecs récents (pour monitoring)
        recent_failures = await self.db.post_rdv_queue.find(
            {"status": "failed"},
            {"_id": 0, "id": 1, "business_id": 1, "error_message": 1, "updated_at": 1}
        ).sort("updated_at", -1).limit(10).to_list(10)
        
        return {
            "today_volume": today_count,
            "global_status": global_status,
            "top_businesses": top_businesses,
            "recent_failures": recent_failures,
            "system_status": "simulation" if self.simulation_mode else "live",
            "generated_at": now.isoformat()
        }
    
    # ============= GESTION DES TEMPLATES =============
    
    async def get_business_templates(self, business_id: str) -> List[Dict]:
        """Récupère les templates d'une entreprise"""
        # Templates custom
        custom = await self.db.post_rdv_templates.find(
            {"business_id": business_id},
            {"_id": 0}
        ).to_list(50)
        
        # Ajouter les templates par défaut
        defaults = []
        for key, template in DEFAULT_POST_RDV_TEMPLATES.items():
            defaults.append({
                "key": key,
                "is_default": True,
                **template
            })
        
        return {"custom": custom, "defaults": defaults}
    
    async def save_business_template(self, business_id: str, template: Dict) -> Dict:
        """Sauvegarde un template personnalisé"""
        template_id = template.get("id") or str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        template_doc = {
            "id": template_id,
            "business_id": business_id,
            "key": template.get("key", f"custom_{template_id[:8]}"),
            "name": template.get("name", "Template personnalisé"),
            "type": template.get("type", "thankyou"),
            "message_fr": template.get("message_fr", ""),
            "message_en": template.get("message_en", ""),
            "channels": template.get("channels", ["sms"]),
            "include_link": template.get("include_link", False),
            "link_key": template.get("link_key"),
            "active": template.get("active", True),
            "is_default": False,
            "created_at": template.get("created_at", now.isoformat()),
            "updated_at": now.isoformat()
        }
        
        await self.db.post_rdv_templates.update_one(
            {"id": template_id, "business_id": business_id},
            {"$set": template_doc},
            upsert=True
        )
        
        return template_doc
    
    async def update_business_settings(self, business_id: str, settings: Dict) -> Dict:
        """Met à jour les paramètres post-RDV d'une entreprise"""
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$set": {"post_rdv_settings": settings, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True}
