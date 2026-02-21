"""
NoShowGone - Service d'intégration Google Calendar
Permet d'importer automatiquement les RDV depuis Google Calendar.

Fonctionnalités:
- OAuth2 authentication avec Google
- Import des événements calendar
- Mapping vers le format RDV NoShowGone
- Sync périodique
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import uuid

logger = logging.getLogger(__name__)

# Configuration Google OAuth (à remplir avec de vraies clés)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', '')

# Mode simulation si pas de clés
SIMULATION_MODE = not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET])


class RDVSource:
    """Sources possibles pour un RDV"""
    MANUAL = "manual"
    GOOGLE_CALENDAR = "google_calendar"
    OUTLOOK = "outlook"
    ICAL = "ical"
    API_THEFORK = "api_thefork"
    API_OPENTABLE = "api_opentable"
    API_EXTERNAL = "api_external"


class CalendarIntegrationService:
    """Service d'intégration calendrier (Google, Outlook, iCal)"""
    
    def __init__(self, db):
        self.db = db
        self.simulation_mode = SIMULATION_MODE
        if self.simulation_mode:
            logger.info("📅 CalendarIntegrationService en MODE SIMULATION")
        else:
            logger.info("✅ CalendarIntegrationService connecté à Google")
    
    # ==================== GOOGLE CALENDAR ====================
    
    def get_google_auth_url(self, business_id: str) -> str:
        """Génère l'URL d'authentification Google OAuth"""
        
        if self.simulation_mode:
            # URL de simulation
            return f"/api/calendar/google/callback-simulate?business_id={business_id}"
        
        # URL réelle Google OAuth
        scopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events.readonly"
        ]
        
        auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={GOOGLE_CLIENT_ID}&"
            f"redirect_uri={GOOGLE_REDIRECT_URI}&"
            "response_type=code&"
            f"scope={' '.join(scopes)}&"
            "access_type=offline&"
            f"state={business_id}"
        )
        
        return auth_url
    
    async def handle_google_callback(
        self,
        code: str,
        business_id: str
    ) -> Dict[str, Any]:
        """Gère le callback OAuth de Google"""
        
        if self.simulation_mode:
            # Simulation: sauvegarder une connexion fictive
            connection = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "provider": "google_calendar",
                "status": "connected",
                "access_token": f"sim_token_{uuid.uuid4().hex[:16]}",
                "refresh_token": f"sim_refresh_{uuid.uuid4().hex[:16]}",
                "token_expiry": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "calendar_id": "primary",
                "last_sync": None,
                "simulation_mode": True,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.calendar_connections.update_one(
                {"business_id": business_id, "provider": "google_calendar"},
                {"$set": connection},
                upsert=True
            )
            
            logger.info(f"📅 [SIMULATION] Connexion Google Calendar pour business {business_id}")
            
            return {
                "success": True,
                "provider": "google_calendar",
                "simulation_mode": True,
                "message": "Connexion Google Calendar établie (simulation)"
            }
        
        # Mode réel - échanger le code contre un token
        try:
            import requests
            
            token_response = requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            tokens = token_response.json()
            
            if "error" in tokens:
                return {"error": tokens.get("error_description", "OAuth error")}
            
            # Sauvegarder la connexion
            connection = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "provider": "google_calendar",
                "status": "connected",
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "token_expiry": (datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat(),
                "calendar_id": "primary",
                "last_sync": None,
                "simulation_mode": False,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.calendar_connections.update_one(
                {"business_id": business_id, "provider": "google_calendar"},
                {"$set": connection},
                upsert=True
            )
            
            return {
                "success": True,
                "provider": "google_calendar",
                "message": "Connexion Google Calendar établie"
            }
            
        except Exception as e:
            logger.error(f"Erreur OAuth Google: {str(e)}")
            return {"error": str(e)}
    
    async def sync_google_calendar(self, business_id: str) -> Dict[str, Any]:
        """Synchronise les événements Google Calendar"""
        
        connection = await self.db.calendar_connections.find_one(
            {"business_id": business_id, "provider": "google_calendar"},
            {"_id": 0}
        )
        
        if not connection:
            return {"error": "Pas de connexion Google Calendar"}
        
        if self.simulation_mode or connection.get("simulation_mode"):
            # Simulation: créer quelques RDV fictifs
            return await self._simulate_calendar_sync(business_id)
        
        # Mode réel - récupérer les événements
        try:
            import requests
            
            # Rafraîchir le token si nécessaire
            access_token = await self._refresh_token_if_needed(connection)
            
            # Récupérer les événements des 30 prochains jours
            time_min = datetime.now(timezone.utc).isoformat()
            time_max = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            
            response = requests.get(
                f"https://www.googleapis.com/calendar/v3/calendars/{connection['calendar_id']}/events",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "timeMin": time_min,
                    "timeMax": time_max,
                    "singleEvents": True,
                    "orderBy": "startTime"
                }
            )
            
            events = response.json().get("items", [])
            
            # Convertir et importer les événements
            imported = 0
            for event in events:
                result = await self._import_calendar_event(event, business_id, "google_calendar")
                if result:
                    imported += 1
            
            # Mettre à jour la dernière sync
            await self.db.calendar_connections.update_one(
                {"business_id": business_id, "provider": "google_calendar"},
                {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                "success": True,
                "events_found": len(events),
                "events_imported": imported,
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erreur sync Google Calendar: {str(e)}")
            return {"error": str(e)}
    
    async def _simulate_calendar_sync(self, business_id: str) -> Dict[str, Any]:
        """Simule une synchronisation calendar"""
        
        # Créer quelques RDV de test
        simulated_events = [
            {
                "client_name": "Client Google Cal 1",
                "client_phone": "+33600000001",
                "date": (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d"),
                "time": "10:00",
                "service": "Import Google Calendar",
                "note": "Importé automatiquement depuis Google Calendar"
            },
            {
                "client_name": "Client Google Cal 2",
                "client_phone": "+33600000002",
                "date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
                "time": "14:30",
                "service": "Import Google Calendar",
                "note": "Importé automatiquement depuis Google Calendar"
            }
        ]
        
        imported = 0
        for event_data in simulated_events:
            # Vérifier si le RDV existe déjà
            existing = await self.db.appointments.find_one({
                "business_id": business_id,
                "client_phone": event_data["client_phone"],
                "date": event_data["date"],
                "time": event_data["time"]
            })
            
            if not existing:
                appt = {
                    "id": str(uuid.uuid4()),
                    "business_id": business_id,
                    "client_name": event_data["client_name"],
                    "client_phone": event_data["client_phone"],
                    "client_email": None,
                    "date": event_data["date"],
                    "time": event_data["time"],
                    "duration_minutes": 60,
                    "note": event_data.get("note"),
                    "service": event_data.get("service"),
                    "staff_id": None,
                    "status": "pending",  # Non confirmé par défaut
                    "source": RDVSource.GOOGLE_CALENDAR,
                    "external_id": f"sim_{uuid.uuid4().hex[:8]}",
                    "confirmation_token": str(uuid.uuid4()).replace("-", "")[:32],
                    "deposit_paid": False,
                    "deposit_amount": None,
                    "notifications_sent": [],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await self.db.appointments.insert_one(appt)
                imported += 1
        
        await self.db.calendar_connections.update_one(
            {"business_id": business_id, "provider": "google_calendar"},
            {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"📅 [SIMULATION] Sync Google Calendar: {imported} RDV importés pour business {business_id}")
        
        return {
            "success": True,
            "events_found": len(simulated_events),
            "events_imported": imported,
            "simulation_mode": True,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def _import_calendar_event(
        self,
        event: Dict,
        business_id: str,
        source: str
    ) -> Optional[Dict]:
        """Importe un événement calendar comme RDV"""
        
        try:
            # Extraire les infos de l'événement
            start = event.get("start", {})
            start_datetime = start.get("dateTime") or start.get("date")
            
            if not start_datetime:
                return None
            
            # Parser la date/heure
            if "T" in start_datetime:
                dt = datetime.fromisoformat(start_datetime.replace("Z", "+00:00"))
                date_str = dt.strftime("%Y-%m-%d")
                time_str = dt.strftime("%H:%M")
            else:
                date_str = start_datetime
                time_str = "12:00"
            
            # Extraire le nom du client depuis le titre
            title = event.get("summary", "Client Calendrier")
            
            # Vérifier si le RDV existe déjà (par external_id)
            external_id = event.get("id")
            existing = await self.db.appointments.find_one({
                "business_id": business_id,
                "external_id": external_id
            })
            
            if existing:
                return None  # Déjà importé
            
            # Créer le RDV
            appt = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "client_name": title,
                "client_phone": "",  # À compléter manuellement
                "client_email": None,
                "date": date_str,
                "time": time_str,
                "duration_minutes": 60,
                "note": event.get("description", ""),
                "service": None,
                "staff_id": None,
                "status": "pending",
                "source": source,
                "external_id": external_id,
                "confirmation_token": str(uuid.uuid4()).replace("-", "")[:32],
                "deposit_paid": False,
                "deposit_amount": None,
                "notifications_sent": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.appointments.insert_one(appt)
            return appt
            
        except Exception as e:
            logger.error(f"Erreur import événement: {str(e)}")
            return None
    
    async def _refresh_token_if_needed(self, connection: Dict) -> str:
        """Rafraîchit le token OAuth si nécessaire"""
        
        expiry = connection.get("token_expiry")
        if expiry:
            expiry_dt = datetime.fromisoformat(expiry)
            if expiry_dt > datetime.now(timezone.utc) + timedelta(minutes=5):
                return connection.get("access_token")
        
        # Rafraîchir le token
        if not connection.get("refresh_token"):
            raise Exception("Pas de refresh token")
        
        import requests
        
        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": connection["refresh_token"],
                "grant_type": "refresh_token"
            }
        )
        
        tokens = response.json()
        
        if "error" in tokens:
            raise Exception(tokens.get("error_description", "Token refresh error"))
        
        # Mettre à jour le token
        await self.db.calendar_connections.update_one(
            {"id": connection["id"]},
            {"$set": {
                "access_token": tokens["access_token"],
                "token_expiry": (datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()
            }}
        )
        
        return tokens["access_token"]
    
    async def disconnect_calendar(
        self,
        business_id: str,
        provider: str
    ) -> Dict[str, Any]:
        """Déconnecte un calendrier"""
        
        await self.db.calendar_connections.delete_one({
            "business_id": business_id,
            "provider": provider
        })
        
        return {"success": True, "message": f"{provider} déconnecté"}
    
    async def get_calendar_connections(self, business_id: str) -> List[Dict]:
        """Retourne les connexions calendrier d'une entreprise"""
        
        connections = await self.db.calendar_connections.find(
            {"business_id": business_id},
            {"_id": 0, "access_token": 0, "refresh_token": 0}
        ).to_list(10)
        
        return connections
    
    # ==================== API EXTERNES (TheFork, OpenTable) ====================
    
    async def register_external_api(
        self,
        business_id: str,
        platform: str,
        api_key: Optional[str] = None,
        webhook_secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """Enregistre une connexion API externe (préparation)"""
        
        connection = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "provider": f"api_{platform.lower()}",
            "platform": platform,
            "status": "pending_configuration",
            "api_key": api_key,  # Sera chiffré en production
            "webhook_secret": webhook_secret,
            "webhook_url": f"/api/webhooks/{platform.lower()}/{business_id}",
            "last_sync": None,
            "simulation_mode": True,  # Toujours en simulation pour l'instant
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.external_api_connections.update_one(
            {"business_id": business_id, "platform": platform},
            {"$set": connection},
            upsert=True
        )
        
        logger.info(f"🔌 API externe {platform} enregistrée pour business {business_id}")
        
        return {
            "success": True,
            "platform": platform,
            "webhook_url": connection["webhook_url"],
            "status": "pending_configuration",
            "message": f"Configuration {platform} enregistrée. En attente des clés API."
        }
    
    async def handle_external_webhook(
        self,
        platform: str,
        business_id: str,
        payload: Dict
    ) -> Dict[str, Any]:
        """Gère un webhook d'une plateforme externe"""
        
        # Vérifier la connexion
        connection = await self.db.external_api_connections.find_one({
            "business_id": business_id,
            "platform": platform
        }, {"_id": 0})
        
        if not connection:
            return {"error": "Connexion non trouvée"}
        
        # Mapper le payload vers un RDV
        try:
            appt_data = self._map_external_payload(platform, payload)
            
            if not appt_data:
                return {"error": "Payload invalide"}
            
            # Créer le RDV
            appt = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "client_name": appt_data.get("client_name", "Client externe"),
                "client_phone": appt_data.get("client_phone", ""),
                "client_email": appt_data.get("client_email"),
                "date": appt_data.get("date"),
                "time": appt_data.get("time"),
                "duration_minutes": appt_data.get("duration_minutes", 60),
                "note": appt_data.get("note", f"Importé depuis {platform}"),
                "service": appt_data.get("service"),
                "party_size": appt_data.get("party_size"),  # Nombre de personnes
                "staff_id": None,
                "status": "pending",
                "source": f"api_{platform.lower()}",
                "external_id": appt_data.get("external_id"),
                "confirmation_token": str(uuid.uuid4()).replace("-", "")[:32],
                "deposit_paid": False,
                "deposit_amount": None,
                "notifications_sent": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.appointments.insert_one(appt)
            
            logger.info(f"🔌 RDV importé depuis {platform} pour business {business_id}")
            
            return {
                "success": True,
                "appointment_id": appt["id"],
                "source": f"api_{platform.lower()}"
            }
            
        except Exception as e:
            logger.error(f"Erreur webhook {platform}: {str(e)}")
            return {"error": str(e)}
    
    def _map_external_payload(self, platform: str, payload: Dict) -> Optional[Dict]:
        """Mappe le payload d'une plateforme externe vers le format RDV"""
        
        # Structure générique pour toutes les plateformes
        # À adapter selon la documentation de chaque API
        
        if platform.lower() == "thefork":
            return {
                "client_name": payload.get("customer", {}).get("name"),
                "client_phone": payload.get("customer", {}).get("phone"),
                "client_email": payload.get("customer", {}).get("email"),
                "date": payload.get("reservation", {}).get("date"),
                "time": payload.get("reservation", {}).get("time"),
                "party_size": payload.get("reservation", {}).get("covers"),
                "external_id": payload.get("reservation", {}).get("id"),
                "note": f"TheFork - {payload.get('reservation', {}).get('covers', 0)} personnes"
            }
        
        elif platform.lower() == "opentable":
            return {
                "client_name": payload.get("guest", {}).get("first_name", "") + " " + payload.get("guest", {}).get("last_name", ""),
                "client_phone": payload.get("guest", {}).get("phone"),
                "client_email": payload.get("guest", {}).get("email"),
                "date": payload.get("date"),
                "time": payload.get("time"),
                "party_size": payload.get("party_size"),
                "external_id": payload.get("confirmation_number"),
                "note": f"OpenTable - {payload.get('party_size', 0)} personnes"
            }
        
        # Format générique
        return {
            "client_name": payload.get("client_name") or payload.get("customer_name") or "Client externe",
            "client_phone": payload.get("client_phone") or payload.get("phone") or "",
            "client_email": payload.get("client_email") or payload.get("email"),
            "date": payload.get("date") or payload.get("reservation_date"),
            "time": payload.get("time") or payload.get("reservation_time"),
            "party_size": payload.get("party_size") or payload.get("covers") or payload.get("guests"),
            "external_id": payload.get("id") or payload.get("reservation_id"),
            "note": payload.get("note") or payload.get("special_requests") or ""
        }
    
    async def get_external_api_connections(self, business_id: str) -> List[Dict]:
        """Retourne les connexions API externes d'une entreprise"""
        
        connections = await self.db.external_api_connections.find(
            {"business_id": business_id},
            {"_id": 0, "api_key": 0, "webhook_secret": 0}
        ).to_list(20)
        
        return connections
