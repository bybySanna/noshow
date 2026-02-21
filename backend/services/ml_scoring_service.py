"""
NoShowGone - Service de Scoring ML pour prédiction des no-shows
Utilise l'historique client pour calculer un score de risque.

Facteurs pris en compte:
- Historique de no-shows du client
- Taux de confirmation
- Délai de confirmation
- Jour de la semaine / heure
- Récurrence des RDV
- Ancienneté du client
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class RiskLevel(str, Enum):
    VERY_LOW = "very_low"      # 0-20%
    LOW = "low"                 # 20-40%
    MEDIUM = "medium"           # 40-60%
    HIGH = "high"               # 60-80%
    VERY_HIGH = "very_high"     # 80-100%


# Poids des facteurs pour le calcul du score
SCORING_WEIGHTS = {
    "no_show_history": 0.35,        # Historique de no-shows
    "confirmation_rate": 0.25,       # Taux de confirmation
    "recency": 0.15,                 # Ancienneté du dernier RDV honoré
    "booking_pattern": 0.10,         # Pattern de réservation (jour/heure)
    "client_age": 0.10,              # Ancienneté du client
    "deposit_paid": 0.05,            # Dépôt payé ou non
}


class MLScoringService:
    """Service de scoring ML pour prédiction des no-shows"""
    
    def __init__(self, db):
        self.db = db
        logger.info("🧠 MLScoringService initialisé")
    
    async def calculate_client_risk_score(
        self,
        client_phone: str,
        business_id: str,
        appointment_date: Optional[str] = None,
        appointment_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calcule le score de risque d'un client basé sur son historique.
        Retourne un score entre 0 (très fiable) et 100 (très risqué).
        """
        
        # Récupérer l'historique du client
        history = await self.db.appointments.find({
            "business_id": business_id,
            "client_phone": client_phone
        }, {"_id": 0}).to_list(1000)
        
        if not history:
            # Nouveau client - score neutre avec légère incertitude
            return self._build_score_response(
                score=35,
                risk_level=RiskLevel.LOW,
                factors={
                    "new_client": True,
                    "no_history": True
                },
                recommendations=[
                    "Nouveau client - historique inconnu",
                    "Envoyer rappel supplémentaire recommandé"
                ]
            )
        
        # Calculer les métriques
        total_appts = len(history)
        no_shows = sum(1 for a in history if a.get("status") == "no_show")
        confirmed = sum(1 for a in history if a.get("status") in ["confirmed", "completed"])
        cancelled = sum(1 for a in history if a.get("status") == "cancelled")
        
        # 1. Score basé sur l'historique de no-shows (35%)
        no_show_rate = no_shows / total_appts if total_appts > 0 else 0
        no_show_score = min(no_show_rate * 100 * 1.5, 100)  # Amplifié pour pénaliser les no-shows
        
        # 2. Score basé sur le taux de confirmation (25%)
        confirmation_rate = confirmed / total_appts if total_appts > 0 else 0
        confirmation_score = (1 - confirmation_rate) * 100
        
        # 3. Score basé sur la récence (15%)
        recency_score = await self._calculate_recency_score(history)
        
        # 4. Score basé sur le pattern de réservation (10%)
        booking_score = self._calculate_booking_pattern_score(history, appointment_date, appointment_time)
        
        # 5. Score basé sur l'ancienneté du client (10%)
        age_score = self._calculate_client_age_score(history)
        
        # 6. Bonus si dépôt payé (5%)
        deposit_bonus = 0
        last_appt = history[-1] if history else None
        if last_appt and last_appt.get("deposit_paid"):
            deposit_bonus = -20  # Réduction du risque
        
        # Calcul du score final pondéré
        final_score = (
            no_show_score * SCORING_WEIGHTS["no_show_history"] +
            confirmation_score * SCORING_WEIGHTS["confirmation_rate"] +
            recency_score * SCORING_WEIGHTS["recency"] +
            booking_score * SCORING_WEIGHTS["booking_pattern"] +
            age_score * SCORING_WEIGHTS["client_age"] +
            deposit_bonus * SCORING_WEIGHTS["deposit_paid"]
        )
        
        # Normaliser entre 0 et 100
        final_score = max(0, min(100, final_score))
        
        # Déterminer le niveau de risque
        risk_level = self._get_risk_level(final_score)
        
        # Générer les recommandations
        recommendations = self._generate_recommendations(
            final_score, no_show_rate, confirmation_rate, total_appts, risk_level
        )
        
        return self._build_score_response(
            score=round(final_score, 1),
            risk_level=risk_level,
            factors={
                "total_appointments": total_appts,
                "no_shows": no_shows,
                "no_show_rate": round(no_show_rate * 100, 1),
                "confirmed": confirmed,
                "confirmation_rate": round(confirmation_rate * 100, 1),
                "cancelled": cancelled,
                "component_scores": {
                    "no_show_history": round(no_show_score, 1),
                    "confirmation": round(confirmation_score, 1),
                    "recency": round(recency_score, 1),
                    "booking_pattern": round(booking_score, 1),
                    "client_age": round(age_score, 1)
                }
            },
            recommendations=recommendations
        )
    
    async def _calculate_recency_score(self, history: List[Dict]) -> float:
        """Calcule le score basé sur la récence des RDV honorés"""
        
        # Trouver le dernier RDV honoré
        honored_appts = [a for a in history if a.get("status") in ["confirmed", "completed"]]
        
        if not honored_appts:
            return 80  # Aucun RDV honoré = risque élevé
        
        # Trier par date décroissante
        honored_appts.sort(key=lambda x: x.get("date", ""), reverse=True)
        last_honored = honored_appts[0]
        
        try:
            last_date = datetime.fromisoformat(last_honored["date"])
            days_since = (datetime.now(timezone.utc).date() - last_date.date()).days
            
            if days_since <= 7:
                return 10  # Très récent = faible risque
            elif days_since <= 30:
                return 25
            elif days_since <= 90:
                return 45
            elif days_since <= 180:
                return 65
            else:
                return 80  # Plus de 6 mois = risque élevé
        except:
            return 50  # Erreur de parsing
    
    def _calculate_booking_pattern_score(
        self,
        history: List[Dict],
        appointment_date: Optional[str],
        appointment_time: Optional[str]
    ) -> float:
        """Calcule le score basé sur le pattern de réservation"""
        
        if not appointment_date or not appointment_time:
            return 50  # Neutre si pas de date/heure
        
        try:
            # Analyser le jour de la semaine
            appt_date = datetime.fromisoformat(appointment_date)
            day_of_week = appt_date.weekday()  # 0=lundi, 6=dimanche
            
            # Analyser l'heure
            hour = int(appointment_time.split(":")[0])
            
            # Statistiques par jour/heure pour ce client
            no_shows_by_day = {}
            no_shows_by_hour = {}
            
            for appt in history:
                try:
                    d = datetime.fromisoformat(appt.get("date", ""))
                    dow = d.weekday()
                    h = int(appt.get("time", "12:00").split(":")[0])
                    
                    if dow not in no_shows_by_day:
                        no_shows_by_day[dow] = {"total": 0, "no_show": 0}
                    no_shows_by_day[dow]["total"] += 1
                    if appt.get("status") == "no_show":
                        no_shows_by_day[dow]["no_show"] += 1
                    
                    if h not in no_shows_by_hour:
                        no_shows_by_hour[h] = {"total": 0, "no_show": 0}
                    no_shows_by_hour[h]["total"] += 1
                    if appt.get("status") == "no_show":
                        no_shows_by_hour[h]["no_show"] += 1
                except:
                    continue
            
            # Calculer le risque pour ce jour/heure
            day_risk = 0
            if day_of_week in no_shows_by_day:
                data = no_shows_by_day[day_of_week]
                if data["total"] > 0:
                    day_risk = (data["no_show"] / data["total"]) * 100
            
            hour_risk = 0
            if hour in no_shows_by_hour:
                data = no_shows_by_hour[hour]
                if data["total"] > 0:
                    hour_risk = (data["no_show"] / data["total"]) * 100
            
            return (day_risk + hour_risk) / 2
            
        except:
            return 50
    
    def _calculate_client_age_score(self, history: List[Dict]) -> float:
        """Calcule le score basé sur l'ancienneté du client"""
        
        if not history:
            return 60  # Nouveau client
        
        try:
            # Trouver le premier RDV
            dates = [a.get("date") for a in history if a.get("date")]
            if not dates:
                return 50
            
            first_date = min(dates)
            first = datetime.fromisoformat(first_date)
            months_as_client = (datetime.now(timezone.utc).date() - first.date()).days / 30
            
            if months_as_client >= 12:
                return 15  # Client fidèle > 1 an
            elif months_as_client >= 6:
                return 30
            elif months_as_client >= 3:
                return 45
            elif months_as_client >= 1:
                return 55
            else:
                return 65  # Nouveau client
        except:
            return 50
    
    def _get_risk_level(self, score: float) -> RiskLevel:
        """Convertit le score en niveau de risque"""
        if score < 20:
            return RiskLevel.VERY_LOW
        elif score < 40:
            return RiskLevel.LOW
        elif score < 60:
            return RiskLevel.MEDIUM
        elif score < 80:
            return RiskLevel.HIGH
        else:
            return RiskLevel.VERY_HIGH
    
    def _generate_recommendations(
        self,
        score: float,
        no_show_rate: float,
        confirmation_rate: float,
        total_appts: int,
        risk_level: RiskLevel
    ) -> List[str]:
        """Génère des recommandations basées sur le score"""
        
        recommendations = []
        
        if risk_level in [RiskLevel.VERY_HIGH, RiskLevel.HIGH]:
            recommendations.append("⚠️ Risque élevé - Dépôt de garantie fortement recommandé")
            recommendations.append("📱 Activer rappel supplémentaire 1h avant")
            
        if no_show_rate > 0.3:
            recommendations.append("🚫 Client avec historique de no-shows élevé")
            recommendations.append("💰 Exiger un dépôt de garantie")
            
        if confirmation_rate < 0.5:
            recommendations.append("⏰ Faible taux de confirmation - Rappel WhatsApp recommandé")
            
        if total_appts < 3:
            recommendations.append("👤 Client récent - Surveiller les prochains RDV")
            
        if risk_level == RiskLevel.VERY_LOW:
            recommendations.append("✅ Client très fiable - Priorité basse pour les rappels")
            
        if not recommendations:
            recommendations.append("📊 Client avec profil standard - Procédure normale")
            
        return recommendations
    
    def _build_score_response(
        self,
        score: float,
        risk_level: RiskLevel,
        factors: Dict,
        recommendations: List[str]
    ) -> Dict[str, Any]:
        """Construit la réponse du scoring"""
        
        return {
            "score": score,
            "risk_level": risk_level.value,
            "risk_label": self._get_risk_label(risk_level),
            "risk_color": self._get_risk_color(risk_level),
            "factors": factors,
            "recommendations": recommendations,
            "suggested_actions": self._get_suggested_actions(risk_level),
            "calculated_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _get_risk_label(self, risk_level: RiskLevel) -> str:
        """Retourne le label du risque en français"""
        labels = {
            RiskLevel.VERY_LOW: "Très fiable",
            RiskLevel.LOW: "Fiable",
            RiskLevel.MEDIUM: "Modéré",
            RiskLevel.HIGH: "Risqué",
            RiskLevel.VERY_HIGH: "Très risqué"
        }
        return labels.get(risk_level, "Inconnu")
    
    def _get_risk_color(self, risk_level: RiskLevel) -> str:
        """Retourne la couleur du risque"""
        colors = {
            RiskLevel.VERY_LOW: "#15803d",   # Vert foncé
            RiskLevel.LOW: "#22c55e",         # Vert
            RiskLevel.MEDIUM: "#f59e0b",      # Orange
            RiskLevel.HIGH: "#ea580c",        # Orange foncé
            RiskLevel.VERY_HIGH: "#ef4444"    # Rouge
        }
        return colors.get(risk_level, "#6b7280")
    
    def _get_suggested_actions(self, risk_level: RiskLevel) -> List[Dict]:
        """Retourne les actions suggérées basées sur le risque"""
        
        actions = []
        
        if risk_level in [RiskLevel.VERY_HIGH, RiskLevel.HIGH]:
            actions.append({
                "action": "require_deposit",
                "label": "Exiger un dépôt",
                "priority": "high"
            })
            actions.append({
                "action": "extra_reminder",
                "label": "Ajouter rappel 1h avant",
                "priority": "high"
            })
            
        if risk_level == RiskLevel.MEDIUM:
            actions.append({
                "action": "suggest_deposit",
                "label": "Suggérer un dépôt",
                "priority": "medium"
            })
            
        actions.append({
            "action": "standard_reminders",
            "label": "Rappels standards",
            "priority": "normal"
        })
        
        return actions
    
    async def get_business_risk_overview(self, business_id: str) -> Dict[str, Any]:
        """Retourne une vue d'ensemble des risques pour une entreprise"""
        
        # Récupérer tous les RDV à venir
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        upcoming = await self.db.appointments.find({
            "business_id": business_id,
            "date": {"$gte": today},
            "status": {"$in": ["pending", "confirmed"]}
        }, {"_id": 0}).to_list(500)
        
        # Calculer le score pour chaque client
        risk_distribution = {
            "very_low": 0,
            "low": 0,
            "medium": 0,
            "high": 0,
            "very_high": 0
        }
        
        high_risk_appointments = []
        
        for appt in upcoming:
            score_data = await self.calculate_client_risk_score(
                appt.get("client_phone", ""),
                business_id,
                appt.get("date"),
                appt.get("time")
            )
            
            risk_level = score_data.get("risk_level", "medium")
            risk_distribution[risk_level] += 1
            
            if risk_level in ["high", "very_high"]:
                high_risk_appointments.append({
                    "appointment_id": appt.get("id"),
                    "client_name": appt.get("client_name"),
                    "client_phone": appt.get("client_phone"),
                    "date": appt.get("date"),
                    "time": appt.get("time"),
                    "risk_score": score_data.get("score"),
                    "risk_level": risk_level,
                    "recommendations": score_data.get("recommendations", [])[:2]
                })
        
        # Calculer le score de risque global
        total = len(upcoming)
        if total > 0:
            avg_risk = (
                risk_distribution["very_low"] * 10 +
                risk_distribution["low"] * 30 +
                risk_distribution["medium"] * 50 +
                risk_distribution["high"] * 70 +
                risk_distribution["very_high"] * 90
            ) / total
        else:
            avg_risk = 0
        
        return {
            "total_upcoming": total,
            "average_risk_score": round(avg_risk, 1),
            "risk_distribution": risk_distribution,
            "high_risk_count": risk_distribution["high"] + risk_distribution["very_high"],
            "high_risk_appointments": high_risk_appointments[:10],  # Top 10
            "calculated_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def update_score_after_appointment(
        self,
        appointment_id: str,
        business_id: str,
        final_status: str
    ) -> None:
        """Met à jour les métriques après la fin d'un RDV (pour apprentissage)"""
        
        # Enregistrer le résultat pour améliorer le modèle
        appt = await self.db.appointments.find_one(
            {"id": appointment_id, "business_id": business_id},
            {"_id": 0}
        )
        
        if not appt:
            return
        
        # Log pour analyse future
        scoring_log = {
            "appointment_id": appointment_id,
            "business_id": business_id,
            "client_phone": appt.get("client_phone"),
            "predicted_status": "unknown",  # À implémenter avec prédiction
            "actual_status": final_status,
            "was_correct": None,  # À calculer
            "logged_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.scoring_logs.insert_one(scoring_log)
        logger.info(f"📊 Score log enregistré pour RDV {appointment_id}")
