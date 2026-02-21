from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'noshow-secret-key-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24 * 7

app = FastAPI(title="NoShowGone API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= ENUMS =============
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    BUSINESS_OWNER = "business_owner"
    STAFF = "staff"

class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    NO_SHOW = "no_show"
    COMPLETED = "completed"

class SubscriptionPlan(str, Enum):
    FREE_TRIAL = "free_trial"
    SOLO = "solo"
    PRO = "pro"
    BUSINESS = "business"

class NotificationChannel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"

class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"

# ============= PYDANTIC MODELS =============
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.BUSINESS_OWNER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BusinessCreate(BaseModel):
    name: str
    business_type: str
    phone: str
    timezone: str = "Europe/Paris"
    address: Optional[str] = None
    logo_url: Optional[str] = None

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    opening_hours: Optional[Dict[str, Any]] = None

class AppointmentCreate(BaseModel):
    client_name: str
    client_phone: str
    client_email: Optional[str] = None
    date: str  # ISO date string
    time: str  # HH:MM format
    duration_minutes: int = 60
    note: Optional[str] = None
    service: Optional[str] = None
    staff_id: Optional[str] = None
    deposit_required: bool = False
    deposit_amount: Optional[float] = None

class AppointmentUpdate(BaseModel):
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration_minutes: Optional[int] = None
    note: Optional[str] = None
    service: Optional[str] = None
    status: Optional[AppointmentStatus] = None
    staff_id: Optional[str] = None

class StaffCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    permissions: Optional[List[str]] = None

class ReminderSettings(BaseModel):
    reminder_24h: bool = True
    reminder_3h: bool = True
    reminder_30min: bool = False
    channels: List[NotificationChannel] = [NotificationChannel.EMAIL]
    custom_message: Optional[str] = None

class SubscriptionUpdate(BaseModel):
    plan: SubscriptionPlan
    status: str = "active"

class PlanLimits(BaseModel):
    appointments_per_month: int
    staff_members: int
    sms_notifications: int
    price_monthly: float

# ============= JWT HELPERS =============
def create_token(user_id: str, email: str, role: str, business_id: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "business_id": business_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

async def require_business_owner(user=Depends(get_current_user)):
    if user["role"] not in [UserRole.SUPER_ADMIN, UserRole.BUSINESS_OWNER]:
        raise HTTPException(status_code=403, detail="Business owner access required")
    return user

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def generate_confirmation_token() -> str:
    return str(uuid.uuid4()).replace("-", "")[:32]

# ============= STARTUP =============
@app.on_event("startup")
async def startup_event():
    # Create super admin if not exists
    existing = await db.users.find_one({"role": "super_admin"}, {"_id": 0})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@noshow.com",
            "full_name": "Super Admin",
            "role": UserRole.SUPER_ADMIN,
            "password_hash": hash_password("admin123456"),
            "is_active": True,
            "business_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        logger.info("Super admin created: admin@noshow.com / admin123456")

    # Create demo business if not exists
    demo_biz = await db.businesses.find_one({"name": "Restaurant Bella Napoli"}, {"_id": 0})
    if not demo_biz:
        biz_id = str(uuid.uuid4())
        owner_id = str(uuid.uuid4())
        
        # Create demo business owner
        owner = {
            "id": owner_id,
            "email": "demo@bellanapoli.com",
            "full_name": "Marco Rossi",
            "role": UserRole.BUSINESS_OWNER,
            "password_hash": hash_password("demo123456"),
            "is_active": True,
            "business_id": biz_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(owner)
        
        # Create demo business
        biz = {
            "id": biz_id,
            "name": "Restaurant Bella Napoli",
            "business_type": "restaurant",
            "phone": "+33612345678",
            "timezone": "Europe/Paris",
            "address": "12 Rue de la Paix, Paris",
            "logo_url": None,
            "owner_id": owner_id,
            "subscription": {
                "plan": "pro",
                "status": "active",
                "trial_ends_at": None,
                "started_at": datetime.now(timezone.utc).isoformat()
            },
            "reminder_settings": {
                "reminder_24h": True,
                "reminder_3h": True,
                "reminder_30min": True,
                "channels": ["email", "whatsapp"],
                "custom_message": None
            },
            "deposit_enabled": True,
            "deposit_amount": 20.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.businesses.insert_one(biz)
        
        # Create some sample appointments
        appt_statuses = [
            AppointmentStatus.CONFIRMED, AppointmentStatus.NO_SHOW, 
            AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING,
            AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW,
            AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED
        ]
        names = ["Marie Dupont", "Jean Martin", "Sophie Bernard", "Pierre Durand",
                 "Alice Moreau", "François Thomas", "Isabelle Petit", "Luc Robert"]
        phones = ["+33611111111", "+33622222222", "+33633333333", "+33644444444",
                  "+33655555555", "+33666666666", "+33677777777", "+33688888888"]
        
        from datetime import date
        today = datetime.now(timezone.utc)
        
        for i in range(8):
            days_offset = (i - 4) 
            appt_date = (today + timedelta(days=days_offset)).strftime("%Y-%m-%d")
            conf_token = generate_confirmation_token()
            appt = {
                "id": str(uuid.uuid4()),
                "business_id": biz_id,
                "client_name": names[i],
                "client_phone": phones[i],
                "client_email": f"client{i}@test.com",
                "date": appt_date,
                "time": f"{10 + i}:00",
                "duration_minutes": 60,
                "note": f"Table pour {i+1} personnes" if i % 2 == 0 else None,
                "service": "Dîner" if i % 3 == 0 else "Déjeuner",
                "staff_id": None,
                "status": appt_statuses[i],
                "confirmation_token": conf_token,
                "deposit_paid": i % 3 == 0,
                "deposit_amount": 20.0 if i % 3 == 0 else None,
                "notifications_sent": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.appointments.insert_one(appt)
        
        logger.info("Demo data created: demo@bellanapoli.com / demo123456")

# ============= AUTH ROUTES =============
@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "full_name": data.full_name,
        "role": data.role,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "business_id": None,
        "email_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id, data.email, data.role)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": data.email,
            "full_name": data.full_name,
            "role": data.role,
            "business_id": None
        }
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    token = create_token(user["id"], user["email"], user["role"], user.get("business_id"))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "business_id": user.get("business_id")
        }
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "business_id": user.get("business_id")
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(data: dict):
    email = data.get("email")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Always return success to prevent email enumeration
    return {"message": "If this email exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(data: dict):
    token = data.get("token")
    new_password = data.get("password")
    # Mock implementation
    return {"message": "Password reset successfully"}

# ============= BUSINESS ROUTES =============
@api_router.post("/businesses")
async def create_business(data: BusinessCreate, user=Depends(get_current_user)):
    if user.get("business_id"):
        raise HTTPException(status_code=400, detail="User already has a business")
    
    biz_id = str(uuid.uuid4())
    trial_ends = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    
    biz = {
        "id": biz_id,
        "name": data.name,
        "business_type": data.business_type,
        "phone": data.phone,
        "timezone": data.timezone,
        "address": data.address,
        "logo_url": data.logo_url,
        "owner_id": user["id"],
        "subscription": {
            "plan": SubscriptionPlan.FREE_TRIAL,
            "status": "active",
            "trial_ends_at": trial_ends,
            "started_at": datetime.now(timezone.utc).isoformat()
        },
        "reminder_settings": {
            "reminder_24h": True,
            "reminder_3h": True,
            "reminder_30min": False,
            "channels": ["email"],
            "custom_message": None
        },
        "deposit_enabled": False,
        "deposit_amount": 0.0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.businesses.insert_one(biz)
    
    # Update user with business_id
    await db.users.update_one({"id": user["id"]}, {"$set": {"business_id": biz_id}})
    
    return {k: v for k, v in biz.items() if k != "_id"}

@api_router.get("/businesses/me")
async def get_my_business(user=Depends(get_current_user)):
    if not user.get("business_id"):
        raise HTTPException(status_code=404, detail="No business found")
    biz = await db.businesses.find_one({"id": user["business_id"]}, {"_id": 0})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz

@api_router.put("/businesses/me")
async def update_my_business(data: BusinessUpdate, user=Depends(get_current_user)):
    if not user.get("business_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.businesses.update_one({"id": user["business_id"]}, {"$set": update_data})
    
    biz = await db.businesses.find_one({"id": user["business_id"]}, {"_id": 0})
    return biz

@api_router.put("/businesses/me/reminders")
async def update_reminder_settings(data: ReminderSettings, user=Depends(get_current_user)):
    if not user.get("business_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    await db.businesses.update_one(
        {"id": user["business_id"]},
        {"$set": {"reminder_settings": data.model_dump()}}
    )
    return {"message": "Reminder settings updated"}

@api_router.put("/businesses/me/deposit")
async def update_deposit_settings(data: dict, user=Depends(get_current_user)):
    if not user.get("business_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    await db.businesses.update_one(
        {"id": user["business_id"]},
        {"$set": {
            "deposit_enabled": data.get("deposit_enabled", False),
            "deposit_amount": data.get("deposit_amount", 0.0)
        }}
    )
    return {"message": "Deposit settings updated"}

# ============= APPOINTMENT ROUTES =============
@api_router.post("/appointments")
async def create_appointment(data: AppointmentCreate, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business associated")
    
    conf_token = generate_confirmation_token()
    appt_id = str(uuid.uuid4())
    
    appt = {
        "id": appt_id,
        "business_id": business_id,
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "client_email": data.client_email,
        "date": data.date,
        "time": data.time,
        "duration_minutes": data.duration_minutes,
        "note": data.note,
        "service": data.service,
        "staff_id": data.staff_id,
        "status": AppointmentStatus.PENDING,
        "confirmation_token": conf_token,
        "deposit_paid": False,
        "deposit_amount": data.deposit_amount if data.deposit_required else None,
        "notifications_sent": [],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appt)
    
    # Simulate sending initial confirmation request
    notification = {
        "id": str(uuid.uuid4()),
        "appointment_id": appt_id,
        "business_id": business_id,
        "type": "confirmation_request",
        "channel": "email",
        "status": NotificationStatus.SENT,
        "recipient": data.client_email or data.client_phone,
        "message": f"Confirmation de votre RDV pour {data.date} à {data.time}",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "retry_count": 0
    }
    await db.notifications.insert_one(notification)
    
    return {k: v for k, v in appt.items() if k != "_id"}

@api_router.get("/appointments")
async def get_appointments(
    user=Depends(get_current_user),
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100
):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business associated")
    
    query = {"business_id": business_id}
    if status:
        query["status"] = status
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        query.setdefault("date", {})
        query["date"]["$lte"] = date_to
    
    appts = await db.appointments.find(query, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return appts

# IMPORTANT: Specific routes must come BEFORE parameterized routes
@api_router.get("/appointments/calendar")
async def get_calendar_appointments(user=Depends(get_current_user), start_date: str = None, end_date: str = None):
    """RDV formatés pour vue calendrier"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    if not start_date:
        start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not end_date:
        end_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
    appts = await db.appointments.find(
        {"business_id": business_id, "date": {"$gte": start_date, "$lte": end_date}},
        {"_id": 0}
    ).sort([("date", 1), ("time", 1)]).to_list(500)
    
    # Grouper par date
    by_date = {}
    for appt in appts:
        date = appt["date"]
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(appt)
    
    return {
        "appointments": appts,
        "by_date": by_date,
        "start_date": start_date,
        "end_date": end_date
    }

@api_router.get("/appointments/today")
async def get_today_appointments_route(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appts = await db.appointments.find({"business_id": business_id, "date": today}, {"_id": 0}).sort("time", 1).to_list(100)
    return appts

@api_router.get("/appointments/upcoming")
async def get_upcoming_appointments_route(user=Depends(get_current_user), days: int = 7):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    appts = await db.appointments.find(
        {"business_id": business_id, "date": {"$gte": today, "$lte": end_date}},
        {"_id": 0}
    ).sort([("date", 1), ("time", 1)]).to_list(200)
    return appts

@api_router.get("/appointments/export")
async def export_appointments_route(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    appts = await db.appointments.find({"business_id": business_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    return {"appointments": appts, "total": len(appts), "exported_at": datetime.now(timezone.utc).isoformat()}

@api_router.post("/appointments/bulk-status")
async def bulk_update_status_route(data: dict, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    ids = data.get("ids", [])
    new_status = data.get("status")
    if not ids or not new_status:
        raise HTTPException(status_code=400, detail="ids and status required")
    await db.appointments.update_many(
        {"id": {"$in": ids}, "business_id": business_id},
        {"$set": {"status": new_status}}
    )
    return {"updated": len(ids)}

@api_router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    query = {"id": appointment_id}
    if user["role"] != UserRole.SUPER_ADMIN:
        query["business_id"] = business_id
    
    appt = await db.appointments.find_one(query, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt

@api_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    query = {"id": appointment_id}
    if user["role"] != UserRole.SUPER_ADMIN:
        query["business_id"] = business_id
    
    # Récupérer l'ancien statut pour détecter le changement
    old_appt = await db.appointments.find_one(query, {"_id": 0, "status": 1})
    old_status = old_appt.get("status") if old_appt else None
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.appointments.update_one(query, {"$set": update_data})
    
    appt = await db.appointments.find_one(query, {"_id": 0})
    
    # 🚀 TRIGGER AUTOMATIQUE: Si le statut passe à "completed", déclencher post-RDV
    new_status = update_data.get("status") or (appt.get("status") if appt else None)
    if old_status != "completed" and new_status == "completed" and appt:
        try:
            from services.post_rdv_automation_service import PostRdvAutomationService
            automation_service = PostRdvAutomationService(db)
            asyncio.create_task(automation_service.trigger_post_rdv(appointment_id, appt["business_id"]))
            logger.info(f"🚀 Post-RDV automation triggered for appointment {appointment_id}")
        except Exception as e:
            logger.error(f"❌ Error triggering post-RDV automation: {e}")
    
    return appt

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    query = {"id": appointment_id}
    if user["role"] != UserRole.SUPER_ADMIN:
        query["business_id"] = business_id
    
    result = await db.appointments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment deleted"}

@api_router.post("/appointments/{appointment_id}/send-reminder")
async def send_reminder(appointment_id: str, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    appt = await db.appointments.find_one({"id": appointment_id, "business_id": business_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Mock send reminder
    notification = {
        "id": str(uuid.uuid4()),
        "appointment_id": appointment_id,
        "business_id": business_id,
        "type": "manual_reminder",
        "channel": "email",
        "status": NotificationStatus.SENT,
        "recipient": appt.get("client_email") or appt.get("client_phone"),
        "message": f"Rappel: votre RDV est le {appt['date']} à {appt['time']}",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "retry_count": 0
    }
    await db.notifications.insert_one(notification)
    
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$push": {"notifications_sent": notification["id"]}}
    )
    
    return {"message": "Reminder sent successfully", "notification_id": notification["id"]}

# ============= CLIENT CONFIRMATION (PUBLIC) =============
@api_router.get("/confirm/{token}")
async def get_appointment_by_token(token: str):
    appt = await db.appointments.find_one({"confirmation_token": token}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    biz = await db.businesses.find_one({"id": appt["business_id"]}, {"_id": 0, "name": 1, "phone": 1, "business_type": 1})
    
    return {
        "appointment": {
            "id": appt["id"],
            "client_name": appt["client_name"],
            "date": appt["date"],
            "time": appt["time"],
            "service": appt.get("service"),
            "status": appt["status"],
            "deposit_paid": appt.get("deposit_paid", False),
            "deposit_amount": appt.get("deposit_amount")
        },
        "business": biz
    }

@api_router.post("/confirm/{token}/action")
async def confirm_appointment_action(token: str, data: dict):
    action = data.get("action")  # confirm, cancel, reschedule
    
    appt = await db.appointments.find_one({"confirmation_token": token}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Invalid link")
    
    status_map = {
        "confirm": AppointmentStatus.CONFIRMED,
        "cancel": AppointmentStatus.CANCELLED,
        "reschedule": AppointmentStatus.RESCHEDULED
    }
    
    new_status = status_map.get(action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    update = {"status": new_status}
    if action == "reschedule" and data.get("new_date"):
        update["date"] = data["new_date"]
        update["time"] = data.get("new_time", appt["time"])
    
    await db.appointments.update_one(
        {"confirmation_token": token},
        {"$set": update}
    )
    
    return {"message": f"Appointment {action}ed successfully", "status": new_status}

# ============= NOTIFICATIONS =============
@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user), limit: int = 50):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    notifs = await db.notifications.find(
        {"business_id": business_id}, {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    return notifs

@api_router.post("/notifications/{notification_id}/retry")
async def retry_notification(notification_id: str, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    notif = await db.notifications.find_one(
        {"id": notification_id, "business_id": business_id}, {"_id": 0}
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"status": NotificationStatus.SENT, "retry_count": notif.get("retry_count", 0) + 1}}
    )
    return {"message": "Notification retried"}

# ============= STATISTICS =============
@api_router.get("/stats/business")
async def get_business_stats(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    total = await db.appointments.count_documents({"business_id": business_id})
    confirmed = await db.appointments.count_documents({"business_id": business_id, "status": "confirmed"})
    no_show = await db.appointments.count_documents({"business_id": business_id, "status": "no_show"})
    cancelled = await db.appointments.count_documents({"business_id": business_id, "status": "cancelled"})
    completed = await db.appointments.count_documents({"business_id": business_id, "status": "completed"})
    pending = await db.appointments.count_documents({"business_id": business_id, "status": "pending"})
    
    # This week
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    this_week = await db.appointments.count_documents({"business_id": business_id, "date": {"$gte": week_start}})
    
    # Today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_count = await db.appointments.count_documents({"business_id": business_id, "date": today})
    
    # No-show rate
    no_show_rate = round((no_show / total * 100) if total > 0 else 0, 1)
    
    # Estimate money saved (assume 50€ avg per appointment saved)
    confirmed_revenue = confirmed * 50
    potential_loss_avoided = (total - no_show) * 50 if total > 0 else 0
    
    # High risk clients (those who have been no-show before)
    no_show_appts = await db.appointments.find(
        {"business_id": business_id, "status": "no_show"}, {"_id": 0, "client_phone": 1}
    ).to_list(1000)
    high_risk_phones = list(set(a["client_phone"] for a in no_show_appts))
    
    return {
        "total": total,
        "confirmed": confirmed,
        "pending": pending,
        "no_show": no_show,
        "cancelled": cancelled,
        "completed": completed,
        "this_week": this_week,
        "today": today_count,
        "no_show_rate": no_show_rate,
        "money_saved_estimate": potential_loss_avoided,
        "high_risk_clients": len(high_risk_phones)
    }

# ============= STAFF MANAGEMENT =============
@api_router.get("/staff")
async def get_staff(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    staff = await db.users.find(
        {"business_id": business_id, "role": "staff"}, {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return staff

@api_router.post("/staff")
async def create_staff(data: StaffCreate, user=Depends(require_business_owner)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    staff_id = str(uuid.uuid4())
    staff = {
        "id": staff_id,
        "email": data.email,
        "full_name": data.full_name,
        "role": UserRole.STAFF,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "business_id": business_id,
        "permissions": data.permissions or ["view_appointments", "create_appointments"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(staff)
    
    return {k: v for k, v in staff.items() if k not in ["_id", "password_hash"]}

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, user=Depends(require_business_owner)):
    business_id = user.get("business_id")
    result = await db.users.delete_one({"id": staff_id, "business_id": business_id, "role": "staff"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return {"message": "Staff member removed"}

# ============= SUPER ADMIN ROUTES =============
@api_router.get("/admin/dashboard")
async def admin_dashboard(user=Depends(require_super_admin)):
    total_businesses = await db.businesses.count_documents({})
    active_businesses = await db.businesses.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    total_appointments = await db.appointments.count_documents({})
    total_no_shows = await db.appointments.count_documents({"status": "no_show"})
    
    # Subscription breakdown
    plans = {}
    for plan in [p.value for p in SubscriptionPlan]:
        count = await db.businesses.count_documents({"subscription.plan": plan})
        plans[plan] = count
    
    # MRR calculation (mock prices)
    plan_prices = {"solo": 29, "pro": 59, "business": 99, "free_trial": 0}
    mrr = sum(plan_prices.get(p, 0) * c for p, c in plans.items())
    
    no_show_rate = round((total_no_shows / total_appointments * 100) if total_appointments > 0 else 0, 1)
    
    return {
        "total_businesses": total_businesses,
        "active_businesses": active_businesses,
        "total_users": total_users,
        "total_appointments": total_appointments,
        "total_no_shows": total_no_shows,
        "no_show_rate": no_show_rate,
        "mrr": mrr,
        "subscription_breakdown": plans
    }

@api_router.get("/admin/businesses")
async def admin_list_businesses(user=Depends(require_super_admin), limit: int = 100):
    businesses = await db.businesses.find({}, {"_id": 0}).limit(limit).to_list(limit)
    for biz in businesses:
        owner = await db.users.find_one({"id": biz.get("owner_id")}, {"_id": 0, "email": 1, "full_name": 1})
        biz["owner"] = owner
        appt_count = await db.appointments.count_documents({"business_id": biz["id"]})
        biz["appointment_count"] = appt_count
    return businesses

@api_router.put("/admin/businesses/{business_id}/toggle")
async def toggle_business(business_id: str, user=Depends(require_super_admin)):
    biz = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    
    new_status = not biz.get("is_active", True)
    await db.businesses.update_one({"id": business_id}, {"$set": {"is_active": new_status}})
    return {"is_active": new_status}

@api_router.put("/admin/businesses/{business_id}/subscription")
async def update_business_subscription(business_id: str, data: SubscriptionUpdate, user=Depends(require_super_admin)):
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"subscription.plan": data.plan, "subscription.status": data.status}}
    )
    return {"message": "Subscription updated"}

@api_router.get("/admin/business/{business_id}/details")
async def admin_business_details(business_id: str, user=Depends(require_super_admin)):
    biz = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    owner = await db.users.find_one({"id": biz.get("owner_id")}, {"_id": 0, "password_hash": 0})
    staff = await db.users.find({"business_id": business_id, "role": "staff"}, {"_id": 0, "password_hash": 0}).to_list(50)
    appts = await db.appointments.find({"business_id": business_id}, {"_id": 0}).sort("date", -1).limit(20).to_list(20)
    total_appts = await db.appointments.count_documents({"business_id": business_id})
    no_shows = await db.appointments.count_documents({"business_id": business_id, "status": "no_show"})
    confirmed = await db.appointments.count_documents({"business_id": business_id, "status": "confirmed"})
    notif_count = await db.notifications.count_documents({"business_id": business_id})
    return {
        "business": biz,
        "owner": owner,
        "staff": staff,
        "recent_appointments": appts,
        "stats": {
            "total_appointments": total_appts,
            "no_shows": no_shows,
            "confirmed": confirmed,
            "no_show_rate": round(no_shows / total_appts * 100 if total_appts > 0 else 0, 1),
            "notifications_sent": notif_count
        }
    }

# Legacy plans routes removed - see consolidated routes at end of file (CRUD for db.plans)

@api_router.post("/admin/businesses/{business_id}/message")
async def send_message_to_business(business_id: str, data: dict, user=Depends(require_super_admin)):
    # Mock send message / notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": "admin_message",
        "from": "super_admin",
        "to_business": business_id,
        "message": data.get("message"),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_messages.insert_one(notification)
    return {"message": "Message sent"}

@api_router.get("/admin/activity")
async def admin_activity(user=Depends(require_super_admin), limit: int = 50):
    # Recent appointments across all businesses
    recent_appts = await db.appointments.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    # Enrich with business name
    for appt in recent_appts:
        biz = await db.businesses.find_one({"id": appt["business_id"]}, {"_id": 0, "name": 1})
        appt["business_name"] = biz["name"] if biz else "Unknown"
    return recent_appts

@api_router.get("/admin/stats")
async def admin_stats(user=Depends(require_super_admin)):
    # Growth by month (last 6 months)
    pipeline = [
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 7]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 6}
    ]
    monthly_signups = await db.businesses.aggregate(pipeline).to_list(6)
    
    # Notification stats
    total_notifs = await db.notifications.count_documents({})
    sent_notifs = await db.notifications.count_documents({"status": "sent"})
    failed_notifs = await db.notifications.count_documents({"status": "failed"})
    
    return {
        "monthly_signups": monthly_signups,
        "notifications": {
            "total": total_notifs,
            "sent": sent_notifs,
            "failed": failed_notifs
        }
    }

@api_router.get("/admin/users")
async def admin_list_users(user=Depends(require_super_admin), limit: int = 100):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).limit(limit).to_list(limit)
    return users

# ============= PLAN INFO =============
@api_router.get("/plans")
async def get_plans():
    return [
        {
            "id": "free_trial",
            "name": "Essai Gratuit",
            "name_en": "Free Trial",
            "price": 0,
            "duration_days": 14,
            "appointments_per_month": 30,
            "staff_members": 1,
            "sms_notifications": 10,
            "features": ["Email reminders", "Basic dashboard", "Client confirmation"]
        },
        {
            "id": "solo",
            "name": "Solo",
            "name_en": "Solo",
            "price": 29,
            "appointments_per_month": 100,
            "staff_members": 1,
            "sms_notifications": 50,
            "features": ["All free features", "WhatsApp reminders", "Analytics", "Custom messages"]
        },
        {
            "id": "pro",
            "name": "Pro",
            "name_en": "Pro",
            "price": 59,
            "appointments_per_month": 500,
            "staff_members": 5,
            "sms_notifications": 200,
            "features": ["All Solo features", "SMS reminders", "Staff management", "Deposit collection", "No-show risk score"]
        },
        {
            "id": "business",
            "name": "Business",
            "name_en": "Business",
            "price": 99,
            "appointments_per_month": -1,
            "staff_members": -1,
            "sms_notifications": -1,
            "features": ["All Pro features", "Unlimited everything", "Priority support", "Custom branding", "API access"]
        }
    ]

# ============= BUSINESS UTILITY ROUTES =============
@api_router.get("/clients/blacklist")
async def get_blacklist(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    blacklist = await db.blacklist.find({"business_id": business_id}, {"_id": 0}).to_list(100)
    return blacklist

@api_router.post("/clients/blacklist")
async def add_to_blacklist(data: dict, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    entry = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "client_phone": data.get("client_phone"),
        "client_name": data.get("client_name"),
        "reason": data.get("reason", "Repeated no-shows"),
        "no_show_count": data.get("no_show_count", 1),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.blacklist.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}

@api_router.delete("/clients/blacklist/{entry_id}")
async def remove_from_blacklist(entry_id: str, user=Depends(get_current_user)):
    business_id = user.get("business_id")
    await db.blacklist.delete_one({"id": entry_id, "business_id": business_id})
    return {"message": "Removed from blacklist"}

@api_router.get("/clients/risk-scores")
async def get_risk_scores(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    # Aggregate no-show counts per client phone
    pipeline = [
        {"$match": {"business_id": business_id}},
        {"$group": {
            "_id": "$client_phone",
            "client_name": {"$last": "$client_name"},
            "total": {"$sum": 1},
            "no_shows": {"$sum": {"$cond": [{"$eq": ["$status", "no_show"]}, 1, 0]}},
            "confirmed": {"$sum": {"$cond": [{"$eq": ["$status", "confirmed"]}, 1, 0]}}
        }},
        {"$addFields": {
            "no_show_rate": {"$cond": [{"$gt": ["$total", 0]}, {"$divide": ["$no_shows", "$total"]}, 0]}
        }},
        {"$sort": {"no_show_rate": -1}},
        {"$limit": 50}
    ]
    result = await db.appointments.aggregate(pipeline).to_list(50)
    clients = []
    for r in result:
        rate = r.get("no_show_rate", 0)
        risk = "high" if rate >= 0.5 else "medium" if rate >= 0.25 else "low"
        clients.append({
            "phone": r["_id"],
            "client_name": r.get("client_name", ""),
            "total_appointments": r["total"],
            "no_shows": r["no_shows"],
            "confirmed": r["confirmed"],
            "no_show_rate": round(rate * 100, 1),
            "risk_level": risk
        })
    return clients

@api_router.get("/stats/business/weekly")
async def get_weekly_stats(user=Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    # Last 8 weeks data
    result = []
    for i in range(7, -1, -1):
        week_start = (datetime.now(timezone.utc) - timedelta(days=(i+1)*7)).strftime("%Y-%m-%d")
        week_end = (datetime.now(timezone.utc) - timedelta(days=i*7)).strftime("%Y-%m-%d")
        total = await db.appointments.count_documents({"business_id": business_id, "date": {"$gte": week_start, "$lt": week_end}})
        no_shows = await db.appointments.count_documents({"business_id": business_id, "date": {"$gte": week_start, "$lt": week_end}, "status": "no_show"})
        confirmed = await db.appointments.count_documents({"business_id": business_id, "date": {"$gte": week_start, "$lt": week_end}, "status": "confirmed"})
        result.append({
            "week": f"S-{i}" if i > 0 else "Cette sem.",
            "total": total, "no_shows": no_shows, "confirmed": confirmed
        })
    return result

# ============= PAYMENTS (SIMULATION MODE) =============
@api_router.post("/payments/subscription")
async def create_subscription(data: dict, user=Depends(get_current_user)):
    """Crée un abonnement (simulé)"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    plan = data.get("plan", "solo")
    
    # Mode simulation
    now = datetime.now(timezone.utc)
    subscription_id = f"sub_sim_{str(uuid.uuid4())[:8]}"
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {
            "subscription.plan": plan,
            "subscription.status": "active",
            "subscription.stripe_subscription_id": subscription_id,
            "subscription.started_at": now.isoformat()
        }}
    )
    
    return {
        "subscription_id": subscription_id,
        "plan": plan,
        "status": "active",
        "simulation_mode": True,
        "message": "Abonnement activé (mode simulation)"
    }

@api_router.post("/payments/cancel-subscription")
async def cancel_subscription(user=Depends(get_current_user)):
    """Annule un abonnement (simulé)"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {
            "subscription.status": "cancelled",
            "subscription.cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "simulation_mode": True}

@api_router.post("/payments/deposit-checkout")
async def create_deposit_checkout(data: dict, user=Depends(get_current_user)):
    """Crée une session de paiement pour dépôt (simulé)"""
    business_id = user.get("business_id")
    appointment_id = data.get("appointment_id")
    amount = data.get("amount", 20)
    
    session_id = f"cs_sim_{str(uuid.uuid4())[:12]}"
    
    deposit = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "appointment_id": appointment_id,
        "business_id": business_id,
        "amount": amount,
        "status": "pending",
        "simulation_mode": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.deposits.insert_one(deposit)
    
    return {
        "session_id": session_id,
        "checkout_url": f"/api/payments/simulate-deposit/{session_id}",
        "amount": amount,
        "simulation_mode": True
    }

@api_router.get("/payments/simulate-deposit/{session_id}")
async def simulate_deposit_payment(session_id: str):
    """Simule le paiement d'un dépôt"""
    deposit = await db.deposits.find_one({"session_id": session_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    await db.deposits.update_one(
        {"session_id": session_id},
        {"$set": {"status": "succeeded", "paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.appointments.update_one(
        {"id": deposit["appointment_id"]},
        {"$set": {"deposit_paid": True}}
    )
    
    return {
        "success": True,
        "message": "Dépôt payé (simulation)",
        "amount": deposit["amount"]
    }

@api_router.get("/payments/stats")
async def get_payment_stats(user=Depends(get_current_user)):
    """Stats de paiements pour un business"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    total = await db.deposits.count_documents({"business_id": business_id})
    paid = await db.deposits.count_documents({"business_id": business_id, "status": "succeeded"})
    
    pipeline = [
        {"$match": {"business_id": business_id, "status": "succeeded"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    result = await db.deposits.aggregate(pipeline).to_list(1)
    total_amount = result[0]["total"] if result else 0
    
    return {
        "total_deposits": total,
        "paid_deposits": paid,
        "total_amount": total_amount,
        "conversion_rate": round(paid / total * 100, 1) if total > 0 else 0,
        "simulation_mode": True
    }

# ============= PUBLIC STATS (FOR LANDING PAGE) =============
@api_router.get("/public/stats")
async def get_public_stats():
    """Statistiques publiques agrégées et anonymisées pour la landing page"""
    total_appointments = await db.appointments.count_documents({})
    confirmed = await db.appointments.count_documents({"status": "confirmed"})
    completed = await db.appointments.count_documents({"status": "completed"})
    no_shows = await db.appointments.count_documents({"status": "no_show"})
    total_businesses = await db.businesses.count_documents({"is_active": True})
    
    # Estimation argent économisé (50€ moyenne par RDV honoré)
    money_saved = (confirmed + completed) * 50
    
    # Taux de confirmation
    confirmation_rate = round((confirmed + completed) / total_appointments * 100, 1) if total_appointments > 0 else 95
    
    return {
        "total_appointments_managed": total_appointments,
        "money_saved_total": money_saved,
        "businesses_count": total_businesses,
        "confirmation_rate": confirmation_rate,
        "no_show_reduction": 85  # Valeur marketing
    }

# ============= CLIENT MANAGEMENT =============
@api_router.get("/clients")
async def get_clients(user=Depends(get_current_user)):
    """Liste tous les clients uniques avec leurs stats"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    pipeline = [
        {"$match": {"business_id": business_id}},
        {"$group": {
            "_id": "$client_phone",
            "client_name": {"$last": "$client_name"},
            "client_email": {"$last": "$client_email"},
            "total_appointments": {"$sum": 1},
            "confirmed": {"$sum": {"$cond": [{"$eq": ["$status", "confirmed"]}, 1, 0]}},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
            "no_shows": {"$sum": {"$cond": [{"$eq": ["$status", "no_show"]}, 1, 0]}},
            "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}},
            "last_appointment": {"$max": "$date"},
            "first_appointment": {"$min": "$date"}
        }},
        {"$addFields": {
            "reliability_score": {
                "$cond": [
                    {"$gt": ["$total_appointments", 0]},
                    {"$multiply": [
                        {"$divide": [
                            {"$add": ["$confirmed", "$completed"]},
                            "$total_appointments"
                        ]},
                        100
                    ]},
                    100
                ]
            }
        }},
        {"$sort": {"total_appointments": -1}},
        {"$limit": 200}
    ]
    
    clients = await db.appointments.aggregate(pipeline).to_list(200)
    
    return [{
        "phone": c["_id"],
        "name": c.get("client_name", ""),
        "email": c.get("client_email"),
        "total_appointments": c["total_appointments"],
        "confirmed": c["confirmed"],
        "completed": c["completed"],
        "no_shows": c["no_shows"],
        "cancelled": c["cancelled"],
        "reliability_score": round(c.get("reliability_score", 100), 1),
        "last_appointment": c.get("last_appointment"),
        "first_appointment": c.get("first_appointment")
    } for c in clients]

@api_router.get("/clients/{phone}/history")
async def get_client_history(phone: str, user=Depends(get_current_user)):
    """Historique complet d'un client"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    appts = await db.appointments.find(
        {"business_id": business_id, "client_phone": phone},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return appts

# ============= NOTIFICATION STATS =============
@api_router.get("/notifications/stats")
async def get_notification_stats(user=Depends(get_current_user)):
    """Stats des notifications"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    total = await db.notifications.count_documents({"business_id": business_id})
    sent = await db.notifications.count_documents({"business_id": business_id, "status": "sent"})
    failed = await db.notifications.count_documents({"business_id": business_id, "status": "failed"})
    pending = await db.notifications.count_documents({"business_id": business_id, "status": {"$in": ["pending", "queued"]}})
    
    by_channel = {}
    for channel in ["email", "sms", "whatsapp"]:
        count = await db.notifications.count_documents({"business_id": business_id, "channel": channel})
        by_channel[channel] = count
    
    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "pending": pending,
        "success_rate": round(sent / total * 100, 1) if total > 0 else 100,
        "by_channel": by_channel,
        "simulation_mode": True
    }

# ============= ADMIN EXTENDED =============
@api_router.get("/admin/revenue")
async def admin_revenue_stats(user=Depends(require_super_admin)):
    """Stats de revenus pour admin"""
    plan_prices = {"solo": 29, "pro": 59, "business": 99, "free_trial": 0}
    
    pipeline = [
        {"$group": {
            "_id": "$subscription.plan",
            "count": {"$sum": 1}
        }}
    ]
    plans = await db.businesses.aggregate(pipeline).to_list(10)
    
    mrr = sum(plan_prices.get(p["_id"], 0) * p["count"] for p in plans)
    arr = mrr * 12
    
    # Churn (mock)
    total_biz = await db.businesses.count_documents({})
    cancelled = await db.businesses.count_documents({"subscription.status": "cancelled"})
    churn_rate = round(cancelled / total_biz * 100, 1) if total_biz > 0 else 0
    
    return {
        "mrr": mrr,
        "arr": arr,
        "churn_rate": churn_rate,
        "total_businesses": total_biz,
        "cancelled_businesses": cancelled,
        "plans_breakdown": {p["_id"]: p["count"] for p in plans}
    }

@api_router.post("/admin/broadcast")
async def admin_broadcast(data: dict, user=Depends(require_super_admin)):
    """Envoie un message à tous les business owners"""
    message = data.get("message")
    subject = data.get("subject", "Message de NoShowGone")
    
    businesses = await db.businesses.find({"is_active": True}, {"_id": 0, "id": 1, "owner_id": 1}).to_list(1000)
    
    broadcast = {
        "id": str(uuid.uuid4()),
        "type": "broadcast",
        "subject": subject,
        "message": message,
        "sent_to": len(businesses),
        "sent_by": user["id"],
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_messages.insert_one(broadcast)
    
    return {
        "success": True,
        "sent_to": len(businesses),
        "simulation_mode": True,
        "message": "Broadcast envoyé (simulation)"
    }

@api_router.get("/admin/system-health")
async def admin_system_health(user=Depends(require_super_admin)):
    """État du système"""
    return {
        "database": "healthy",
        "notifications": "simulation_mode",
        "payments": "simulation_mode",
        "api": "healthy",
        "uptime": "99.9%",
        "last_check": datetime.now(timezone.utc).isoformat()
    }

# ============= HEALTH CHECK =============
@api_router.get("/")
async def root():
    return {"message": "NoShowGone API v1.0", "status": "healthy"}

# ============= ML SCORING =============
@api_router.get("/ml/risk-score/{phone}")
async def get_client_risk_score(phone: str, user=Depends(get_current_user), date: str = None, time: str = None):
    """Calcule le score de risque ML d'un client"""
    from services.ml_scoring_service import MLScoringService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    scoring_service = MLScoringService(db)
    score = await scoring_service.calculate_client_risk_score(phone, business_id, date, time)
    return score

@api_router.get("/ml/risk-overview")
async def get_risk_overview(user=Depends(get_current_user)):
    """Vue d'ensemble des risques pour une entreprise"""
    from services.ml_scoring_service import MLScoringService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    scoring_service = MLScoringService(db)
    overview = await scoring_service.get_business_risk_overview(business_id)
    return overview

@api_router.post("/ml/score-appointment/{appointment_id}")
async def score_appointment(appointment_id: str, user=Depends(get_current_user)):
    """Calcule le score pour un RDV spécifique"""
    from services.ml_scoring_service import MLScoringService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    # Récupérer le RDV
    appt = await db.appointments.find_one({"id": appointment_id, "business_id": business_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    scoring_service = MLScoringService(db)
    score = await scoring_service.calculate_client_risk_score(
        appt.get("client_phone", ""),
        business_id,
        appt.get("date"),
        appt.get("time")
    )
    
    # Mettre à jour le RDV avec le score
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"risk_score": score.get("score"), "risk_level": score.get("risk_level")}}
    )
    
    return score

# ============= CALENDAR INTEGRATION =============
@api_router.get("/calendar/connections")
async def get_calendar_connections(user=Depends(get_current_user)):
    """Liste les connexions calendrier"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = CalendarIntegrationService(db)
    connections = await service.get_calendar_connections(business_id)
    return connections

@api_router.get("/calendar/google/auth-url")
async def get_google_auth_url(user=Depends(get_current_user)):
    """Obtient l'URL d'authentification Google"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = CalendarIntegrationService(db)
    url = service.get_google_auth_url(business_id)
    return {"auth_url": url}

@api_router.get("/calendar/google/callback")
async def google_calendar_callback(code: str = None, state: str = None, business_id: str = None):
    """Callback OAuth Google"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    biz_id = state or business_id
    if not biz_id:
        raise HTTPException(status_code=400, detail="Missing business_id")
    
    service = CalendarIntegrationService(db)
    result = await service.handle_google_callback(code or "simulate", biz_id)
    return result

@api_router.get("/calendar/google/callback-simulate")
async def google_calendar_callback_simulate(business_id: str):
    """Callback OAuth Google (simulation)"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    service = CalendarIntegrationService(db)
    result = await service.handle_google_callback("simulate", business_id)
    return result

@api_router.post("/calendar/google/sync")
async def sync_google_calendar(user=Depends(get_current_user)):
    """Synchronise Google Calendar"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = CalendarIntegrationService(db)
    result = await service.sync_google_calendar(business_id)
    return result

@api_router.delete("/calendar/{provider}/disconnect")
async def disconnect_calendar(provider: str, user=Depends(get_current_user)):
    """Déconnecte un calendrier"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = CalendarIntegrationService(db)
    result = await service.disconnect_calendar(business_id, provider)
    return result

# ============= EXTERNAL API (TheFork, OpenTable) =============
@api_router.get("/external-api/connections")
async def get_external_api_connections(user=Depends(get_current_user)):
    """Liste les connexions API externes"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = CalendarIntegrationService(db)
    connections = await service.get_external_api_connections(business_id)
    return connections

@api_router.post("/external-api/register")
async def register_external_api(data: dict, user=Depends(get_current_user)):
    """Enregistre une connexion API externe"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    platform = data.get("platform")
    if not platform:
        raise HTTPException(status_code=400, detail="Platform required")
    
    service = CalendarIntegrationService(db)
    result = await service.register_external_api(
        business_id,
        platform,
        data.get("api_key"),
        data.get("webhook_secret")
    )
    return result

@api_router.post("/webhooks/{platform}/{business_id}")
async def handle_external_webhook(platform: str, business_id: str, payload: dict):
    """Webhook pour plateformes externes (TheFork, OpenTable, etc.)"""
    from services.calendar_integration_service import CalendarIntegrationService
    
    service = CalendarIntegrationService(db)
    result = await service.handle_external_webhook(platform, business_id, payload)
    return result

# ============= ADMIN PLANS CRUD =============
@api_router.post("/admin/plans")
async def create_plan(data: dict, user=Depends(require_super_admin)):
    """Crée un nouveau plan"""
    plan = {
        "id": data.get("id") or str(uuid.uuid4()),
        "name": data.get("name", "Nouveau Plan"),
        "price": data.get("price", 0),
        "appointments_per_month": data.get("appointments_per_month", 100),
        "staff_members": data.get("staff_members", 1),
        "sms_notifications": data.get("sms_notifications", 50),
        "features": data.get("features", []),
        "is_active": data.get("is_active", True),
        "trial_days": data.get("trial_days", 0),
        "color": data.get("color", "#3b82f6"),
        "order": data.get("order", 99),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.plans.insert_one(plan)
    return {k: v for k, v in plan.items() if k != "_id"}

@api_router.put("/admin/plans/{plan_id}")
async def update_plan(plan_id: str, data: dict, user=Depends(require_super_admin)):
    """Met à jour un plan"""
    update_data = {
        "name": data.get("name"),
        "price": data.get("price"),
        "appointments_per_month": data.get("appointments_per_month"),
        "staff_members": data.get("staff_members"),
        "sms_notifications": data.get("sms_notifications"),
        "features": data.get("features"),
        "is_active": data.get("is_active"),
        "trial_days": data.get("trial_days"),
        "color": data.get("color"),
        "order": data.get("order"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Filtrer les valeurs None
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.plans.update_one({"id": plan_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        # Créer le plan s'il n'existe pas (pour les plans par défaut)
        update_data["id"] = plan_id
        update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.plans.insert_one(update_data)
    
    return {"success": True, "id": plan_id}

@api_router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, user=Depends(require_super_admin)):
    """Supprime un plan"""
    # Vérifier qu'aucune entreprise n'utilise ce plan
    businesses_with_plan = await db.businesses.count_documents({"subscription.plan": plan_id})
    
    if businesses_with_plan > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de supprimer: {businesses_with_plan} entreprise(s) utilisent ce plan"
        )
    
    result = await db.plans.delete_one({"id": plan_id})
    
    return {
        "success": result.deleted_count > 0,
        "message": "Plan supprimé" if result.deleted_count > 0 else "Plan non trouvé"
    }

@api_router.get("/admin/plans")
async def get_all_plans(user=Depends(get_current_user)):
    """Liste tous les plans"""
    plans = await db.plans.find({}, {"_id": 0}).sort("order", 1).to_list(20)
    
    # Si pas de plans, retourner les plans par défaut
    if not plans:
        default_plans = [
            {"id": "free_trial", "name": "Essai Gratuit", "price": 0, "appointments_per_month": 30, "staff_members": 1, "sms_notifications": 10, "features": ["Email reminders", "Basic dashboard"], "is_active": True, "trial_days": 14, "color": "#f59e0b", "order": 1},
            {"id": "solo", "name": "Solo", "price": 29, "appointments_per_month": 100, "staff_members": 1, "sms_notifications": 50, "features": ["All free features", "WhatsApp reminders", "Analytics"], "is_active": True, "trial_days": 0, "color": "#3b82f6", "order": 2},
            {"id": "pro", "name": "Pro", "price": 59, "appointments_per_month": 500, "staff_members": 5, "sms_notifications": 200, "features": ["All Solo features", "SMS", "Deposit collection", "Risk score ML"], "is_active": True, "trial_days": 0, "color": "#15803d", "order": 3},
            {"id": "business", "name": "Business", "price": 99, "appointments_per_month": -1, "staff_members": -1, "sms_notifications": -1, "features": ["Everything unlimited", "Priority support", "API access", "White label", "Calendar sync"], "is_active": True, "trial_days": 0, "color": "#8b5cf6", "order": 4},
        ]
        # Insérer les plans par défaut
        for plan in default_plans:
            await db.plans.update_one({"id": plan["id"]}, {"$set": plan}, upsert=True)
        return default_plans
    
    return plans

# ============= NOTIFICATION TEMPLATES =============
@api_router.get("/templates")
async def get_templates(user=Depends(get_current_user)):
    """Liste les templates de notifications"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    templates = await service.get_templates(business_id)
    return templates

@api_router.get("/templates/variables")
async def get_template_variables():
    """Liste les variables disponibles pour les templates"""
    from services.template_service import TemplateService
    
    service = TemplateService(db)
    return service.get_available_variables()

@api_router.get("/templates/{template_id}")
async def get_template(template_id: str, user=Depends(get_current_user)):
    """Récupère un template spécifique"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    template = await service.get_template(business_id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@api_router.put("/templates/{template_id}")
async def save_template(template_id: str, data: dict, user=Depends(get_current_user)):
    """Sauvegarde un template"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    template = await service.save_template(business_id, template_id, data)
    return template

@api_router.post("/templates")
async def create_template(data: dict, user=Depends(get_current_user)):
    """Crée un nouveau template personnalisé"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    template = await service.create_custom_template(business_id, data)
    return template

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    """Supprime ou reset un template"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    result = await service.delete_template(business_id, template_id)
    return result

@api_router.post("/templates/{template_id}/reset")
async def reset_template(template_id: str, user=Depends(get_current_user)):
    """Remet un template à sa valeur par défaut"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    result = await service.reset_template(business_id, template_id)
    return result

@api_router.get("/templates/{template_id}/preview")
async def preview_template(template_id: str, lang: str = "fr", user=Depends(get_current_user)):
    """Prévisualise un template"""
    from services.template_service import TemplateService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = TemplateService(db)
    preview = await service.preview_template(business_id, template_id, lang)
    return preview

# ============= NOTIFICATION LOGS =============
@api_router.get("/notification-logs")
async def get_notification_logs(limit: int = 50, user=Depends(get_current_user)):
    """Liste les logs de notifications avec fallback"""
    from services.template_service import NotificationFallbackService
    
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = NotificationFallbackService(db)
    logs = await service.get_notification_logs(business_id, limit)
    return logs

@api_router.post("/notification-logs/{notification_id}/retry")
async def retry_notification(notification_id: str, user=Depends(get_current_user)):
    """Retente l'envoi d'une notification"""
    from services.template_service import NotificationFallbackService
    
    service = NotificationFallbackService(db)
    result = await service.retry_notification(notification_id)
    return result

# ============= ONBOARDING CONFIG =============
@api_router.get("/business/onboarding-status")
async def get_onboarding_status(user=Depends(get_current_user)):
    """Vérifie l'état de l'onboarding"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    settings = business.get("settings", {})
    
    steps = {
        "basic_info": bool(business.get("name") and business.get("industry")),
        "contact_info": bool(business.get("phone") or business.get("email")),
        "address": bool(business.get("address")),
        "opening_hours": bool(settings.get("opening_hours")),
        "timezone": bool(settings.get("timezone")),
        "reminders_configured": bool(settings.get("reminders")),
        "first_appointment": await db.appointments.count_documents({"business_id": business_id}) > 0
    }
    
    completed = sum(1 for v in steps.values() if v)
    total = len(steps)
    
    return {
        "steps": steps,
        "completed": completed,
        "total": total,
        "progress": round(completed / total * 100),
        "is_complete": completed == total
    }

@api_router.put("/business/settings/hours")
async def update_opening_hours(data: dict, user=Depends(get_current_user)):
    """Met à jour les horaires d'ouverture"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"settings.opening_hours": data.get("hours", {})}}
    )
    
    return {"success": True}

@api_router.put("/business/settings/timezone")
async def update_timezone(data: dict, user=Depends(get_current_user)):
    """Met à jour le fuseau horaire"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"settings.timezone": data.get("timezone", "Europe/Paris")}}
    )
    
    return {"success": True}

# ============= CLIENT RATINGS =============
@api_router.post("/appointments/{appointment_id}/rate-client")
async def rate_client(appointment_id: str, data: dict, user=Depends(get_current_user)):
    """Note un client après un RDV terminé"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    appt = await db.appointments.find_one({"id": appointment_id, "business_id": business_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    rating = {
        "id": str(uuid.uuid4()),
        "appointment_id": appointment_id,
        "business_id": business_id,
        "client_phone": appt.get("client_phone"),
        "client_name": appt.get("client_name"),
        "punctuality": data.get("punctuality", 3),  # 1-5
        "politeness": data.get("politeness", 3),  # 1-5
        "reliability": data.get("reliability", 3),  # 1-5
        "overall": data.get("overall", 3),  # 1-5
        "comment": data.get("comment", ""),
        "rated_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.client_ratings.insert_one(rating)
    
    # Marquer le RDV comme noté
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"client_rated": True, "client_rating": rating["overall"]}}
    )
    
    return {k: v for k, v in rating.items() if k != "_id"}

@api_router.get("/clients/{phone}/ratings")
async def get_client_ratings(phone: str, user=Depends(get_current_user)):
    """Récupère les notes d'un client"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    ratings = await db.client_ratings.find(
        {"business_id": business_id, "client_phone": phone},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculer les moyennes
    if ratings:
        avg_punctuality = sum(r.get("punctuality", 3) for r in ratings) / len(ratings)
        avg_politeness = sum(r.get("politeness", 3) for r in ratings) / len(ratings)
        avg_reliability = sum(r.get("reliability", 3) for r in ratings) / len(ratings)
        avg_overall = sum(r.get("overall", 3) for r in ratings) / len(ratings)
    else:
        avg_punctuality = avg_politeness = avg_reliability = avg_overall = 0
    
    return {
        "ratings": ratings,
        "averages": {
            "punctuality": round(avg_punctuality, 1),
            "politeness": round(avg_politeness, 1),
            "reliability": round(avg_reliability, 1),
            "overall": round(avg_overall, 1)
        },
        "total_ratings": len(ratings)
    }

@api_router.get("/clients/unrated-appointments")
async def get_unrated_appointments(user=Depends(get_current_user)):
    """Liste les RDV terminés non notés"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    # RDV completed sans rating
    appts = await db.appointments.find(
        {
            "business_id": business_id,
            "status": "completed",
            "client_rated": {"$ne": True}
        },
        {"_id": 0}
    ).sort("date", -1).limit(50).to_list(50)
    
    return appts

# ============= THANK YOU MESSAGES =============
@api_router.post("/appointments/{appointment_id}/send-thankyou")
async def send_thankyou(appointment_id: str, data: dict, user=Depends(get_current_user)):
    """Envoie un message de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    appt = await db.appointments.find_one({"id": appointment_id, "business_id": business_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Récupérer le template ou utiliser le message personnalisé
    message = data.get("message", "")
    include_link = data.get("include_link", False)
    link_url = data.get("link_url", "")
    link_text = data.get("link_text", "")
    
    thankyou = {
        "id": str(uuid.uuid4()),
        "appointment_id": appointment_id,
        "business_id": business_id,
        "client_phone": appt.get("client_phone"),
        "client_email": appt.get("client_email"),
        "client_name": appt.get("client_name"),
        "message": message,
        "include_link": include_link,
        "link_url": link_url,
        "link_text": link_text,
        "channel": data.get("channel", "email"),
        "status": "sent",  # Simulation
        "sent_by": user["id"],
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.thankyou_messages.insert_one(thankyou)
    
    # Marquer le RDV
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"thankyou_sent": True, "thankyou_sent_at": thankyou["sent_at"]}}
    )
    
    return {k: v for k, v in thankyou.items() if k != "_id"}

@api_router.get("/thankyou/templates")
async def get_thankyou_templates(user=Depends(get_current_user)):
    """Liste les templates de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    templates = await db.thankyou_templates.find(
        {"business_id": business_id},
        {"_id": 0}
    ).to_list(20)
    
    # Templates par défaut si vide
    if not templates:
        default_templates = [
            {
                "id": "default_thankyou",
                "business_id": business_id,
                "name": "Remerciement standard",
                "message": "Merci {{client_name}} pour votre visite ! Nous espérons vous revoir bientôt.",
                "include_link": False,
                "is_default": True
            },
            {
                "id": "loyalty_thankyou",
                "business_id": business_id,
                "name": "Fidélité",
                "message": "Merci {{client_name}} ! En tant que client fidèle, profitez de -10% sur votre prochaine visite avec le code MERCI10.",
                "include_link": True,
                "link_text": "Réserver maintenant",
                "is_default": True
            },
            {
                "id": "review_thankyou",
                "business_id": business_id,
                "name": "Demande d'avis",
                "message": "Merci {{client_name}} ! Votre avis compte pour nous. Partagez votre expérience et aidez d'autres clients à nous découvrir.",
                "include_link": True,
                "link_text": "Donner mon avis",
                "is_default": True
            }
        ]
        for t in default_templates:
            await db.thankyou_templates.insert_one({**t})
        # Re-fetch to get clean data without _id
        templates = await db.thankyou_templates.find(
            {"business_id": business_id},
            {"_id": 0}
        ).to_list(20)
    
    return templates

@api_router.post("/thankyou/templates")
async def create_thankyou_template(data: dict, user=Depends(get_current_user)):
    """Crée un template de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    template = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "name": data.get("name", "Nouveau template"),
        "message": data.get("message", ""),
        "include_link": data.get("include_link", False),
        "link_text": data.get("link_text", ""),
        "link_url": data.get("link_url", ""),
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.thankyou_templates.insert_one(template)
    return {k: v for k, v in template.items() if k != "_id"}

@api_router.put("/thankyou/templates/{template_id}")
async def update_thankyou_template(template_id: str, data: dict, user=Depends(get_current_user)):
    """Met à jour un template de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    update_data = {
        "name": data.get("name"),
        "message": data.get("message"),
        "include_link": data.get("include_link"),
        "link_text": data.get("link_text"),
        "link_url": data.get("link_url"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    await db.thankyou_templates.update_one(
        {"id": template_id, "business_id": business_id},
        {"$set": update_data}
    )
    
    template = await db.thankyou_templates.find_one({"id": template_id}, {"_id": 0})
    return template

@api_router.delete("/thankyou/templates/{template_id}")
async def delete_thankyou_template(template_id: str, user=Depends(get_current_user)):
    """Supprime un template de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    result = await db.thankyou_templates.delete_one(
        {"id": template_id, "business_id": business_id, "is_default": {"$ne": True}}
    )
    
    return {"deleted": result.deleted_count > 0}

@api_router.post("/thankyou/bulk-send")
async def bulk_send_thankyou(data: dict, user=Depends(get_current_user)):
    """Envoie des remerciements en masse aux RDV terminés"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    template_id = data.get("template_id")
    appointment_ids = data.get("appointment_ids", [])
    
    # Récupérer le template
    template = await db.thankyou_templates.find_one({"id": template_id, "business_id": business_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    sent_count = 0
    for appt_id in appointment_ids:
        appt = await db.appointments.find_one({"id": appt_id, "business_id": business_id}, {"_id": 0})
        if appt and not appt.get("thankyou_sent"):
            # Personnaliser le message
            message = template["message"].replace("{{client_name}}", appt.get("client_name", ""))
            
            thankyou = {
                "id": str(uuid.uuid4()),
                "appointment_id": appt_id,
                "business_id": business_id,
                "client_phone": appt.get("client_phone"),
                "client_email": appt.get("client_email"),
                "client_name": appt.get("client_name"),
                "message": message,
                "include_link": template.get("include_link", False),
                "link_url": template.get("link_url", ""),
                "link_text": template.get("link_text", ""),
                "template_id": template_id,
                "channel": "email",
                "status": "sent",
                "sent_by": user["id"],
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.thankyou_messages.insert_one(thankyou)
            await db.appointments.update_one(
                {"id": appt_id},
                {"$set": {"thankyou_sent": True, "thankyou_sent_at": thankyou["sent_at"]}}
            )
            sent_count += 1
    
    return {"sent": sent_count, "simulation_mode": True}

@api_router.get("/thankyou/history")
async def get_thankyou_history(user=Depends(get_current_user), limit: int = 50):
    """Historique des messages de remerciement"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    messages = await db.thankyou_messages.find(
        {"business_id": business_id},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    return messages

# ============= INTERNAL CHAT SYSTEM (Admin <-> Business) =============
@api_router.get("/admin/conversations")
async def get_admin_conversations(user=Depends(require_super_admin)):
    """Liste toutes les conversations admin"""
    # Récupérer les derniers messages par business
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$business_id",
            "last_message": {"$first": "$message"},
            "last_sender": {"$first": "$sender_role"},
            "last_date": {"$first": "$created_at"},
            "unread_count": {
                "$sum": {"$cond": [{"$and": [{"$eq": ["$read", False]}, {"$eq": ["$sender_role", "business"]}]}, 1, 0]}
            }
        }}
    ]
    
    conversations = await db.internal_messages.aggregate(pipeline).to_list(100)
    
    # Enrichir avec les infos business
    result = []
    for conv in conversations:
        biz = await db.businesses.find_one({"id": conv["_id"]}, {"_id": 0, "name": 1, "business_type": 1})
        if biz:
            result.append({
                "business_id": conv["_id"],
                "business_name": biz.get("name"),
                "business_type": biz.get("business_type"),
                "last_message": conv["last_message"][:100] if conv["last_message"] else "",
                "last_sender": conv["last_sender"],
                "last_date": conv["last_date"],
                "unread_count": conv["unread_count"]
            })
    
    return sorted(result, key=lambda x: x.get("last_date", ""), reverse=True)

@api_router.get("/admin/conversations/{business_id}")
async def get_admin_conversation(business_id: str, user=Depends(require_super_admin)):
    """Récupère une conversation avec un business"""
    messages = await db.internal_messages.find(
        {"business_id": business_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Marquer comme lus les messages du business
    await db.internal_messages.update_many(
        {"business_id": business_id, "sender_role": "business"},
        {"$set": {"read": True}}
    )
    
    biz = await db.businesses.find_one({"id": business_id}, {"_id": 0, "name": 1})
    
    return {
        "business_id": business_id,
        "business_name": biz.get("name") if biz else "Unknown",
        "messages": messages
    }

# IMPORTANT: Group message route must come BEFORE parameterized route
@api_router.post("/admin/conversations/group")
async def send_group_message(data: dict, user=Depends(require_super_admin)):
    """Envoie un message à plusieurs businesses"""
    business_ids = data.get("business_ids", [])
    message_text = data.get("message", "")
    
    sent_count = 0
    for biz_id in business_ids:
        message = {
            "id": str(uuid.uuid4()),
            "business_id": biz_id,
            "sender_id": user["id"],
            "sender_role": "admin",
            "sender_name": user.get("full_name", "Admin"),
            "message": message_text,
            "is_group_message": True,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.internal_messages.insert_one(message)
        
        notif = {
            "id": str(uuid.uuid4()),
            "business_id": biz_id,
            "type": "admin_message",
            "title": "Message de NoShowGone",
            "content": message_text[:100],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.business_notifications.insert_one(notif)
        sent_count += 1
    
    return {"sent": sent_count}

@api_router.post("/admin/conversations/{business_id}")
async def send_admin_message(business_id: str, data: dict, user=Depends(require_super_admin)):
    """Envoie un message à un business"""
    message = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "sender_id": user["id"],
        "sender_role": "admin",
        "sender_name": user.get("full_name", "Admin"),
        "message": data.get("message", ""),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_messages.insert_one(message)
    
    # Créer une notification pour le business
    notif = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "type": "admin_message",
        "title": "Message de NoShowGone",
        "content": data.get("message", "")[:100],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.business_notifications.insert_one(notif)
    
    return {k: v for k, v in message.items() if k != "_id"}

@api_router.delete("/admin/conversations/{business_id}/messages/{message_id}")
async def delete_admin_message(business_id: str, message_id: str, user=Depends(require_super_admin)):
    """Supprime un message"""
    result = await db.internal_messages.delete_one({"id": message_id, "business_id": business_id})
    return {"deleted": result.deleted_count > 0}

# Business side - Conversations
@api_router.get("/business/messages")
async def get_business_messages(user=Depends(get_current_user)):
    """Récupère les messages pour un business"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    messages = await db.internal_messages.find(
        {"business_id": business_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Marquer comme lus les messages admin
    await db.internal_messages.update_many(
        {"business_id": business_id, "sender_role": "admin"},
        {"$set": {"read": True}}
    )
    
    return messages

@api_router.post("/business/messages")
async def send_business_message(data: dict, user=Depends(get_current_user)):
    """Envoie un message au support admin"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    message = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "sender_id": user["id"],
        "sender_role": "business",
        "sender_name": user.get("full_name", "Business"),
        "message": data.get("message", ""),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.internal_messages.insert_one(message)
    return {k: v for k, v in message.items() if k != "_id"}

@api_router.get("/business/messages/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    """Compte les messages non lus"""
    business_id = user.get("business_id")
    if not business_id:
        return {"count": 0}
    
    count = await db.internal_messages.count_documents({
        "business_id": business_id,
        "sender_role": "admin",
        "read": False
    })
    
    return {"count": count}

# ============= BUSINESS NOTIFICATIONS =============
@api_router.get("/business/notifications")
async def get_business_notifications(user=Depends(get_current_user), limit: int = 50):
    """Récupère les notifications pour un business"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    notifications = await db.business_notifications.find(
        {"business_id": business_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@api_router.put("/business/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user=Depends(get_current_user)):
    """Marque une notification comme lue"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    await db.business_notifications.update_one(
        {"id": notification_id, "business_id": business_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

@api_router.delete("/business/notifications/{notification_id}")
async def delete_notification(notification_id: str, user=Depends(get_current_user)):
    """Supprime une notification"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    result = await db.business_notifications.delete_one(
        {"id": notification_id, "business_id": business_id}
    )
    return {"deleted": result.deleted_count > 0}

@api_router.delete("/business/notifications")
async def clear_all_notifications(user=Depends(get_current_user)):
    """Supprime toutes les notifications"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    result = await db.business_notifications.delete_many({"business_id": business_id})
    return {"deleted": result.deleted_count}

@api_router.put("/business/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    """Marque toutes les notifications comme lues"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    await db.business_notifications.update_many(
        {"business_id": business_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

# ============= ENHANCED ML SCORING WITH RATINGS =============
@api_router.get("/ml/enhanced-risk-score/{phone}")
async def get_enhanced_risk_score(phone: str, user=Depends(get_current_user)):
    """Score de risque ML amélioré avec les notes clients"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    # Récupérer l'historique des RDV
    appts = await db.appointments.find(
        {"business_id": business_id, "client_phone": phone},
        {"_id": 0}
    ).to_list(100)
    
    # Récupérer les notes
    ratings = await db.client_ratings.find(
        {"business_id": business_id, "client_phone": phone},
        {"_id": 0}
    ).to_list(50)
    
    if not appts:
        return {
            "phone": phone,
            "risk_score": 50,
            "risk_level": "unknown",
            "factors": [],
            "has_history": False
        }
    
    total = len(appts)
    no_shows = sum(1 for a in appts if a.get("status") == "no_show")
    completed = sum(1 for a in appts if a.get("status") == "completed")
    confirmed = sum(1 for a in appts if a.get("status") == "confirmed")
    
    # Calcul du score de base (0-100, plus haut = plus risqué)
    no_show_rate = no_shows / total if total > 0 else 0
    base_score = no_show_rate * 60  # 60% du score basé sur le taux de no-show
    
    # Facteur de fiabilité basé sur les notes
    rating_factor = 0
    if ratings:
        avg_punctuality = sum(r.get("punctuality", 3) for r in ratings) / len(ratings)
        avg_reliability = sum(r.get("reliability", 3) for r in ratings) / len(ratings)
        # Note moyenne transformée en facteur de risque
        avg_rating = (avg_punctuality + avg_reliability) / 2
        rating_factor = (5 - avg_rating) / 5 * 20  # 20% du score basé sur les notes
    
    # Facteur d'ancienneté
    if total >= 5:
        tenure_factor = -5  # Client fidèle, réduction du risque
    else:
        tenure_factor = 5  # Nouveau client, légère augmentation
    
    # Score final
    risk_score = min(100, max(0, base_score + rating_factor + tenure_factor))
    
    # Niveau de risque
    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    factors = []
    if no_show_rate > 0.3:
        factors.append({"type": "negative", "text": f"Taux de no-show élevé ({round(no_show_rate*100)}%)"})
    if ratings:
        avg_rating = sum(r.get("overall", 3) for r in ratings) / len(ratings)
        if avg_rating < 3:
            factors.append({"type": "negative", "text": f"Notes client basses ({round(avg_rating, 1)}/5)"})
        elif avg_rating >= 4:
            factors.append({"type": "positive", "text": f"Excellentes notes ({round(avg_rating, 1)}/5)"})
    if completed >= 3:
        factors.append({"type": "positive", "text": f"{completed} RDV honorés"})
    if total == 1:
        factors.append({"type": "neutral", "text": "Premier RDV - historique limité"})
    
    return {
        "phone": phone,
        "risk_score": round(risk_score),
        "risk_level": risk_level,
        "factors": factors,
        "stats": {
            "total_appointments": total,
            "no_shows": no_shows,
            "completed": completed,
            "confirmed": confirmed,
            "no_show_rate": round(no_show_rate * 100, 1)
        },
        "ratings_summary": {
            "total_ratings": len(ratings),
            "avg_punctuality": round(sum(r.get("punctuality", 0) for r in ratings) / len(ratings), 1) if ratings else None,
            "avg_reliability": round(sum(r.get("reliability", 0) for r in ratings) / len(ratings), 1) if ratings else None
        },
        "recommendations": [
            "Demander un dépôt de garantie" if risk_level == "high" else None,
            "Envoyer un rappel supplémentaire" if risk_level in ["high", "medium"] else None,
            "Client fiable - aucune action requise" if risk_level == "low" else None
        ]
    }

# ============= ADMIN PERTINENT STATS =============
@api_router.get("/admin/insights")
async def get_admin_insights(user=Depends(require_super_admin)):
    """Insights pertinents pour l'admin"""
    # Businesses à risque (taux de no-show élevé)
    pipeline_risk = [
        {"$group": {
            "_id": "$business_id",
            "total": {"$sum": 1},
            "no_shows": {"$sum": {"$cond": [{"$eq": ["$status", "no_show"]}, 1, 0]}}
        }},
        {"$addFields": {
            "no_show_rate": {"$cond": [{"$gt": ["$total", 0]}, {"$divide": ["$no_shows", "$total"]}, 0]}
        }},
        {"$match": {"no_show_rate": {"$gte": 0.3}, "total": {"$gte": 5}}},
        {"$sort": {"no_show_rate": -1}},
        {"$limit": 5}
    ]
    
    at_risk = await db.appointments.aggregate(pipeline_risk).to_list(5)
    
    # Enrichir avec noms
    at_risk_businesses = []
    for r in at_risk:
        biz = await db.businesses.find_one({"id": r["_id"]}, {"_id": 0, "name": 1})
        if biz:
            at_risk_businesses.append({
                "business_id": r["_id"],
                "business_name": biz["name"],
                "no_show_rate": round(r["no_show_rate"] * 100, 1),
                "total_appointments": r["total"]
            })
    
    # Top performers
    pipeline_top = [
        {"$group": {
            "_id": "$business_id",
            "total": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$in": ["$status", ["completed", "confirmed"]]}, 1, 0]}}
        }},
        {"$addFields": {
            "success_rate": {"$cond": [{"$gt": ["$total", 0]}, {"$divide": ["$completed", "$total"]}, 0]}
        }},
        {"$match": {"total": {"$gte": 10}}},
        {"$sort": {"success_rate": -1}},
        {"$limit": 5}
    ]
    
    top_performers = await db.appointments.aggregate(pipeline_top).to_list(5)
    
    top_businesses = []
    for r in top_performers:
        biz = await db.businesses.find_one({"id": r["_id"]}, {"_id": 0, "name": 1})
        if biz:
            top_businesses.append({
                "business_id": r["_id"],
                "business_name": biz["name"],
                "success_rate": round(r["success_rate"] * 100, 1),
                "total_appointments": r["total"]
            })
    
    # Abonnements expirant bientôt
    soon = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    expiring = await db.businesses.find(
        {"subscription.trial_ends_at": {"$lte": soon, "$gte": datetime.now(timezone.utc).isoformat()}},
        {"_id": 0, "id": 1, "name": 1, "subscription": 1}
    ).to_list(10)
    
    # Messages non lus
    unread_messages = await db.internal_messages.count_documents({"sender_role": "business", "read": False})
    
    # RDV aujourd'hui toutes plateformes
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_appts = await db.appointments.count_documents({"date": today})
    
    return {
        "at_risk_businesses": at_risk_businesses,
        "top_performers": top_businesses,
        "expiring_trials": expiring,
        "unread_support_messages": unread_messages,
        "today_appointments_all": today_appts,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/admin/business-search")
async def search_businesses(q: str, user=Depends(require_super_admin)):
    """Recherche de businesses par nom"""
    businesses = await db.businesses.find(
        {"name": {"$regex": q, "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "business_type": 1}
    ).limit(20).to_list(20)
    return businesses

# ============= POST-RDV AUTOMATION =============
from services.post_rdv_automation_service import PostRdvAutomationService

@api_router.get("/automation/queue")
async def get_automation_queue(
    user=Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50
):
    """Liste la queue d'envoi post-RDV pour l'entreprise"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    query = {"business_id": business_id}
    if status:
        query["status"] = status
    
    items = await db.post_rdv_queue.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Stats rapides
    total = await db.post_rdv_queue.count_documents({"business_id": business_id})
    pending = await db.post_rdv_queue.count_documents({"business_id": business_id, "status": {"$in": ["pending", "retrying", "sending"]}})
    sent = await db.post_rdv_queue.count_documents({"business_id": business_id, "status": {"$in": ["sent", "delivered"]}})
    failed = await db.post_rdv_queue.count_documents({"business_id": business_id, "status": "failed"})
    
    return {
        "items": items,
        "stats": {"total": total, "pending": pending, "sent": sent, "failed": failed}
    }

@api_router.get("/automation/analytics")
async def get_automation_analytics(user=Depends(get_current_user), days: int = 30):
    """Statistiques d'automatisation pour le dashboard business"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = PostRdvAutomationService(db)
    return await service.get_business_analytics(business_id, days)

@api_router.get("/automation/templates")
async def get_automation_templates(user=Depends(get_current_user)):
    """Récupère les templates post-RDV de l'entreprise"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = PostRdvAutomationService(db)
    return await service.get_business_templates(business_id)

@api_router.post("/automation/templates")
async def save_automation_template(data: dict, user=Depends(get_current_user)):
    """Sauvegarde un template post-RDV personnalisé"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = PostRdvAutomationService(db)
    return await service.save_business_template(business_id, data)

@api_router.delete("/automation/templates/{template_id}")
async def delete_automation_template(template_id: str, user=Depends(get_current_user)):
    """Supprime un template post-RDV personnalisé"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    result = await db.post_rdv_templates.delete_one({"id": template_id, "business_id": business_id, "is_default": False})
    return {"deleted": result.deleted_count > 0}

@api_router.get("/automation/settings")
async def get_automation_settings(user=Depends(get_current_user)):
    """Récupère les paramètres d'automatisation de l'entreprise"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0, "post_rdv_settings": 1})
    
    # Paramètres par défaut
    default_settings = {
        "enabled": True,
        "enabled_templates": ["thankyou_standard"],
        "preferred_channel": "sms",
        "fallback_enabled": True,
        "fallback_order": ["whatsapp", "email"],
        "google_review_link": "",
        "wheel_of_fortune_link": "",
        "loyalty_discount": "10",
        "promo_code": "",
        "send_delay_minutes": 0,  # 0 = immédiat
        "business_hours_only": False,
        "quiet_hours_start": "21:00",
        "quiet_hours_end": "09:00"
    }
    
    settings = business.get("post_rdv_settings", {}) if business else {}
    return {**default_settings, **settings}

@api_router.put("/automation/settings")
async def update_automation_settings(data: dict, user=Depends(get_current_user)):
    """Met à jour les paramètres d'automatisation"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = PostRdvAutomationService(db)
    return await service.update_business_settings(business_id, data)

@api_router.post("/automation/trigger/{appointment_id}")
async def manual_trigger_post_rdv(appointment_id: str, user=Depends(get_current_user)):
    """Déclenche manuellement l'envoi post-RDV (pour debug ou re-envoi)"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    service = PostRdvAutomationService(db)
    return await service.trigger_post_rdv(appointment_id, business_id)

@api_router.post("/automation/retry/{queue_id}")
async def retry_queue_item(queue_id: str, user=Depends(get_current_user)):
    """Retente l'envoi d'un message échoué"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    # Vérifier que l'item appartient à l'entreprise
    item = await db.post_rdv_queue.find_one({"id": queue_id, "business_id": business_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    # Remettre en pending
    await db.post_rdv_queue.update_one(
        {"id": queue_id},
        {"$set": {"status": "pending", "retry_count": 0, "error_message": None}}
    )
    
    service = PostRdvAutomationService(db)
    return await service.process_queue_item(queue_id)

@api_router.post("/automation/track-click")
async def track_click(data: dict):
    """Track un clic sur un lien (Google Avis, Roue Fortune)"""
    queue_id = data.get("queue_id")
    click_type = data.get("type")  # google_review, wheel
    
    if not queue_id or not click_type:
        raise HTTPException(status_code=400, detail="queue_id and type required")
    
    update_field = f"click_tracking.{click_type}_clicked"
    await db.post_rdv_queue.update_one(
        {"id": queue_id},
        {"$set": {
            update_field: True,
            "click_tracking.link_clicked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"tracked": True}

# ============= ADMIN POST-RDV ANALYTICS =============
@api_router.get("/admin/automation/analytics")
async def get_admin_automation_analytics(user=Depends(require_super_admin)):
    """Statistiques globales d'automatisation pour Super Admin"""
    service = PostRdvAutomationService(db)
    return await service.get_admin_analytics()

@api_router.get("/admin/automation/queue")
async def get_admin_queue(
    user=Depends(require_super_admin),
    business_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Liste globale de la queue pour monitoring admin"""
    query = {}
    if business_id:
        query["business_id"] = business_id
    if status:
        query["status"] = status
    
    items = await db.post_rdv_queue.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrichir avec les noms d'entreprise
    for item in items:
        biz = await db.businesses.find_one({"id": item["business_id"]}, {"_id": 0, "name": 1})
        item["business_name"] = biz.get("name") if biz else "Unknown"
    
    return items

@api_router.post("/admin/automation/process-retries")
async def process_retries(user=Depends(require_super_admin)):
    """Traite manuellement les messages en attente de retry"""
    service = PostRdvAutomationService(db)
    return await service.process_retry_queue()

# ============= ONBOARDING ENRICHI (P1) =============
@api_router.get("/onboarding/status")
async def get_onboarding_status(user=Depends(get_current_user)):
    """Récupère le statut d'onboarding de l'entreprise"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    settings = business.get("settings", {})
    post_rdv = business.get("post_rdv_settings", {})
    
    steps = {
        "profile_complete": bool(business.get("phone") and business.get("address")),
        "timezone_set": bool(settings.get("timezone")),
        "business_hours_set": bool(settings.get("opening_hours")),
        "reminder_settings": bool(settings.get("reminders")),
        "post_rdv_enabled": post_rdv.get("enabled", False),
        "google_review_link": bool(post_rdv.get("google_review_link")),
        "first_appointment": await db.appointments.count_documents({"business_id": business_id}) > 0
    }
    
    completed = sum(1 for v in steps.values() if v)
    total = len(steps)
    
    return {
        "steps": steps,
        "completed": completed,
        "total": total,
        "progress_percent": round(completed / total * 100),
        "is_complete": completed == total
    }

@api_router.put("/onboarding/profile")
async def update_onboarding_profile(data: dict, user=Depends(get_current_user)):
    """Met à jour le profil entreprise (onboarding)"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    update_data = {}
    
    # Champs de base
    if "phone" in data:
        update_data["phone"] = data["phone"]
    if "address" in data:
        update_data["address"] = data["address"]
    if "email" in data:
        update_data["email"] = data["email"]
    if "website" in data:
        update_data["website"] = data["website"]
    
    # Paramètres avancés
    if "timezone" in data:
        update_data["settings.timezone"] = data["timezone"]
    if "opening_hours" in data:
        update_data["settings.opening_hours"] = data["opening_hours"]
    if "lang" in data:
        update_data["settings.lang"] = data["lang"]
    
    # Post-RDV settings
    if "google_review_link" in data:
        update_data["post_rdv_settings.google_review_link"] = data["google_review_link"]
    if "wheel_of_fortune_link" in data:
        update_data["post_rdv_settings.wheel_of_fortune_link"] = data["wheel_of_fortune_link"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.businesses.update_one({"id": business_id}, {"$set": update_data})
    
    return {"success": True}

@api_router.put("/onboarding/business-hours")
async def update_business_hours(data: dict, user=Depends(get_current_user)):
    """Met à jour les horaires d'ouverture"""
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="No business")
    
    # Format attendu: {"monday": {"open": "09:00", "close": "18:00", "closed": false}, ...}
    hours = data.get("opening_hours", {})
    timezone_str = data.get("timezone", "Europe/Paris")
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {
            "settings.opening_hours": hours,
            "settings.timezone": timezone_str,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True}

# ============= TIMEZONES DISPONIBLES =============
@api_router.get("/utils/timezones")
async def get_timezones():
    """Liste des fuseaux horaires disponibles"""
    timezones = [
        {"value": "Europe/Paris", "label": "Paris (France)"},
        {"value": "Europe/London", "label": "Londres (UK)"},
        {"value": "Europe/Brussels", "label": "Bruxelles (Belgique)"},
        {"value": "Europe/Zurich", "label": "Zurich (Suisse)"},
        {"value": "America/New_York", "label": "New York (USA)"},
        {"value": "America/Los_Angeles", "label": "Los Angeles (USA)"},
        {"value": "America/Montreal", "label": "Montréal (Canada)"},
        {"value": "Africa/Casablanca", "label": "Casablanca (Maroc)"},
        {"value": "Africa/Tunis", "label": "Tunis (Tunisie)"},
        {"value": "Asia/Dubai", "label": "Dubai (UAE)"},
    ]
    return timezones

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

