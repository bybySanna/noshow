"""
NoShowGone - Service de Templates de Notifications
Permet aux entreprises de personnaliser leurs messages de rappel.

Variables disponibles:
- {{client_name}} - Nom du client
- {{business_name}} - Nom de l'entreprise
- {{date}} - Date du RDV
- {{time}} - Heure du RDV
- {{service}} - Service réservé
- {{address}} - Adresse de l'entreprise
- {{confirmation_link}} - Lien de confirmation
- {{booking_link}} - Lien pour prendre RDV
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
import re

logger = logging.getLogger(__name__)

# Templates par défaut
DEFAULT_TEMPLATES = {
    "reminder_24h": {
        "id": "reminder_24h",
        "name_fr": "Rappel 24h avant",
        "name_en": "24h Reminder",
        "subject_fr": "Rappel: RDV demain - {{business_name}}",
        "subject_en": "Reminder: Appointment tomorrow - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Rappel: votre RDV est demain le {{date}} à {{time}} chez {{business_name}}.

✅ Confirmer: {{confirmation_link}}
❌ Annuler ou reporter: {{confirmation_link}}

À demain!
{{business_name}}""",
        "body_en": """Hello {{client_name}},

Reminder: your appointment is tomorrow on {{date}} at {{time}} at {{business_name}}.

✅ Confirm: {{confirmation_link}}
❌ Cancel or reschedule: {{confirmation_link}}

See you tomorrow!
{{business_name}}""",
        "channels": ["email", "sms", "whatsapp"],
        "is_active": True,
        "is_default": True,
        "order": 1
    },
    "reminder_3h": {
        "id": "reminder_3h",
        "name_fr": "Rappel 3h avant",
        "name_en": "3h Reminder",
        "subject_fr": "Rappel: RDV dans 3h - {{business_name}}",
        "subject_en": "Reminder: Appointment in 3h - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Votre RDV est dans 3 heures aujourd'hui à {{time}} chez {{business_name}}.

📍 Adresse: {{address}}

À très vite!
{{business_name}}""",
        "body_en": """Hello {{client_name}},

Your appointment is in 3 hours today at {{time}} at {{business_name}}.

📍 Address: {{address}}

See you very soon!
{{business_name}}""",
        "channels": ["sms", "whatsapp"],
        "is_active": True,
        "is_default": True,
        "order": 2
    },
    "reminder_30min": {
        "id": "reminder_30min",
        "name_fr": "Rappel 30 min avant",
        "name_en": "30min Reminder",
        "subject_fr": "Rappel: RDV dans 30min",
        "subject_en": "Reminder: Appointment in 30min",
        "body_fr": "⏰ {{client_name}}, votre RDV est dans 30 minutes à {{time}} chez {{business_name}}!",
        "body_en": "⏰ {{client_name}}, your appointment is in 30 minutes at {{time}} at {{business_name}}!",
        "channels": ["sms", "whatsapp"],
        "is_active": False,
        "is_default": True,
        "order": 3
    },
    "confirmation_request": {
        "id": "confirmation_request",
        "name_fr": "Demande de confirmation",
        "name_en": "Confirmation request",
        "subject_fr": "Confirmez votre RDV - {{business_name}}",
        "subject_en": "Confirm your appointment - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Vous avez un RDV le {{date}} à {{time}} chez {{business_name}}.

👉 Confirmez votre présence: {{confirmation_link}}

À bientôt!
{{business_name}}""",
        "body_en": """Hello {{client_name}},

You have an appointment on {{date}} at {{time}} at {{business_name}}.

👉 Confirm your attendance: {{confirmation_link}}

See you soon!
{{business_name}}""",
        "channels": ["email", "sms", "whatsapp"],
        "is_active": True,
        "is_default": True,
        "order": 0
    },
    "cancellation": {
        "id": "cancellation",
        "name_fr": "Annulation",
        "name_en": "Cancellation",
        "subject_fr": "RDV annulé - {{business_name}}",
        "subject_en": "Appointment cancelled - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Votre RDV du {{date}} à {{time}} a été annulé.

Pour reprendre RDV: {{booking_link}}

{{business_name}}""",
        "body_en": """Hello {{client_name}},

Your appointment on {{date}} at {{time}} has been cancelled.

To book again: {{booking_link}}

{{business_name}}""",
        "channels": ["email", "sms"],
        "is_active": True,
        "is_default": True,
        "order": 4
    },
    "reschedule": {
        "id": "reschedule",
        "name_fr": "Report de RDV",
        "name_en": "Rescheduled",
        "subject_fr": "RDV reporté - {{business_name}}",
        "subject_en": "Appointment rescheduled - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Votre RDV a été reporté au {{date}} à {{time}}.

👉 Confirmer: {{confirmation_link}}

{{business_name}}""",
        "body_en": """Hello {{client_name}},

Your appointment has been rescheduled to {{date}} at {{time}}.

👉 Confirm: {{confirmation_link}}

{{business_name}}""",
        "channels": ["email", "sms", "whatsapp"],
        "is_active": True,
        "is_default": True,
        "order": 5
    }
}

# Variables disponibles
AVAILABLE_VARIABLES = [
    {"key": "client_name", "label_fr": "Nom du client", "label_en": "Client name", "example": "Jean Dupont"},
    {"key": "business_name", "label_fr": "Nom de l'entreprise", "label_en": "Business name", "example": "Restaurant Bella Napoli"},
    {"key": "date", "label_fr": "Date du RDV", "label_en": "Appointment date", "example": "25/02/2026"},
    {"key": "time", "label_fr": "Heure du RDV", "label_en": "Appointment time", "example": "14:30"},
    {"key": "service", "label_fr": "Service réservé", "label_en": "Service booked", "example": "Coupe + Coloration"},
    {"key": "address", "label_fr": "Adresse", "label_en": "Address", "example": "15 rue de la Paix, 75002 Paris"},
    {"key": "confirmation_link", "label_fr": "Lien de confirmation", "label_en": "Confirmation link", "example": "https://noshow.com/confirm/abc123"},
    {"key": "booking_link", "label_fr": "Lien de réservation", "label_en": "Booking link", "example": "https://noshow.com/book/xyz"},
]


class TemplateService:
    """Service de gestion des templates de notifications"""
    
    def __init__(self, db):
        self.db = db
        logger.info("📝 TemplateService initialisé")
    
    async def get_templates(self, business_id: str) -> List[Dict]:
        """Récupère les templates d'une entreprise"""
        
        # Récupérer les templates personnalisés
        custom = await self.db.notification_templates.find(
            {"business_id": business_id},
            {"_id": 0}
        ).to_list(50)
        
        # Créer un dict des templates personnalisés par ID
        custom_by_id = {t["id"]: t for t in custom}
        
        # Fusionner avec les templates par défaut
        templates = []
        for template_id, default in DEFAULT_TEMPLATES.items():
            if template_id in custom_by_id:
                # Template personnalisé existe
                template = {**default, **custom_by_id[template_id]}
                template["is_customized"] = True
            else:
                # Utiliser le défaut
                template = {**default}
                template["is_customized"] = False
            templates.append(template)
        
        # Ajouter les templates custom qui ne sont pas des défauts
        for template in custom:
            if template["id"] not in DEFAULT_TEMPLATES:
                template["is_customized"] = True
                template["is_default"] = False
                templates.append(template)
        
        # Trier par ordre
        templates.sort(key=lambda t: t.get("order", 99))
        
        return templates
    
    async def get_template(self, business_id: str, template_id: str) -> Optional[Dict]:
        """Récupère un template spécifique"""
        
        # D'abord chercher un template personnalisé
        custom = await self.db.notification_templates.find_one(
            {"business_id": business_id, "id": template_id},
            {"_id": 0}
        )
        
        if custom:
            default = DEFAULT_TEMPLATES.get(template_id, {})
            return {**default, **custom, "is_customized": True}
        
        # Sinon retourner le défaut
        if template_id in DEFAULT_TEMPLATES:
            return {**DEFAULT_TEMPLATES[template_id], "is_customized": False}
        
        return None
    
    async def save_template(
        self,
        business_id: str,
        template_id: str,
        data: Dict
    ) -> Dict:
        """Sauvegarde ou met à jour un template"""
        
        template = {
            "id": template_id,
            "business_id": business_id,
            "name_fr": data.get("name_fr"),
            "name_en": data.get("name_en"),
            "subject_fr": data.get("subject_fr"),
            "subject_en": data.get("subject_en"),
            "body_fr": data.get("body_fr"),
            "body_en": data.get("body_en"),
            "channels": data.get("channels", ["email"]),
            "is_active": data.get("is_active", True),
            "order": data.get("order", 99),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Filtrer les None
        template = {k: v for k, v in template.items() if v is not None}
        
        await self.db.notification_templates.update_one(
            {"business_id": business_id, "id": template_id},
            {"$set": template},
            upsert=True
        )
        
        logger.info(f"📝 Template {template_id} sauvegardé pour business {business_id}")
        
        return await self.get_template(business_id, template_id)
    
    async def create_custom_template(
        self,
        business_id: str,
        data: Dict
    ) -> Dict:
        """Crée un nouveau template personnalisé"""
        
        template_id = f"custom_{uuid.uuid4().hex[:8]}"
        
        template = {
            "id": template_id,
            "business_id": business_id,
            "name_fr": data.get("name_fr", "Nouveau template"),
            "name_en": data.get("name_en", "New template"),
            "subject_fr": data.get("subject_fr", ""),
            "subject_en": data.get("subject_en", ""),
            "body_fr": data.get("body_fr", ""),
            "body_en": data.get("body_en", ""),
            "channels": data.get("channels", ["email"]),
            "is_active": data.get("is_active", True),
            "is_default": False,
            "order": data.get("order", 99),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.notification_templates.insert_one(template)
        
        return {k: v for k, v in template.items() if k != "_id"}
    
    async def delete_template(self, business_id: str, template_id: str) -> Dict:
        """Supprime un template personnalisé (remet le défaut)"""
        
        # Ne peut pas supprimer les templates par défaut, juste reset
        if template_id in DEFAULT_TEMPLATES:
            await self.db.notification_templates.delete_one({
                "business_id": business_id,
                "id": template_id
            })
            return {"success": True, "message": "Template reset to default"}
        
        # Supprimer complètement les templates custom
        result = await self.db.notification_templates.delete_one({
            "business_id": business_id,
            "id": template_id
        })
        
        return {
            "success": result.deleted_count > 0,
            "message": "Template deleted" if result.deleted_count > 0 else "Template not found"
        }
    
    async def reset_template(self, business_id: str, template_id: str) -> Dict:
        """Remet un template à sa valeur par défaut"""
        
        if template_id not in DEFAULT_TEMPLATES:
            return {"error": "Not a default template"}
        
        await self.db.notification_templates.delete_one({
            "business_id": business_id,
            "id": template_id
        })
        
        return {
            "success": True,
            "template": DEFAULT_TEMPLATES[template_id]
        }
    
    def render_template(
        self,
        template: Dict,
        variables: Dict,
        lang: str = "fr"
    ) -> Dict[str, str]:
        """Rend un template avec les variables"""
        
        subject_key = f"subject_{lang}"
        body_key = f"body_{lang}"
        
        subject = template.get(subject_key, template.get("subject_fr", ""))
        body = template.get(body_key, template.get("body_fr", ""))
        
        # Remplacer les variables
        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            subject = subject.replace(placeholder, str(value or ""))
            body = body.replace(placeholder, str(value or ""))
        
        return {
            "subject": subject,
            "body": body
        }
    
    def get_available_variables(self) -> List[Dict]:
        """Retourne la liste des variables disponibles"""
        return AVAILABLE_VARIABLES
    
    async def preview_template(
        self,
        business_id: str,
        template_id: str,
        lang: str = "fr"
    ) -> Dict:
        """Prévisualise un template avec des données exemple"""
        
        template = await self.get_template(business_id, template_id)
        if not template:
            return {"error": "Template not found"}
        
        # Variables d'exemple
        example_vars = {v["key"]: v["example"] for v in AVAILABLE_VARIABLES}
        
        rendered = self.render_template(template, example_vars, lang)
        
        return {
            "template_id": template_id,
            "lang": lang,
            "subject": rendered["subject"],
            "body": rendered["body"],
            "variables_used": example_vars
        }


class NotificationFallbackService:
    """Service de gestion des fallbacks multi-canaux"""
    
    def __init__(self, db):
        self.db = db
        logger.info("📡 NotificationFallbackService initialisé")
    
    async def send_with_fallback(
        self,
        business_id: str,
        appointment_id: str,
        recipient: Dict,
        template_id: str,
        variables: Dict,
        preferred_channel: str = "sms",
        lang: str = "fr"
    ) -> Dict:
        """
        Envoie une notification avec fallback automatique.
        Ordre de fallback: preferred_channel -> sms -> whatsapp -> email
        """
        
        # Définir l'ordre des canaux
        channel_order = self._get_channel_order(preferred_channel)
        
        notification_log = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "appointment_id": appointment_id,
            "template_id": template_id,
            "recipient": recipient,
            "attempts": [],
            "final_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        for channel in channel_order:
            if not self._can_use_channel(channel, recipient):
                continue
            
            attempt = {
                "channel": channel,
                "attempted_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending"
            }
            
            try:
                # Simuler l'envoi (en production, appeler le vrai service)
                result = await self._send_notification(
                    channel, recipient, template_id, variables, lang
                )
                
                attempt["status"] = result.get("status", "sent")
                attempt["message_id"] = result.get("message_id")
                
                if result.get("status") == "sent":
                    notification_log["attempts"].append(attempt)
                    notification_log["final_status"] = "sent"
                    notification_log["sent_via"] = channel
                    break
                else:
                    attempt["error"] = result.get("error", "Unknown error")
                    notification_log["attempts"].append(attempt)
                    
            except Exception as e:
                attempt["status"] = "failed"
                attempt["error"] = str(e)
                notification_log["attempts"].append(attempt)
                logger.warning(f"📡 Fallback: {channel} échoué, tentative suivante...")
        
        # Si tous les canaux ont échoué
        if notification_log["final_status"] == "pending":
            notification_log["final_status"] = "failed"
        
        # Sauvegarder le log
        await self.db.notification_logs.insert_one(notification_log)
        
        return {k: v for k, v in notification_log.items() if k != "_id"}
    
    def _get_channel_order(self, preferred: str) -> List[str]:
        """Retourne l'ordre des canaux pour le fallback"""
        
        all_channels = ["sms", "whatsapp", "email"]
        
        if preferred in all_channels:
            all_channels.remove(preferred)
            return [preferred] + all_channels
        
        return all_channels
    
    def _can_use_channel(self, channel: str, recipient: Dict) -> bool:
        """Vérifie si un canal peut être utilisé pour ce destinataire"""
        
        if channel in ["sms", "whatsapp"]:
            return bool(recipient.get("phone"))
        elif channel == "email":
            return bool(recipient.get("email"))
        
        return False
    
    async def _send_notification(
        self,
        channel: str,
        recipient: Dict,
        template_id: str,
        variables: Dict,
        lang: str
    ) -> Dict:
        """Envoie une notification via un canal spécifique (simulation)"""
        
        # En mode simulation, on log et retourne succès
        logger.info(f"📤 [SIMULATION] {channel.upper()} → {recipient.get('phone') or recipient.get('email')}")
        
        return {
            "status": "sent",
            "message_id": f"sim_{uuid.uuid4().hex[:12]}",
            "channel": channel,
            "simulation_mode": True
        }
    
    async def get_notification_logs(
        self,
        business_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """Récupère les logs de notifications"""
        
        logs = await self.db.notification_logs.find(
            {"business_id": business_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return logs
    
    async def retry_notification(self, notification_id: str) -> Dict:
        """Retente l'envoi d'une notification échouée"""
        
        log = await self.db.notification_logs.find_one(
            {"id": notification_id},
            {"_id": 0}
        )
        
        if not log:
            return {"error": "Notification not found"}
        
        if log.get("final_status") != "failed":
            return {"error": "Notification already sent"}
        
        # Retenter avec fallback
        result = await self.send_with_fallback(
            log["business_id"],
            log["appointment_id"],
            log["recipient"],
            log["template_id"],
            {},  # Variables à récupérer
            "email"  # Commencer par email pour le retry
        )
        
        return result
