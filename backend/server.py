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
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.appointments.update_one(query, {"$set": update_data})
    
    appt = await db.appointments.find_one(query, {"_id": 0})
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

@api_router.get("/admin/plans")
async def get_admin_plans(user=Depends(require_super_admin)):
    plans = await db.plans_config.find({}, {"_id": 0}).to_list(10)
    if not plans:
        # Return defaults
        return [
            {"id": "free_trial", "name": "Essai Gratuit", "price": 0, "appointments_per_month": 30, "staff_members": 1, "sms_notifications": 10, "features": ["Email reminders", "Basic dashboard"], "is_active": True, "trial_days": 14},
            {"id": "solo", "name": "Solo", "price": 29, "appointments_per_month": 100, "staff_members": 1, "sms_notifications": 50, "features": ["All free features", "WhatsApp reminders", "Analytics"], "is_active": True, "trial_days": 0},
            {"id": "pro", "name": "Pro", "price": 59, "appointments_per_month": 500, "staff_members": 5, "sms_notifications": 200, "features": ["All Solo features", "SMS", "Deposit collection", "Risk score"], "is_active": True, "trial_days": 0},
            {"id": "business", "name": "Business", "price": 99, "appointments_per_month": -1, "staff_members": -1, "sms_notifications": -1, "features": ["Everything unlimited", "Priority support", "API access", "White label"], "is_active": True, "trial_days": 0},
        ]
    return plans

@api_router.put("/admin/plans/{plan_id}")
async def update_plan(plan_id: str, data: dict, user=Depends(require_super_admin)):
    existing = await db.plans_config.find_one({"id": plan_id})
    if existing:
        await db.plans_config.update_one({"id": plan_id}, {"$set": data})
    else:
        data["id"] = plan_id
        await db.plans_config.insert_one(data)
    updated = await db.plans_config.find_one({"id": plan_id}, {"_id": 0})
    return updated or data

@api_router.post("/admin/plans")
async def create_plan(data: dict, user=Depends(require_super_admin)):
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.plans_config.insert_one(data)
    return {k: v for k, v in data.items() if k != "_id"}

@api_router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, user=Depends(require_super_admin)):
    await db.plans_config.delete_one({"id": plan_id})
    return {"message": "Plan deleted"}

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

