"""
NoShowGone - Service de Notation et Fidélisation des Clients
Permet aux entreprises de noter leurs clients après chaque RDV terminé.

Fonctionnalités:
- Notation ponctualité (1-5 étoiles)
- Notation comportement (1-5 étoiles)
- Notes personnalisées
- Score de confiance partagé (opt-in)
- Messages de remerciement automatiques
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import uuid

logger = logging.getLogger(__name__)

# Badges de fidélité
LOYALTY_BADGES = [
    {"id": "newcomer", "name_fr": "Nouveau client", "name_en": "Newcomer", "min_visits": 1, "icon": "🌟", "color": "#3b82f6"},
    {"id": "regular", "name_fr": "Client régulier", "name_en": "Regular", "min_visits": 5, "icon": "⭐", "color": "#f59e0b"},
    {"id": "loyal", "name_fr": "Client fidèle", "name_en": "Loyal", "min_visits": 10, "icon": "🏆", "color": "#15803d"},
    {"id": "vip", "name_fr": "VIP", "name_en": "VIP", "min_visits": 25, "icon": "💎", "color": "#8b5cf6"},
    {"id": "ambassador", "name_fr": "Ambassadeur", "name_en": "Ambassador", "min_visits": 50, "icon": "👑", "color": "#dc2626"},
]

# Templates de messages de remerciement par défaut
DEFAULT_THANK_YOU_TEMPLATES = {
    "standard": {
        "id": "standard",
        "name_fr": "Remerciement standard",
        "name_en": "Standard thank you",
        "subject_fr": "Merci pour votre visite - {{business_name}}",
        "subject_en": "Thank you for your visit - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Merci d'avoir honoré votre RDV du {{date}} chez {{business_name}} !

Nous espérons que votre expérience a été agréable et avons hâte de vous revoir.

{{custom_message}}

À très bientôt !
{{business_name}}""",
        "body_en": """Hello {{client_name}},

Thank you for honoring your appointment on {{date}} at {{business_name}}!

We hope your experience was pleasant and look forward to seeing you again.

{{custom_message}}

See you soon!
{{business_name}}""",
        "include_booking_link": True,
        "include_rating_link": False
    },
    "with_offer": {
        "id": "with_offer",
        "name_fr": "Remerciement avec offre",
        "name_en": "Thank you with offer",
        "subject_fr": "Merci + Offre spéciale - {{business_name}}",
        "subject_en": "Thank you + Special offer - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

Un grand merci pour votre visite du {{date}} !

🎁 Pour vous remercier de votre fidélité, voici une offre exclusive :
{{custom_message}}

👉 Réserver maintenant : {{booking_link}}

À très bientôt !
{{business_name}}""",
        "body_en": """Hello {{client_name}},

A big thank you for your visit on {{date}}!

🎁 To thank you for your loyalty, here's an exclusive offer:
{{custom_message}}

👉 Book now: {{booking_link}}

See you soon!
{{business_name}}""",
        "include_booking_link": True,
        "include_rating_link": False
    },
    "loyalty_milestone": {
        "id": "loyalty_milestone",
        "name_fr": "Palier fidélité atteint",
        "name_en": "Loyalty milestone reached",
        "subject_fr": "🎉 Félicitations {{client_name}} ! - {{business_name}}",
        "subject_en": "🎉 Congratulations {{client_name}}! - {{business_name}}",
        "body_fr": """Bonjour {{client_name}},

🎉 Félicitations ! Vous avez atteint le statut {{loyalty_badge}} !

Vous avez effectué {{total_visits}} visites chez nous et nous vous en remercions chaleureusement.

{{custom_message}}

Votre fidélité compte énormément pour nous !
{{business_name}}""",
        "body_en": """Hello {{client_name}},

🎉 Congratulations! You've reached {{loyalty_badge}} status!

You've made {{total_visits}} visits with us and we warmly thank you.

{{custom_message}}

Your loyalty means so much to us!
{{business_name}}""",
        "include_booking_link": True,
        "include_rating_link": False
    }
}


class ClientRatingService:
    """Service de notation des clients"""
    
    def __init__(self, db):
        self.db = db
        logger.info("⭐ ClientRatingService initialisé")
    
    async def rate_client(
        self,
        business_id: str,
        appointment_id: str,
        client_phone: str,
        punctuality: int,  # 1-5
        behavior: int,  # 1-5
        note: Optional[str] = None,
        would_recommend: bool = True,
        share_score: bool = True  # Partager dans le réseau
    ) -> Dict[str, Any]:
        """Enregistre une notation pour un client après un RDV"""
        
        # Valider les scores
        punctuality = max(1, min(5, punctuality))
        behavior = max(1, min(5, behavior))
        
        rating = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "appointment_id": appointment_id,
            "client_phone": client_phone,
            "punctuality": punctuality,
            "behavior": behavior,
            "overall_score": round((punctuality + behavior) / 2, 1),
            "note": note,
            "would_recommend": would_recommend,
            "share_score": share_score,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.client_ratings.insert_one(rating)
        
        # Mettre à jour le score global du client
        await self._update_client_trust_score(client_phone, business_id, share_score)
        
        # Mettre à jour le RDV
        await self.db.appointments.update_one(
            {"id": appointment_id},
            {"$set": {"rated": True, "rating_id": rating["id"]}}
        )
        
        logger.info(f"⭐ Client {client_phone} noté: {rating['overall_score']}/5")
        
        return {k: v for k, v in rating.items() if k != "_id"}
    
    async def _update_client_trust_score(
        self,
        client_phone: str,
        business_id: str,
        share_score: bool
    ) -> None:
        """Met à jour le score de confiance global du client"""
        
        # Calculer le score moyen pour ce business
        pipeline = [
            {"$match": {"client_phone": client_phone, "business_id": business_id}},
            {"$group": {
                "_id": None,
                "avg_punctuality": {"$avg": "$punctuality"},
                "avg_behavior": {"$avg": "$behavior"},
                "avg_overall": {"$avg": "$overall_score"},
                "total_ratings": {"$sum": 1},
                "recommendations": {"$sum": {"$cond": ["$would_recommend", 1, 0]}}
            }}
        ]
        
        result = await self.db.client_ratings.aggregate(pipeline).to_list(1)
        
        if result:
            stats = result[0]
            
            # Sauvegarder le score pour ce business
            await self.db.client_trust_scores.update_one(
                {"client_phone": client_phone, "business_id": business_id},
                {"$set": {
                    "client_phone": client_phone,
                    "business_id": business_id,
                    "avg_punctuality": round(stats["avg_punctuality"], 2),
                    "avg_behavior": round(stats["avg_behavior"], 2),
                    "avg_overall": round(stats["avg_overall"], 2),
                    "total_ratings": stats["total_ratings"],
                    "recommendation_rate": round(stats["recommendations"] / stats["total_ratings"] * 100, 1),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
            
            # Si partage autorisé, mettre à jour le score global
            if share_score:
                await self._update_global_trust_score(client_phone)
    
    async def _update_global_trust_score(self, client_phone: str) -> None:
        """Calcule le score de confiance global (toutes entreprises)"""
        
        # Agrégation sur toutes les notations partagées
        pipeline = [
            {"$match": {"client_phone": client_phone, "share_score": True}},
            {"$group": {
                "_id": None,
                "avg_overall": {"$avg": "$overall_score"},
                "total_ratings": {"$sum": 1},
                "businesses_count": {"$addToSet": "$business_id"}
            }}
        ]
        
        result = await self.db.client_ratings.aggregate(pipeline).to_list(1)
        
        if result:
            stats = result[0]
            
            await self.db.global_trust_scores.update_one(
                {"client_phone": client_phone},
                {"$set": {
                    "client_phone": client_phone,
                    "global_score": round(stats["avg_overall"], 2),
                    "total_ratings": stats["total_ratings"],
                    "businesses_count": len(stats["businesses_count"]),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
    
    async def get_client_ratings(
        self,
        business_id: str,
        client_phone: str
    ) -> Dict[str, Any]:
        """Récupère les notations d'un client pour un business"""
        
        # Score local
        local_score = await self.db.client_trust_scores.find_one(
            {"client_phone": client_phone, "business_id": business_id},
            {"_id": 0}
        )
        
        # Score global
        global_score = await self.db.global_trust_scores.find_one(
            {"client_phone": client_phone},
            {"_id": 0}
        )
        
        # Dernières notations
        ratings = await self.db.client_ratings.find(
            {"client_phone": client_phone, "business_id": business_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Calculer le badge de fidélité
        completed_appts = await self.db.appointments.count_documents({
            "client_phone": client_phone,
            "business_id": business_id,
            "status": "completed"
        })
        
        badge = self._get_loyalty_badge(completed_appts)
        
        return {
            "local_score": local_score,
            "global_score": global_score,
            "recent_ratings": ratings,
            "completed_visits": completed_appts,
            "loyalty_badge": badge
        }
    
    async def get_unrated_appointments(self, business_id: str) -> List[Dict]:
        """Récupère les RDV terminés non notés"""
        
        appts = await self.db.appointments.find({
            "business_id": business_id,
            "status": "completed",
            "$or": [{"rated": {"$exists": False}}, {"rated": False}]
        }, {"_id": 0}).sort("date", -1).limit(50).to_list(50)
        
        return appts
    
    async def get_rating_stats(self, business_id: str) -> Dict[str, Any]:
        """Statistiques des notations pour un business"""
        
        pipeline = [
            {"$match": {"business_id": business_id}},
            {"$group": {
                "_id": None,
                "total_ratings": {"$sum": 1},
                "avg_punctuality": {"$avg": "$punctuality"},
                "avg_behavior": {"$avg": "$behavior"},
                "avg_overall": {"$avg": "$overall_score"},
                "recommendations": {"$sum": {"$cond": ["$would_recommend", 1, 0]}}
            }}
        ]
        
        result = await self.db.client_ratings.aggregate(pipeline).to_list(1)
        
        if not result:
            return {
                "total_ratings": 0,
                "avg_punctuality": 0,
                "avg_behavior": 0,
                "avg_overall": 0,
                "recommendation_rate": 0
            }
        
        stats = result[0]
        return {
            "total_ratings": stats["total_ratings"],
            "avg_punctuality": round(stats["avg_punctuality"], 2),
            "avg_behavior": round(stats["avg_behavior"], 2),
            "avg_overall": round(stats["avg_overall"], 2),
            "recommendation_rate": round(stats["recommendations"] / stats["total_ratings"] * 100, 1) if stats["total_ratings"] > 0 else 0
        }
    
    async def get_top_clients(self, business_id: str, limit: int = 10) -> List[Dict]:
        """Récupère les meilleurs clients (score + fidélité)"""
        
        scores = await self.db.client_trust_scores.find(
            {"business_id": business_id},
            {"_id": 0}
        ).sort("avg_overall", -1).limit(limit).to_list(limit)
        
        # Enrichir avec les infos client
        for score in scores:
            # Récupérer le dernier RDV pour avoir le nom
            last_appt = await self.db.appointments.find_one(
                {"business_id": business_id, "client_phone": score["client_phone"]},
                {"_id": 0, "client_name": 1}
            )
            score["client_name"] = last_appt.get("client_name") if last_appt else "Client"
            
            # Ajouter le badge
            completed = await self.db.appointments.count_documents({
                "client_phone": score["client_phone"],
                "business_id": business_id,
                "status": "completed"
            })
            score["loyalty_badge"] = self._get_loyalty_badge(completed)
            score["completed_visits"] = completed
        
        return scores
    
    def _get_loyalty_badge(self, visits: int) -> Dict:
        """Détermine le badge de fidélité selon le nombre de visites"""
        
        badge = LOYALTY_BADGES[0]  # Newcomer par défaut
        
        for b in LOYALTY_BADGES:
            if visits >= b["min_visits"]:
                badge = b
        
        return badge


class ThankYouService:
    """Service d'envoi de messages de remerciement"""
    
    def __init__(self, db):
        self.db = db
        logger.info("💌 ThankYouService initialisé")
    
    async def get_thank_you_templates(self, business_id: str) -> List[Dict]:
        """Récupère les templates de remerciement"""
        
        # Templates personnalisés
        custom = await self.db.thank_you_templates.find(
            {"business_id": business_id},
            {"_id": 0}
        ).to_list(20)
        
        custom_ids = {t["id"] for t in custom}
        
        # Ajouter les défauts non personnalisés
        templates = list(custom)
        for tid, template in DEFAULT_THANK_YOU_TEMPLATES.items():
            if tid not in custom_ids:
                templates.append({**template, "is_customized": False})
        
        return templates
    
    async def save_thank_you_template(
        self,
        business_id: str,
        template_id: str,
        data: Dict
    ) -> Dict:
        """Sauvegarde un template de remerciement"""
        
        template = {
            "id": template_id,
            "business_id": business_id,
            "name_fr": data.get("name_fr"),
            "name_en": data.get("name_en"),
            "subject_fr": data.get("subject_fr"),
            "subject_en": data.get("subject_en"),
            "body_fr": data.get("body_fr"),
            "body_en": data.get("body_en"),
            "include_booking_link": data.get("include_booking_link", True),
            "include_rating_link": data.get("include_rating_link", False),
            "custom_link": data.get("custom_link"),
            "custom_link_text": data.get("custom_link_text"),
            "is_customized": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        template = {k: v for k, v in template.items() if v is not None}
        
        await self.db.thank_you_templates.update_one(
            {"business_id": business_id, "id": template_id},
            {"$set": template},
            upsert=True
        )
        
        return template
    
    async def send_thank_you(
        self,
        business_id: str,
        appointment_id: str,
        template_id: str = "standard",
        custom_message: str = "",
        custom_link: Optional[str] = None
    ) -> Dict[str, Any]:
        """Envoie un message de remerciement"""
        
        # Récupérer le RDV
        appt = await self.db.appointments.find_one(
            {"id": appointment_id, "business_id": business_id},
            {"_id": 0}
        )
        
        if not appt:
            return {"error": "Appointment not found"}
        
        # Récupérer le business
        business = await self.db.businesses.find_one(
            {"id": business_id},
            {"_id": 0}
        )
        
        # Récupérer le template
        template = await self.db.thank_you_templates.find_one(
            {"business_id": business_id, "id": template_id},
            {"_id": 0}
        )
        
        if not template:
            template = DEFAULT_THANK_YOU_TEMPLATES.get(template_id, DEFAULT_THANK_YOU_TEMPLATES["standard"])
        
        # Préparer les variables
        variables = {
            "client_name": appt.get("client_name", "Client"),
            "business_name": business.get("name", ""),
            "date": appt.get("date", ""),
            "time": appt.get("time", ""),
            "custom_message": custom_message,
            "booking_link": custom_link or f"https://noshow.com/book/{business_id}"
        }
        
        # Ajouter les infos de fidélité si template loyalty
        if template_id == "loyalty_milestone":
            completed = await self.db.appointments.count_documents({
                "client_phone": appt.get("client_phone"),
                "business_id": business_id,
                "status": "completed"
            })
            badge = self._get_loyalty_badge(completed)
            variables["total_visits"] = completed
            variables["loyalty_badge"] = badge.get("name_fr", "")
        
        # Rendre le message
        body_fr = template.get("body_fr", "")
        for key, value in variables.items():
            body_fr = body_fr.replace("{{" + key + "}}", str(value or ""))
        
        # Enregistrer l'envoi
        thank_you_log = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "appointment_id": appointment_id,
            "client_phone": appt.get("client_phone"),
            "client_name": appt.get("client_name"),
            "template_id": template_id,
            "message": body_fr,
            "custom_link": custom_link,
            "status": "sent",  # Simulation
            "simulation_mode": True,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.thank_you_logs.insert_one(thank_you_log)
        
        # Marquer le RDV comme remercié
        await self.db.appointments.update_one(
            {"id": appointment_id},
            {"$set": {"thank_you_sent": True, "thank_you_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"💌 [SIMULATION] Remerciement envoyé à {appt.get('client_phone')}")
        
        return {k: v for k, v in thank_you_log.items() if k != "_id"}
    
    async def get_thank_you_logs(self, business_id: str, limit: int = 50) -> List[Dict]:
        """Récupère les logs de remerciements"""
        
        logs = await self.db.thank_you_logs.find(
            {"business_id": business_id},
            {"_id": 0}
        ).sort("sent_at", -1).limit(limit).to_list(limit)
        
        return logs
    
    async def get_pending_thank_yous(self, business_id: str) -> List[Dict]:
        """RDV terminés sans remerciement envoyé"""
        
        appts = await self.db.appointments.find({
            "business_id": business_id,
            "status": "completed",
            "$or": [{"thank_you_sent": {"$exists": False}}, {"thank_you_sent": False}]
        }, {"_id": 0}).sort("date", -1).limit(50).to_list(50)
        
        return appts
    
    def _get_loyalty_badge(self, visits: int) -> Dict:
        """Détermine le badge de fidélité"""
        badge = LOYALTY_BADGES[0]
        for b in LOYALTY_BADGES:
            if visits >= b["min_visits"]:
                badge = b
        return badge


# Export des badges pour l'API
def get_loyalty_badges():
    return LOYALTY_BADGES
