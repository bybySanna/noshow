"""
NoShowGone - Service Stripe (Mode Simulation)
Prêt pour intégration Stripe quand les clés seront fournies.

Ce service gère:
- Abonnements SaaS (Solo, Pro, Business)
- Dépôts anti no-show
- Webhooks Stripe
- Gestion des factures
"""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)

# Configuration Stripe (à remplir avec de vraies clés)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PUBLIC_KEY = os.environ.get('STRIPE_PUBLIC_KEY', '')

# Mode simulation si pas de clés Stripe
SIMULATION_MODE = not STRIPE_SECRET_KEY

# Prix des plans (en centimes)
PLAN_PRICES = {
    "free_trial": {"price": 0, "stripe_price_id": None},
    "solo": {"price": 2900, "stripe_price_id": "price_solo_monthly"},
    "pro": {"price": 5900, "stripe_price_id": "price_pro_monthly"},
    "business": {"price": 9900, "stripe_price_id": "price_business_monthly"},
}


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    UNPAID = "unpaid"


class StripeService:
    """Service de gestion des paiements Stripe"""
    
    def __init__(self, db):
        self.db = db
        self.simulation_mode = SIMULATION_MODE
        if self.simulation_mode:
            logger.info("💳 StripeService en MODE SIMULATION - Stripe non configuré")
        else:
            import stripe
            stripe.api_key = STRIPE_SECRET_KEY
            self.stripe = stripe
            logger.info("✅ StripeService connecté à Stripe")
    
    # ==================== ABONNEMENTS ====================
    
    async def create_subscription(
        self,
        business_id: str,
        plan: str,
        customer_email: str,
        customer_name: str
    ) -> Dict[str, Any]:
        """Crée un nouvel abonnement"""
        
        if self.simulation_mode:
            return await self._simulate_subscription(business_id, plan, customer_email)
        
        try:
            # Créer ou récupérer le customer Stripe
            customer = self.stripe.Customer.create(
                email=customer_email,
                name=customer_name,
                metadata={"business_id": business_id}
            )
            
            # Créer l'abonnement
            price_id = PLAN_PRICES.get(plan, {}).get("stripe_price_id")
            if not price_id:
                return {"error": "Plan invalide"}
            
            subscription = self.stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": price_id}],
                payment_behavior="default_incomplete",
                expand=["latest_invoice.payment_intent"]
            )
            
            return {
                "subscription_id": subscription.id,
                "client_secret": subscription.latest_invoice.payment_intent.client_secret,
                "status": subscription.status
            }
            
        except Exception as e:
            logger.error(f"Erreur création abonnement: {str(e)}")
            return {"error": str(e)}
    
    async def _simulate_subscription(
        self,
        business_id: str,
        plan: str,
        customer_email: str
    ) -> Dict[str, Any]:
        """Simule la création d'un abonnement"""
        
        subscription_id = f"sub_sim_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        subscription_data = {
            "id": subscription_id,
            "business_id": business_id,
            "plan": plan,
            "status": SubscriptionStatus.ACTIVE.value,
            "customer_email": customer_email,
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "amount": PLAN_PRICES.get(plan, {}).get("price", 0),
            "simulation_mode": True,
            "created_at": now.isoformat()
        }
        
        await self.db.subscriptions.insert_one(subscription_data)
        
        # Mettre à jour le business
        await self.db.businesses.update_one(
            {"id": business_id},
            {"$set": {
                "subscription.plan": plan,
                "subscription.status": "active",
                "subscription.stripe_subscription_id": subscription_id,
                "subscription.started_at": now.isoformat()
            }}
        )
        
        logger.info(f"💳 [SIMULATION] Abonnement créé: {plan} pour business {business_id}")
        
        return {
            "subscription_id": subscription_id,
            "status": "active",
            "simulation_mode": True,
            "plan": plan,
            "amount": PLAN_PRICES.get(plan, {}).get("price", 0) / 100
        }
    
    async def cancel_subscription(self, business_id: str) -> Dict[str, Any]:
        """Annule un abonnement"""
        
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business non trouvé"}
        
        subscription_id = business.get("subscription", {}).get("stripe_subscription_id")
        
        if self.simulation_mode or not subscription_id:
            # Simulation
            await self.db.businesses.update_one(
                {"id": business_id},
                {"$set": {
                    "subscription.status": "cancelled",
                    "subscription.cancelled_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"💳 [SIMULATION] Abonnement annulé pour business {business_id}")
            return {"success": True, "simulation_mode": True}
        
        try:
            self.stripe.Subscription.delete(subscription_id)
            await self.db.businesses.update_one(
                {"id": business_id},
                {"$set": {"subscription.status": "cancelled"}}
            )
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}
    
    async def change_plan(self, business_id: str, new_plan: str) -> Dict[str, Any]:
        """Change le plan d'un abonnement"""
        
        business = await self.db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            return {"error": "Business non trouvé"}
        
        old_plan = business.get("subscription", {}).get("plan")
        
        if self.simulation_mode:
            await self.db.businesses.update_one(
                {"id": business_id},
                {"$set": {
                    "subscription.plan": new_plan,
                    "subscription.updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Enregistrer le changement
            await self.db.plan_changes.insert_one({
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "from_plan": old_plan,
                "to_plan": new_plan,
                "simulation_mode": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"💳 [SIMULATION] Plan changé: {old_plan} → {new_plan} pour business {business_id}")
            
            return {
                "success": True,
                "old_plan": old_plan,
                "new_plan": new_plan,
                "simulation_mode": True
            }
        
        # Mode réel - à implémenter avec Stripe
        return {"error": "Mode réel non implémenté"}
    
    # ==================== DEPOTS ====================
    
    async def create_deposit_checkout(
        self,
        appointment_id: str,
        business_id: str,
        amount: float,
        client_email: str,
        client_name: str,
        success_url: str,
        cancel_url: str
    ) -> Dict[str, Any]:
        """Crée une session de paiement pour un dépôt"""
        
        if self.simulation_mode:
            return await self._simulate_deposit_checkout(
                appointment_id, business_id, amount, client_email
            )
        
        try:
            session = self.stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": int(amount * 100),
                        "product_data": {
                            "name": f"Dépôt de garantie RDV",
                        },
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=client_email,
                metadata={
                    "appointment_id": appointment_id,
                    "business_id": business_id,
                    "type": "deposit"
                }
            )
            
            return {
                "checkout_url": session.url,
                "session_id": session.id
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    async def _simulate_deposit_checkout(
        self,
        appointment_id: str,
        business_id: str,
        amount: float,
        client_email: str
    ) -> Dict[str, Any]:
        """Simule une session de paiement de dépôt"""
        
        session_id = f"cs_sim_{uuid.uuid4().hex[:12]}"
        
        deposit = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "appointment_id": appointment_id,
            "business_id": business_id,
            "amount": amount,
            "currency": "eur",
            "status": PaymentStatus.PENDING.value,
            "client_email": client_email,
            "simulation_mode": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.deposits.insert_one(deposit)
        
        # Simuler le checkout URL
        checkout_url = f"/api/payments/simulate-deposit/{session_id}"
        
        logger.info(f"💳 [SIMULATION] Checkout dépôt créé: {amount}€ pour RDV {appointment_id}")
        
        return {
            "checkout_url": checkout_url,
            "session_id": session_id,
            "simulation_mode": True,
            "amount": amount
        }
    
    async def confirm_deposit_payment(self, session_id: str) -> Dict[str, Any]:
        """Confirme le paiement d'un dépôt (simulation)"""
        
        deposit = await self.db.deposits.find_one({"session_id": session_id}, {"_id": 0})
        if not deposit:
            return {"error": "Dépôt non trouvé"}
        
        now = datetime.now(timezone.utc)
        
        # Mettre à jour le dépôt
        await self.db.deposits.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": PaymentStatus.SUCCEEDED.value,
                "paid_at": now.isoformat()
            }}
        )
        
        # Mettre à jour le RDV
        await self.db.appointments.update_one(
            {"id": deposit["appointment_id"]},
            {"$set": {"deposit_paid": True}}
        )
        
        logger.info(f"💳 [SIMULATION] Dépôt confirmé: {deposit['amount']}€ pour RDV {deposit['appointment_id']}")
        
        return {
            "success": True,
            "amount": deposit["amount"],
            "appointment_id": deposit["appointment_id"]
        }
    
    async def refund_deposit(self, appointment_id: str) -> Dict[str, Any]:
        """Rembourse un dépôt"""
        
        deposit = await self.db.deposits.find_one(
            {"appointment_id": appointment_id, "status": "succeeded"},
            {"_id": 0}
        )
        
        if not deposit:
            return {"error": "Aucun dépôt payé trouvé"}
        
        if self.simulation_mode or deposit.get("simulation_mode"):
            await self.db.deposits.update_one(
                {"id": deposit["id"]},
                {"$set": {
                    "status": PaymentStatus.REFUNDED.value,
                    "refunded_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            await self.db.appointments.update_one(
                {"id": appointment_id},
                {"$set": {"deposit_paid": False, "deposit_refunded": True}}
            )
            
            logger.info(f"💳 [SIMULATION] Dépôt remboursé: {deposit['amount']}€")
            
            return {"success": True, "amount": deposit["amount"], "simulation_mode": True}
        
        # Mode réel
        try:
            self.stripe.Refund.create(payment_intent=deposit.get("payment_intent_id"))
            return {"success": True, "amount": deposit["amount"]}
        except Exception as e:
            return {"error": str(e)}
    
    # ==================== WEBHOOKS ====================
    
    async def handle_webhook(self, payload: bytes, signature: str) -> Dict[str, Any]:
        """Gère les webhooks Stripe"""
        
        if self.simulation_mode:
            return {"simulation_mode": True, "message": "Webhook ignoré en simulation"}
        
        try:
            event = self.stripe.Webhook.construct_event(
                payload, signature, STRIPE_WEBHOOK_SECRET
            )
            
            event_type = event["type"]
            data = event["data"]["object"]
            
            if event_type == "checkout.session.completed":
                await self._handle_checkout_completed(data)
            elif event_type == "invoice.paid":
                await self._handle_invoice_paid(data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_cancelled(data)
            
            return {"success": True, "event_type": event_type}
            
        except Exception as e:
            logger.error(f"Erreur webhook: {str(e)}")
            return {"error": str(e)}
    
    async def _handle_checkout_completed(self, session: Dict):
        """Gère la fin d'un checkout"""
        metadata = session.get("metadata", {})
        
        if metadata.get("type") == "deposit":
            await self.db.deposits.update_one(
                {"session_id": session["id"]},
                {"$set": {"status": PaymentStatus.SUCCEEDED.value}}
            )
            await self.db.appointments.update_one(
                {"id": metadata.get("appointment_id")},
                {"$set": {"deposit_paid": True}}
            )
    
    async def _handle_invoice_paid(self, invoice: Dict):
        """Gère le paiement d'une facture"""
        subscription_id = invoice.get("subscription")
        if subscription_id:
            await self.db.subscriptions.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"last_payment_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    async def _handle_subscription_cancelled(self, subscription: Dict):
        """Gère l'annulation d'un abonnement"""
        await self.db.businesses.update_one(
            {"subscription.stripe_subscription_id": subscription["id"]},
            {"$set": {"subscription.status": "cancelled"}}
        )
    
    # ==================== STATS ====================
    
    async def get_payment_stats(self, business_id: Optional[str] = None) -> Dict[str, Any]:
        """Retourne les statistiques de paiement"""
        
        query = {"business_id": business_id} if business_id else {}
        
        total_deposits = await self.db.deposits.count_documents(query)
        paid_deposits = await self.db.deposits.count_documents({**query, "status": "succeeded"})
        
        # Calculer le montant total
        pipeline = [
            {"$match": {**query, "status": "succeeded"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await self.db.deposits.aggregate(pipeline).to_list(1)
        total_amount = result[0]["total"] if result else 0
        
        return {
            "total_deposits": total_deposits,
            "paid_deposits": paid_deposits,
            "total_amount": total_amount,
            "conversion_rate": round(paid_deposits / total_deposits * 100, 1) if total_deposits > 0 else 0,
            "simulation_mode": self.simulation_mode
        }
    
    def get_public_key(self) -> Optional[str]:
        """Retourne la clé publique Stripe"""
        if self.simulation_mode:
            return "pk_test_simulation"
        return STRIPE_PUBLIC_KEY
