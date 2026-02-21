"""
NoShowGone - Service de Crédits et Facturation
Gestion des limites SMS/Email/WhatsApp par plan
Facturation automatique Stripe + Crédits prépayés
"""

import os
import uuid
import asyncio
import logging
import resend
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)

# Configuration Resend
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
DEFAULT_SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'notifications@noshowgone.com')

# Configuration Stripe
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Mode simulation
RESEND_SIMULATION = not RESEND_API_KEY or RESEND_API_KEY == ''

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Prix des crédits supplémentaires (en centimes)
CREDIT_PRICES = {
    "sms": {
        "unit_price_cents": 5,  # 0.05€ par SMS
        "packs": {
            "pack_50": {"quantity": 50, "price_cents": 200},     # 2€
            "pack_200": {"quantity": 200, "price_cents": 700},   # 7€
            "pack_500": {"quantity": 500, "price_cents": 1500},  # 15€
            "pack_1000": {"quantity": 1000, "price_cents": 2500} # 25€
        }
    },
    "email": {
        "unit_price_cents": 1,  # 0.01€ par email
        "packs": {
            "pack_100": {"quantity": 100, "price_cents": 50},     # 0.50€
            "pack_500": {"quantity": 500, "price_cents": 200},    # 2€
            "pack_2000": {"quantity": 2000, "price_cents": 600},  # 6€
            "pack_5000": {"quantity": 5000, "price_cents": 1200}  # 12€
        }
    },
    "whatsapp": {
        "unit_price_cents": 8,  # 0.08€ par WhatsApp
        "packs": {
            "pack_50": {"quantity": 50, "price_cents": 350},      # 3.50€
            "pack_200": {"quantity": 200, "price_cents": 1200},   # 12€
            "pack_500": {"quantity": 500, "price_cents": 2500}    # 25€
        }
    }
}

# Limites par défaut pour plan Trial/Free
DEFAULT_PLAN_LIMITS = {
    "sms_credits_monthly": 10,
    "email_credits_monthly": 50,
    "whatsapp_credits_monthly": 10,
    "appointments_monthly": 50,
    "staff_count": 1
}


class CreditType(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    WHATSAPP = "whatsapp"


class CreditsService:
    """Service de gestion des crédits et limites"""
    
    def __init__(self, db):
        self.db = db
        self.simulation_mode = RESEND_SIMULATION
        if self.simulation_mode:
            logger.info("📧 CreditsService: Resend en MODE SIMULATION")
    
    # ============= VÉRIFICATION DES CRÉDITS =============
    
    async def check_credits(self, business_id: str, credit_type: CreditType, quantity: int = 1) -> Dict:
        """
        Vérifie si l'entreprise a assez de crédits
        Retourne: {can_send, remaining, limit, usage_percent, needs_upgrade}
        """
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business not found"}
        
        # Récupérer le plan de l'entreprise
        plan_id = business.get("subscription", {}).get("plan_id")
        plan = await self._get_plan_limits(plan_id)
        
        # Récupérer l'usage du mois en cours
        usage = await self._get_monthly_usage(business_id, credit_type)
        
        # Crédits bonus achetés
        bonus_credits = business.get("bonus_credits", {}).get(credit_type.value, 0)
        
        # Calculer les limites
        monthly_limit = plan.get(f"{credit_type.value}_credits_monthly", 0)
        
        # -1 = illimité
        if monthly_limit == -1:
            return {
                "can_send": True,
                "remaining": -1,
                "limit": -1,
                "usage": usage,
                "usage_percent": 0,
                "needs_upgrade": False,
                "unlimited": True
            }
        
        total_available = monthly_limit + bonus_credits
        remaining = total_available - usage
        can_send = remaining >= quantity
        usage_percent = (usage / total_available * 100) if total_available > 0 else 100
        
        return {
            "can_send": can_send,
            "remaining": remaining,
            "limit": monthly_limit,
            "bonus_credits": bonus_credits,
            "total_available": total_available,
            "usage": usage,
            "usage_percent": round(usage_percent, 1),
            "needs_upgrade": not can_send,
            "unlimited": False
        }
    
    async def consume_credit(self, business_id: str, credit_type: CreditType, quantity: int = 1, details: Dict = None) -> Dict:
        """
        Consomme des crédits après envoi réussi
        Log l'utilisation pour analytics
        """
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        
        # Vérifier d'abord
        check = await self.check_credits(business_id, credit_type, quantity)
        if not check.get("can_send") and not check.get("unlimited"):
            return {"error": "Insufficient credits", "check": check}
        
        # Incrémenter l'usage
        usage_key = f"usage.{month_key}.{credit_type.value}"
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$inc": {usage_key: quantity}}
        )
        
        # Logger l'utilisation
        usage_log = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "credit_type": credit_type.value,
            "quantity": quantity,
            "month": month_key,
            "details": details or {},
            "created_at": now.isoformat()
        }
        await self.db.credit_usage_logs.insert_one(usage_log)
        
        # Vérifier si alerte nécessaire
        new_check = await self.check_credits(business_id, credit_type)
        if new_check.get("usage_percent", 0) >= 80:
            await self._create_credit_alert(business_id, credit_type, new_check)
        
        return {"success": True, "remaining": new_check.get("remaining")}
    
    async def _get_plan_limits(self, plan_id: str) -> Dict:
        """Récupère les limites du plan"""
        if not plan_id:
            return DEFAULT_PLAN_LIMITS
        
        plan = await self.db.plans.find_one({"id": plan_id}, {"_id": 0})
        if not plan:
            return DEFAULT_PLAN_LIMITS
        
        return {
            "sms_credits_monthly": plan.get("limits", {}).get("sms_credits", DEFAULT_PLAN_LIMITS["sms_credits_monthly"]),
            "email_credits_monthly": plan.get("limits", {}).get("email_credits", DEFAULT_PLAN_LIMITS["email_credits_monthly"]),
            "whatsapp_credits_monthly": plan.get("limits", {}).get("whatsapp_credits", DEFAULT_PLAN_LIMITS["whatsapp_credits_monthly"]),
            "appointments_monthly": plan.get("limits", {}).get("appointments_per_month", DEFAULT_PLAN_LIMITS["appointments_monthly"]),
            "staff_count": plan.get("limits", {}).get("staff_count", DEFAULT_PLAN_LIMITS["staff_count"])
        }
    
    async def _get_monthly_usage(self, business_id: str, credit_type: CreditType) -> int:
        """Récupère l'usage du mois en cours"""
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        
        business = await self.db.businesses.find_one(
            {"id": business_id},
            {"_id": 0, f"usage.{month_key}": 1}
        )
        
        if not business:
            return 0
        
        usage = business.get("usage", {}).get(month_key, {})
        return usage.get(credit_type.value, 0)
    
    async def _create_credit_alert(self, business_id: str, credit_type: CreditType, check: Dict):
        """Crée une alerte quand les crédits sont bas"""
        alert_type = "credits_low" if check.get("usage_percent") < 100 else "credits_exhausted"
        
        alert = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "type": alert_type,
            "credit_type": credit_type.value,
            "usage_percent": check.get("usage_percent"),
            "remaining": check.get("remaining"),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Éviter les doublons d'alertes
        existing = await self.db.business_notifications.find_one({
            "business_id": business_id,
            "type": alert_type,
            "credit_type": credit_type.value,
            "read": False
        })
        
        if not existing:
            await self.db.business_notifications.insert_one(alert)
    
    # ============= ACHAT DE CRÉDITS =============
    
    async def get_credit_packs(self) -> Dict:
        """Retourne les packs de crédits disponibles"""
        return CREDIT_PRICES
    
    async def purchase_credits_prepaid(self, business_id: str, credit_type: str, pack_key: str) -> Dict:
        """
        Achat de crédits prépayés (ajout immédiat)
        À utiliser après paiement Stripe confirmé
        """
        if credit_type not in CREDIT_PRICES:
            return {"error": f"Invalid credit type: {credit_type}"}
        
        packs = CREDIT_PRICES[credit_type]["packs"]
        if pack_key not in packs:
            return {"error": f"Invalid pack: {pack_key}"}
        
        pack = packs[pack_key]
        quantity = pack["quantity"]
        
        # Ajouter les crédits bonus
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$inc": {f"bonus_credits.{credit_type}": quantity}}
        )
        
        # Logger l'achat
        purchase = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "credit_type": credit_type,
            "pack_key": pack_key,
            "quantity": quantity,
            "price_cents": pack["price_cents"],
            "type": "prepaid",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.credit_purchases.insert_one(purchase)
        
        return {
            "success": True,
            "credits_added": quantity,
            "purchase_id": purchase["id"]
        }
    
    async def enable_pay_as_you_go(self, business_id: str, credit_types: List[str], auto_reload_threshold: int = 10) -> Dict:
        """Active le pay-as-you-go pour certains types de crédits"""
        settings = {
            "enabled": True,
            "credit_types": credit_types,
            "auto_reload_threshold": auto_reload_threshold,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$set": {"pay_as_you_go": settings}}
        )
        
        return {"success": True, "settings": settings}
    
    # ============= DASHBOARD CRÉDITS =============
    
    async def get_credits_dashboard(self, business_id: str) -> Dict:
        """Dashboard complet des crédits pour une entreprise"""
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business not found"}
        
        # Vérifier chaque type de crédit
        credits = {}
        for credit_type in CreditType:
            credits[credit_type.value] = await self.check_credits(business_id, credit_type)
        
        # Historique récent
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        last_month_key = (now - timedelta(days=30)).strftime("%Y-%m")
        
        usage_this_month = business.get("usage", {}).get(month_key, {})
        usage_last_month = business.get("usage", {}).get(last_month_key, {})
        
        # Pay-as-you-go status
        payg = business.get("pay_as_you_go", {"enabled": False})
        
        return {
            "credits": credits,
            "usage_this_month": usage_this_month,
            "usage_last_month": usage_last_month,
            "bonus_credits": business.get("bonus_credits", {}),
            "pay_as_you_go": payg,
            "packs_available": CREDIT_PRICES
        }
    
    # ============= ADMIN: GESTION DES LIMITES =============
    
    async def update_plan_limits(self, plan_id: str, limits: Dict) -> Dict:
        """Met à jour les limites d'un plan (Super Admin)"""
        update_data = {}
        
        if "sms_credits" in limits:
            update_data["limits.sms_credits"] = limits["sms_credits"]
        if "email_credits" in limits:
            update_data["limits.email_credits"] = limits["email_credits"]
        if "whatsapp_credits" in limits:
            update_data["limits.whatsapp_credits"] = limits["whatsapp_credits"]
        if "appointments_per_month" in limits:
            update_data["limits.appointments_per_month"] = limits["appointments_per_month"]
        if "staff_count" in limits:
            update_data["limits.staff_count"] = limits["staff_count"]
        
        if update_data:
            update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            await self.db.plans.update_one({"id": plan_id}, {"$set": update_data})
        
        return {"success": True}
    
    async def add_bonus_credits_admin(self, business_id: str, credit_type: str, quantity: int, reason: str = "") -> Dict:
        """Ajoute des crédits bonus manuellement (Super Admin)"""
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$inc": {f"bonus_credits.{credit_type}": quantity}}
        )
        
        # Logger
        log = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "credit_type": credit_type,
            "quantity": quantity,
            "type": "admin_bonus",
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.credit_purchases.insert_one(log)
        
        return {"success": True, "credits_added": quantity}
    
    async def get_global_usage_stats(self) -> Dict:
        """Statistiques globales d'utilisation (Super Admin)"""
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        
        # Agrégation par type
        pipeline = [
            {"$match": {"month": month_key}},
            {"$group": {
                "_id": "$credit_type",
                "total": {"$sum": "$quantity"},
                "count": {"$sum": 1}
            }}
        ]
        
        by_type = {}
        async for doc in self.db.credit_usage_logs.aggregate(pipeline):
            by_type[doc["_id"]] = {"total": doc["total"], "operations": doc["count"]}
        
        # Top consommateurs
        top_pipeline = [
            {"$match": {"month": month_key}},
            {"$group": {
                "_id": {"business_id": "$business_id", "credit_type": "$credit_type"},
                "total": {"$sum": "$quantity"}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 10}
        ]
        
        top_users = []
        async for doc in self.db.credit_usage_logs.aggregate(top_pipeline):
            biz = await self.db.businesses.find_one({"id": doc["_id"]["business_id"]}, {"_id": 0, "name": 1})
            top_users.append({
                "business_id": doc["_id"]["business_id"],
                "business_name": biz.get("name") if biz else "Unknown",
                "credit_type": doc["_id"]["credit_type"],
                "usage": doc["total"]
            })
        
        # Revenus des achats de crédits
        revenue_pipeline = [
            {"$group": {
                "_id": "$credit_type",
                "total_cents": {"$sum": "$price_cents"},
                "purchases": {"$sum": 1}
            }}
        ]
        
        revenue = {}
        async for doc in self.db.credit_purchases.aggregate(revenue_pipeline):
            revenue[doc["_id"]] = {
                "total_euros": doc["total_cents"] / 100,
                "purchases": doc["purchases"]
            }
        
        return {
            "month": month_key,
            "by_type": by_type,
            "top_users": top_users,
            "revenue": revenue
        }


class EmailService:
    """Service d'envoi d'emails avec Resend"""
    
    def __init__(self, db):
        self.db = db
        self.credits_service = CreditsService(db)
        self.simulation_mode = RESEND_SIMULATION
        if self.simulation_mode:
            logger.info("📧 EmailService: MODE SIMULATION (pas de clé Resend)")
    
    async def send_email(
        self,
        business_id: str,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: str = None,
        from_name: str = None,
        reply_to: str = None,
        track_usage: bool = True
    ) -> Dict:
        """
        Envoie un email via Resend
        Vérifie les crédits avant envoi
        """
        # Vérifier les crédits
        if track_usage:
            check = await self.credits_service.check_credits(business_id, CreditType.EMAIL)
            if not check.get("can_send") and not check.get("unlimited"):
                return {
                    "success": False,
                    "error": "insufficient_credits",
                    "message": "Crédits email épuisés",
                    "remaining": check.get("remaining", 0),
                    "needs_upgrade": True
                }
        
        # Récupérer l'entreprise pour le sender
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        
        # Construire le from
        if not from_email:
            # Utiliser le domaine vérifié de l'entreprise ou le défaut
            custom_domain = business.get("email_settings", {}).get("verified_domain")
            if custom_domain:
                from_email = f"notifications@{custom_domain}"
            else:
                from_email = DEFAULT_SENDER_EMAIL
        
        if not from_name:
            from_name = business.get("name", "NoShowGone")
        
        from_address = f"{from_name} <{from_email}>"
        
        # Mode simulation
        if self.simulation_mode:
            logger.info(f"📧 [SIMULATION] Email → {to_email}: {subject}")
            result = {
                "success": True,
                "simulation": True,
                "email_id": f"SIM-{uuid.uuid4().hex[:8]}",
                "from": from_address,
                "to": to_email,
                "subject": subject
            }
        else:
            # Envoi réel via Resend
            try:
                params = {
                    "from": from_address,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content
                }
                
                if reply_to:
                    params["reply_to"] = reply_to
                
                # Envoi non-bloquant
                email_result = await asyncio.to_thread(resend.Emails.send, params)
                
                result = {
                    "success": True,
                    "simulation": False,
                    "email_id": email_result.get("id"),
                    "from": from_address,
                    "to": to_email,
                    "subject": subject
                }
                
            except Exception as e:
                logger.error(f"❌ Erreur Resend: {str(e)}")
                return {
                    "success": False,
                    "error": "send_failed",
                    "message": str(e)
                }
        
        # Consommer le crédit
        if track_usage and result.get("success"):
            await self.credits_service.consume_credit(
                business_id,
                CreditType.EMAIL,
                1,
                {"to": to_email, "subject": subject, "email_id": result.get("email_id")}
            )
        
        # Logger l'email
        email_log = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "to": to_email,
            "from": from_address,
            "subject": subject,
            "status": "sent" if result.get("success") else "failed",
            "resend_id": result.get("email_id"),
            "simulation": result.get("simulation", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await self.db.email_logs.insert_one(email_log)
        
        return result
    
    async def send_post_rdv_email(
        self,
        business_id: str,
        to_email: str,
        client_name: str,
        template_key: str,
        variables: Dict = None
    ) -> Dict:
        """Envoie un email post-RDV avec template"""
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business not found"}
        
        # Variables par défaut
        vars_dict = {
            "nom_client": client_name,
            "nom_entreprise": business.get("name", ""),
            "lien_google_avis": business.get("post_rdv_settings", {}).get("google_review_link", ""),
            "lien_roue_fortune": business.get("post_rdv_settings", {}).get("wheel_of_fortune_link", ""),
            **(variables or {})
        }
        
        # Récupérer le template
        template = await self._get_email_template(template_key)
        if not template:
            return {"error": f"Template not found: {template_key}"}
        
        # Personnaliser le contenu
        subject = template.get("subject", "Message de " + business.get("name", ""))
        html_content = template.get("html", "")
        
        for var, value in vars_dict.items():
            html_content = html_content.replace(f"{{{{{var}}}}}", str(value))
            subject = subject.replace(f"{{{{{var}}}}}", str(value))
        
        return await self.send_email(
            business_id=business_id,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            from_name=business.get("name"),
            reply_to=business.get("email")
        )
    
    async def _get_email_template(self, template_key: str) -> Dict:
        """Récupère un template email HTML"""
        # Templates HTML par défaut
        templates = {
            "thankyou_standard": {
                "subject": "Merci pour votre visite, {{nom_client}} !",
                "html": """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2d5a27;">Merci {{nom_client}} !</h1>
                    <p>Nous vous remercions pour votre visite chez <strong>{{nom_entreprise}}</strong>.</p>
                    <p>Nous espérons vous revoir très bientôt !</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">{{nom_entreprise}}</p>
                </div>
                """
            },
            "review_request": {
                "subject": "Votre avis compte pour nous, {{nom_client}} !",
                "html": """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2d5a27;">{{nom_client}}, votre avis compte !</h1>
                    <p>Merci pour votre visite chez <strong>{{nom_entreprise}}</strong>.</p>
                    <p>Partagez votre expérience en 30 secondes :</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{{lien_google_avis}}" style="background-color: #2d5a27; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            ⭐ Donner mon avis
                        </a>
                    </p>
                    <p>Merci beaucoup !</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">{{nom_entreprise}}</p>
                </div>
                """
            },
            "loyalty_reward": {
                "subject": "🎁 Récompense fidélité - {{nom_entreprise}}",
                "html": """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2d5a27;">Merci pour votre fidélité, {{nom_client}} ! 🎉</h1>
                    <p>En tant que client fidèle de <strong>{{nom_entreprise}}</strong>, profitez d'une réduction exclusive :</p>
                    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px;">
                        <p style="font-size: 24px; color: #2d5a27; margin: 0;"><strong>-{{reduction}}%</strong></p>
                        <p style="color: #666; margin: 10px 0;">Code : <strong>{{code_promo}}</strong></p>
                        <p style="font-size: 12px; color: #999;">Valable jusqu'au {{date_expiration}}</p>
                    </div>
                    <p>À très bientôt !</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">{{nom_entreprise}}</p>
                </div>
                """
            },
            "wheel_of_fortune": {
                "subject": "🎰 Tentez votre chance - {{nom_entreprise}}",
                "html": """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2d5a27;">{{nom_client}}, tentez votre chance ! 🎰</h1>
                    <p>Merci pour votre visite chez <strong>{{nom_entreprise}}</strong>.</p>
                    <p>Faites tourner la roue et gagnez jusqu'à <strong>-50%</strong> sur votre prochaine visite !</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{{lien_roue_fortune}}" style="background-color: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            🎰 Jouer maintenant
                        </a>
                    </p>
                    <p>Bonne chance !</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">{{nom_entreprise}}</p>
                </div>
                """
            }
        }
        
        return templates.get(template_key)
    
    # ============= VÉRIFICATION DE DOMAINE =============
    
    async def initiate_domain_verification(self, business_id: str, domain: str) -> Dict:
        """
        Initie la vérification d'un domaine personnalisé
        Le client devra ajouter des records DNS
        """
        if self.simulation_mode:
            # Simulation
            return {
                "success": True,
                "simulation": True,
                "domain": domain,
                "dns_records": [
                    {"type": "TXT", "name": f"resend._domainkey.{domain}", "value": "SIMULATED_DKIM_KEY"},
                    {"type": "TXT", "name": domain, "value": "v=spf1 include:amazonses.com ~all"}
                ],
                "status": "pending"
            }
        
        try:
            # Créer le domaine dans Resend
            result = await asyncio.to_thread(resend.Domains.create, {"name": domain})
            
            # Sauvegarder les infos de vérification
            verification = {
                "domain": domain,
                "resend_domain_id": result.get("id"),
                "dns_records": result.get("records", []),
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.businesses.update_one(
                {"id": business_id},
                {"$set": {"email_settings.domain_verification": verification}}
            )
            
            return {
                "success": True,
                "domain": domain,
                "dns_records": result.get("records", []),
                "status": "pending"
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur vérification domaine: {str(e)}")
            return {"error": str(e)}
    
    async def check_domain_verification(self, business_id: str) -> Dict:
        """Vérifie le statut de vérification du domaine"""
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business not found"}
        
        verification = business.get("email_settings", {}).get("domain_verification")
        if not verification:
            return {"status": "not_initiated"}
        
        if self.simulation_mode:
            return {
                "status": "verified",
                "simulation": True,
                "domain": verification.get("domain")
            }
        
        try:
            domain_id = verification.get("resend_domain_id")
            result = await asyncio.to_thread(resend.Domains.get, domain_id)
            
            status = result.get("status", "pending")
            
            if status == "verified":
                # Marquer comme vérifié
                await self.db.businesses.update_one(
                    {"id": business_id},
                    {"$set": {
                        "email_settings.verified_domain": verification.get("domain"),
                        "email_settings.domain_verification.status": "verified"
                    }}
                )
            
            return {
                "status": status,
                "domain": verification.get("domain"),
                "dns_records": verification.get("dns_records", [])
            }
            
        except Exception as e:
            return {"error": str(e)}
