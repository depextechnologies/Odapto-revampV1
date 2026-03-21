from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import secrets
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx
import json
from urllib.parse import urlencode

# Import email service
from services.email_service import (
    send_workspace_invitation_email,
    send_board_invitation_email,
    send_card_invitation_email
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)

# Database selection — single production database, no mixing:
# 1. Primary: extract database name from MONGO_URL path (e.g. task-sync-hub-16-test_database)
# 2. Fallback: use DB_NAME env var (local dev only)
try:
    db = client.get_default_database()
except Exception:
    db = client[os.environ.get('DB_NAME', 'test_database')]

logging.info(f"MongoDB database selected: {db.name}")
# File storage directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Odapto API", version="1.0.0")

# CORS middleware - allow all origins, no credentials needed (frontend uses Bearer tokens)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserRole:
    ADMIN = "admin"
    PRIVILEGED = "privileged"
    NORMAL = "normal"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = UserRole.NORMAL
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None

class Workspace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    workspace_id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    members: List[Dict[str, str]] = []  # [{user_id, role}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class Board(BaseModel):
    model_config = ConfigDict(extra="ignore")
    board_id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    background: Optional[str] = "#3A8B84"  # Can be color hex or image URL
    background_type: str = "color"  # "color" or "image"
    members: List[Dict[str, str]] = []  # [{user_id, role, joined_at}] - board-specific members
    is_template: bool = False
    template_name: Optional[str] = None
    template_description: Optional[str] = None
    template_category_id: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    background: Optional[str] = "#3A8B84"
    background_type: str = "color"

class BoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background: Optional[str] = None
    background_type: Optional[str] = None

# Notification model
class Notification(BaseModel):
    notification_id: str
    user_id: str  # recipient
    type: str  # "board_invite", "comment", "card_update", "due_date", etc.
    title: str
    message: str
    board_id: Optional[str] = None
    card_id: Optional[str] = None
    from_user_id: Optional[str] = None
    from_user_name: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BoardInviteRequest(BaseModel):
    email: str
    role: str = "member"  # "member" or "viewer"

class BoardList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    list_id: str
    board_id: str
    name: str
    position: int
    wip_limit: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ListCreate(BaseModel):
    name: str
    position: Optional[int] = None
    wip_limit: Optional[int] = None

class ListUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None
    wip_limit: Optional[int] = None

class ChecklistItem(BaseModel):
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    text: str
    completed: bool = False

class Comment(BaseModel):
    comment_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    user_id: str
    user_name: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardLabel(BaseModel):
    color: str  # hex color or color name
    name: Optional[str] = None  # optional label name

class CardMember(BaseModel):
    user_id: str
    name: str
    email: str
    picture: Optional[str] = None

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    card_id: str
    list_id: str
    board_id: str
    title: str
    description: Optional[str] = None
    position: int
    due_date: Optional[datetime] = None
    labels: List[Dict[str, str]] = []  # [{color, name}] - named labels
    priority: Optional[str] = None  # low, medium, high, urgent
    assigned_members: List[Dict[str, str]] = []  # [{user_id, name, email, picture}]
    attachments: List[Dict[str, str]] = []  # [{filename, url, uploaded_at}]
    checklist: List[ChecklistItem] = []
    comments: List[Comment] = []
    cover_image: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    position: Optional[int] = None
    due_date: Optional[datetime] = None
    labels: List[Dict[str, str]] = []
    priority: Optional[str] = None
    assigned_members: List[str] = []

class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None
    list_id: Optional[str] = None
    due_date: Optional[datetime] = None
    labels: Optional[List[Dict[str, str]]] = None
    priority: Optional[str] = None
    assigned_members: Optional[List[Dict[str, str]]] = None
    cover_image: Optional[str] = None

class CardInviteRequest(BaseModel):
    email: str

class TemplateCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemplateCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class PublishTemplateRequest(BaseModel):
    template_name: str
    template_description: Optional[str] = None
    category_id: str

class CommentCreate(BaseModel):
    content: str

class ChecklistItemCreate(BaseModel):
    text: str

# Team model
class Team(BaseModel):
    team_id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    workspace_id: str
    members: List[Dict[str, str]] = []  # [{user_id, role}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TeamMemberRequest(BaseModel):
    user_id: str
    role: str = "member"

# Card Activity Log model
class CardActivity(BaseModel):
    activity_id: str
    card_id: str
    board_id: str
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    action: str  # created, updated_title, updated_description, added_label, removed_label, 
                 # set_due_date, removed_due_date, set_priority, added_member, removed_member,
                 # added_checklist_item, completed_checklist_item, added_comment, added_attachment,
                 # moved, deleted
    details: Optional[Dict[str, Any]] = None  # Additional context like old/new values
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Pending Invite model for non-registered users
class PendingInvite(BaseModel):
    invite_id: str
    email: str
    invite_type: str  # "card" or "board"
    target_id: str  # card_id or board_id
    board_id: str
    invited_by: str
    invited_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Email Invitation Token model
class InvitationToken(BaseModel):
    token: str
    email: str
    invitation_type: str  # "workspace", "board", or "card"
    target_id: str  # workspace_id, board_id, or card_id
    role: Optional[str] = None  # For workspace/board invites
    invited_by: str
    invited_by_name: str
    target_name: str  # Name of workspace/board/card
    board_id: Optional[str] = None  # For card invites
    used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))

# Email send log model
class EmailLog(BaseModel):
    log_id: str
    to_email: str
    subject: str
    email_type: str  # "workspace_invite", "board_invite", "card_invite"
    success: bool
    error: Optional[str] = None
    invitation_token: Optional[str] = None
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Invitation accept request
class AcceptInvitationRequest(BaseModel):
    token: str

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    if not hashed or len(hashed) < 20:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False

async def get_current_user(request: Request) -> User:
    # Get session token from Authorization header
    auth_header = request.headers.get("Authorization")
    session_token = None
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_privileged(user: User = Depends(get_current_user)) -> User:
    if user.role not in [UserRole.ADMIN, UserRole.PRIVILEGED]:
        raise HTTPException(status_code=403, detail="Privileged access required")
    return user

# Card Activity Logger Helper
async def log_card_activity(
    card_id: str,
    board_id: str,
    user: User,
    action: str,
    details: Optional[Dict[str, Any]] = None,
    notify_members: bool = True
):
    """Log a card activity, broadcast via WebSocket, and optionally notify all board members"""
    activity = {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "card_id": card_id,
        "board_id": board_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_picture": user.picture,
        "action": action,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.card_activities.insert_one(activity)
    
    # Broadcast the activity via WebSocket
    await manager.broadcast(board_id, {
        "type": "card_activity",
        "activity": {k: v for k, v in activity.items() if k != "_id"}
    })
    
    # Create notifications for all board members (except the actor)
    if notify_members:
        board = await db.boards.find_one({"board_id": board_id}, {"_id": 0, "members": 1, "name": 1})
        if board:
            card = await db.cards.find_one({"card_id": card_id}, {"_id": 0, "title": 1})
            card_title = card["title"] if card else "a card"
            
            action_messages = {
                "added_attachment": f"added an attachment to '{card_title}'",
                "deleted_attachment": f"removed an attachment from '{card_title}'",
                "set_cover": f"set cover image on '{card_title}'",
                "added_checklist_item": f"added a checklist item on '{card_title}'",
                "toggled_checklist_item": f"updated checklist on '{card_title}'",
                "deleted_checklist_item": f"removed a checklist item from '{card_title}'",
                "updated": f"updated '{card_title}'",
                "created": f"created card '{card_title}'",
                "moved": f"moved '{card_title}'",
                "deleted": f"deleted '{card_title}'",
                "member_added": f"added a member to '{card_title}'",
            }
            message = action_messages.get(action, f"performed '{action}' on '{card_title}'")
            
            for member in board.get("members", []):
                member_id = member.get("user_id")
                if member_id and member_id != user.user_id:
                    notif = {
                        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                        "user_id": member_id,
                        "type": "board_activity",
                        "title": f"Activity on {board['name']}",
                        "message": f"{user.name} {message}",
                        "board_id": board_id,
                        "card_id": card_id,
                        "from_user_id": user.user_id,
                        "from_user_name": user.name,
                        "read": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.notifications.insert_one(notif)
    
    return activity

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    logger.info(f"[REGISTER] Attempt for email: {data.email}")
    try:
        existing = await db.users.find_one({"email": data.email}, {"_id": 0})
        if existing:
            logger.warning(f"[REGISTER] Email already exists: {data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        hashed_pw = hash_password(data.password)
        
        user_count = await db.users.count_documents({})
        role = UserRole.ADMIN if user_count == 0 else UserRole.NORMAL
        logger.info(f"[REGISTER] Creating user {user_id}, role={role}, db={db.name}")
        
        user_doc = {
            "user_id": user_id,
            "email": data.email,
            "name": data.name,
            "password_hash": hashed_pw,
            "role": role,
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        logger.info(f"[REGISTER] User inserted into DB: {user_id}")
        
        session_token = f"sess_{uuid.uuid4().hex}"
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        logger.info(f"[REGISTER] Session created for {user_id}")
        
        # Process pending invites for this email
        pending_invites = await db.pending_invites.find({"email": data.email}).to_list(100)
        for invite in pending_invites:
            if invite["invite_type"] == "card":
                new_member = {
                    "user_id": user_id,
                    "name": data.name,
                    "email": data.email,
                    "picture": None
                }
                await db.cards.update_one(
                    {"card_id": invite["target_id"]},
                    {"$push": {"assigned_members": new_member}}
                )
                notif_doc = {
                    "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                    "user_id": user_id,
                    "type": "card_assignment",
                    "title": "You've been added to a card",
                    "message": f"{invite['invited_by_name']} added you to '{invite.get('card_title', 'a card')}'",
                    "board_id": invite["board_id"],
                    "card_id": invite["target_id"],
                    "from_user_id": invite["invited_by"],
                    "from_user_name": invite["invited_by_name"],
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notif_doc)
        
        if pending_invites:
            await db.pending_invites.delete_many({"email": data.email})
        
        logger.info(f"[REGISTER] SUCCESS for {data.email}")
        return {"user_id": user_id, "email": data.email, "name": data.name, "role": role, "session_token": session_token}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[REGISTER] FAILED for {data.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@api_router.post("/auth/login")
async def login(data: UserLogin):
    logger.info(f"[LOGIN] Attempt for email: {data.email}, db={db.name}")
    try:
        user = await db.users.find_one({"email": data.email}, {"_id": 0})
        if not user:
            logger.warning(f"[LOGIN] User not found: {data.email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not verify_password(data.password, user.get("password_hash", "")):
            logger.warning(f"[LOGIN] Wrong password for: {data.email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        session_token = f"sess_{uuid.uuid4().hex}"
        session_doc = {
            "user_id": user["user_id"],
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        logger.info(f"[LOGIN] SUCCESS for {data.email}, user_id={user['user_id']}")
        
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", UserRole.NORMAL),
            "picture": user.get("picture"),
            "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] FAILED for {data.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

# ============== GOOGLE OAUTH ==============
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

@api_router.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth flow - redirects user to Google sign-in"""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        logger.error("[GOOGLE_OAUTH] GOOGLE_CLIENT_ID not set")
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    frontend_url = os.environ.get("FRONTEND_URL", str(request.base_url).rstrip("/"))
    redirect_uri = f"{frontend_url}/auth/google/callback"
    logger.info(f"[GOOGLE_OAUTH] Init: redirect_uri={redirect_uri}, frontend_url={frontend_url}")
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": secrets.token_urlsafe(16)
    }
    google_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=google_url)

@api_router.post("/auth/google/callback")
async def google_callback(request: Request):
    """Exchange Google auth code for user info and create session"""
    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    logger.info(f"[GOOGLE_CALLBACK] Received code={'yes' if code else 'no'}, redirect_uri={redirect_uri}, db={db.name}")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code required")
    
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        logger.error("[GOOGLE_CALLBACK] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    try:
        async with httpx.AsyncClient() as http_client:
            token_resp = await http_client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            })
            
            logger.info(f"[GOOGLE_CALLBACK] Token exchange status: {token_resp.status_code}")
            if token_resp.status_code != 200:
                logger.error(f"[GOOGLE_CALLBACK] Token exchange failed: {token_resp.text}")
                raise HTTPException(status_code=401, detail="Failed to exchange authorization code")
            
            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            
            if not access_token:
                logger.error("[GOOGLE_CALLBACK] No access_token in response")
                raise HTTPException(status_code=401, detail="No access token received")
            
            user_resp = await http_client.get(GOOGLE_USERINFO_URL, headers={
                "Authorization": f"Bearer {access_token}"
            })
            
            logger.info(f"[GOOGLE_CALLBACK] Userinfo status: {user_resp.status_code}")
            if user_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to get user info")
            
            google_user = user_resp.json()
        
        email = google_user.get("email")
        name = google_user.get("name", email.split("@")[0])
        picture = google_user.get("picture")
        logger.info(f"[GOOGLE_CALLBACK] Google user: {email}")
        
        if not email:
            raise HTTPException(status_code=401, detail="No email in Google response")
        
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
            role = existing_user.get("role", UserRole.NORMAL)
            logger.info(f"[GOOGLE_CALLBACK] Existing user: {user_id}")
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_count = await db.users.count_documents({})
            role = UserRole.ADMIN if user_count == 0 else UserRole.NORMAL
            
            user_doc = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": role,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
            logger.info(f"[GOOGLE_CALLBACK] New user created: {user_id}")
        
        session_token = f"sess_{uuid.uuid4().hex}"
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        logger.info(f"[GOOGLE_CALLBACK] SUCCESS for {email}")
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": role,
            "picture": picture,
            "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GOOGLE_CALLBACK] FAILED: {e}")
        raise HTTPException(status_code=500, detail=f"Google sign-in failed: {str(e)}")

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "picture": user.picture
    }

@api_router.post("/auth/profile-photo")
async def upload_profile_photo(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    # Validate file size (2MB limit)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 2MB limit")
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Create uploads directory if needed
    profile_dir = UPLOAD_DIR / "profiles"
    profile_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{user.user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = profile_dir / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Generate URL
    photo_url = f"/api/uploads/profiles/{filename}"
    
    # Update user in database
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"picture": photo_url}}
    )
    
    return {"picture": photo_url}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, user: User = Depends(get_current_user)):
    # Get user with password hash
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has a password (not OAuth-only)
    if not user_doc.get("password_hash"):
        raise HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")
    
    # Verify current password
    if not verify_password(data.current_password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.insert_one({
        "token": reset_token,
        "user_id": user["user_id"],
        "email": data.email,
        "expires_at": expires_at.isoformat(),
        "used": False
    })
    
    # Send email with reset link
    reset_link = f"{os.environ.get('FRONTEND_URL', 'https://odapto.com')}/reset-password?token={reset_token}"
    
    try:
        from services.email_service import send_password_reset_email
        await send_password_reset_email(data.email, user.get("name", "User"), reset_link)
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
    
    return {"message": "If the email exists, a reset link has been sent"}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    # Find valid token
    reset_doc = await db.password_resets.find_one({
        "token": data.token,
        "used": False
    })
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    
    # Check expiration
    expires_at = datetime.fromisoformat(reset_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset link has expired")
    
    # Validate new password
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"user_id": reset_doc["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": data.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

@api_router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    session_token = None
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header.split(" ")[1]
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    return {"message": "Logged out"}

# ============== USER MANAGEMENT (ADMIN) ==============

@api_router.get("/admin/users")
async def get_all_users(admin: User = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.patch("/admin/users/{user_id}")
async def update_user_role(user_id: str, data: UserUpdate, admin: User = Depends(require_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin)):
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"message": "User deleted"}

# ============== INVITATION TOKEN ROUTES ==============

@api_router.get("/invitations/{token}")
async def get_invitation_details(token: str):
    """Get invitation details by token - public endpoint for invite accept page"""
    invitation = await db.invitation_tokens.find_one({"token": token}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation link")
    
    # Check if expired
    expires_at = datetime.fromisoformat(invitation["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This invitation has expired")
    
    # Check if already used
    if invitation.get("used"):
        raise HTTPException(status_code=410, detail="This invitation has already been used")
    
    return {
        "invitation_type": invitation["invitation_type"],
        "target_name": invitation["target_name"],
        "invited_by_name": invitation["invited_by_name"],
        "role": invitation.get("role"),
        "email": invitation["email"],
        "expires_at": invitation["expires_at"]
    }

@api_router.post("/invitations/{token}/accept")
async def accept_invitation(token: str, user: User = Depends(get_current_user)):
    """Accept an invitation - requires authentication"""
    invitation = await db.invitation_tokens.find_one({"token": token}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation link")
    
    # Check if expired
    expires_at = datetime.fromisoformat(invitation["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This invitation has expired")
    
    # Check if already used
    if invitation.get("used"):
        raise HTTPException(status_code=410, detail="This invitation has already been used")
    
    # Verify email matches (optional, allows anyone to accept if logged in)
    # For strict enforcement, uncomment the following:
    # if invitation["email"].lower() != user.email.lower():
    #     raise HTTPException(status_code=403, detail="This invitation was sent to a different email")
    
    result = {"message": "Invitation accepted", "redirect": "/dashboard"}
    
    if invitation["invitation_type"] == "workspace":
        # Add user to workspace
        workspace = await db.workspaces.find_one({"workspace_id": invitation["target_id"]}, {"_id": 0})
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace no longer exists")
        
        # Check if already member
        if not any(m["user_id"] == user.user_id for m in workspace.get("members", [])):
            await db.workspaces.update_one(
                {"workspace_id": invitation["target_id"]},
                {"$push": {"members": {"user_id": user.user_id, "role": invitation.get("role", "member")}}}
            )
        
        result["redirect"] = f"/workspace/{invitation['target_id']}"
        result["workspace_id"] = invitation["target_id"]
        result["workspace_name"] = invitation["target_name"]
        
    elif invitation["invitation_type"] == "board":
        # Add user to board
        board = await db.boards.find_one({"board_id": invitation["target_id"]}, {"_id": 0})
        if not board:
            raise HTTPException(status_code=404, detail="Board no longer exists")
        
        # Check if already member
        if not any(m["user_id"] == user.user_id for m in board.get("members", [])):
            new_member = {
                "user_id": user.user_id,
                "role": invitation.get("role", "member"),
                "joined_at": datetime.now(timezone.utc).isoformat()
            }
            await db.boards.update_one(
                {"board_id": invitation["target_id"]},
                {"$push": {"members": new_member}}
            )
            
            # Also add to workspace if not already member
            workspace = await db.workspaces.find_one({"workspace_id": board["workspace_id"]}, {"_id": 0})
            if workspace and not any(m["user_id"] == user.user_id for m in workspace.get("members", [])):
                await db.workspaces.update_one(
                    {"workspace_id": board["workspace_id"]},
                    {"$push": {"members": {"user_id": user.user_id, "role": "member"}}}
                )
        
        result["redirect"] = f"/board/{invitation['target_id']}"
        result["board_id"] = invitation["target_id"]
        result["board_name"] = invitation["target_name"]
        
    elif invitation["invitation_type"] == "card":
        # Add user to card
        card = await db.cards.find_one({"card_id": invitation["target_id"]}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card no longer exists")
        
        # Check if already assigned
        if not any(m["user_id"] == user.user_id for m in card.get("assigned_members", [])):
            new_member = {
                "user_id": user.user_id,
                "name": user.name,
                "email": user.email,
                "picture": user.picture
            }
            await db.cards.update_one(
                {"card_id": invitation["target_id"]},
                {"$push": {"assigned_members": new_member}}
            )
            
            # Also add to board and workspace if not already member
            board = await db.boards.find_one({"board_id": invitation["board_id"]}, {"_id": 0})
            if board:
                if not any(m["user_id"] == user.user_id for m in board.get("members", [])):
                    await db.boards.update_one(
                        {"board_id": invitation["board_id"]},
                        {"$push": {"members": {"user_id": user.user_id, "role": "member", "joined_at": datetime.now(timezone.utc).isoformat()}}}
                    )
                
                workspace = await db.workspaces.find_one({"workspace_id": board["workspace_id"]}, {"_id": 0})
                if workspace and not any(m["user_id"] == user.user_id for m in workspace.get("members", [])):
                    await db.workspaces.update_one(
                        {"workspace_id": board["workspace_id"]},
                        {"$push": {"members": {"user_id": user.user_id, "role": "member"}}}
                    )
        
        result["redirect"] = f"/board/{invitation['board_id']}"
        result["card_id"] = invitation["target_id"]
        result["card_name"] = invitation["target_name"]
    
    # Mark invitation as used
    await db.invitation_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat(), "used_by": user.user_id}}
    )
    
    # Remove any pending invites for this email
    await db.pending_invites.delete_many({"email": invitation["email"]})
    
    # Create notification
    await create_notification(
        user_id=user.user_id,
        notification_type=f"{invitation['invitation_type']}_accepted",
        title="Invitation Accepted",
        message=f"You've joined '{invitation['target_name']}'",
        from_user=None,
        board_id=invitation.get("board_id"),
        card_id=invitation["target_id"] if invitation["invitation_type"] == "card" else None
    )
    
    return result

# ============== WORKSPACE ROUTES ==============

@api_router.post("/workspaces", response_model=Dict[str, Any])
async def create_workspace(data: WorkspaceCreate, user: User = Depends(get_current_user)):
    workspace_id = f"ws_{uuid.uuid4().hex[:12]}"
    workspace_doc = {
        "workspace_id": workspace_id,
        "name": data.name,
        "description": data.description,
        "owner_id": user.user_id,
        "members": [{"user_id": user.user_id, "role": "owner"}],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.workspaces.insert_one(workspace_doc)
    workspace_doc.pop("_id", None)
    return workspace_doc

@api_router.get("/workspaces")
async def get_workspaces(user: User = Depends(get_current_user)):
    workspaces = await db.workspaces.find(
        {"members.user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    return workspaces

@api_router.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@api_router.patch("/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, data: WorkspaceUpdate, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only owner can update workspace")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.workspaces.update_one({"workspace_id": workspace_id}, {"$set": update_data})
    
    return {"message": "Workspace updated"}

@api_router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace")
    
    # Delete all boards in workspace
    await db.boards.delete_many({"workspace_id": workspace_id})
    await db.lists.delete_many({"workspace_id": workspace_id})
    await db.cards.delete_many({"workspace_id": workspace_id})
    await db.workspaces.delete_one({"workspace_id": workspace_id})
    
    return {"message": "Workspace deleted"}

@api_router.post("/workspaces/{workspace_id}/members")
async def add_workspace_member(workspace_id: str, request: Request, user: User = Depends(get_current_user)):
    """Add a member to workspace - sends email invitation if user not registered"""
    body = await request.json()
    member_email = body.get("email")
    member_role = body.get("role", "member")
    
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only owner can add members")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": member_email}, {"_id": 0})
    
    if existing_user:
        # Check if already member
        for m in workspace.get("members", []):
            if m["user_id"] == existing_user["user_id"]:
                raise HTTPException(status_code=400, detail="User already a member")
        
        # Add directly to workspace
        await db.workspaces.update_one(
            {"workspace_id": workspace_id},
            {"$push": {"members": {"user_id": existing_user["user_id"], "role": member_role}}}
        )
        
        # Create notification
        await create_notification(
            user_id=existing_user["user_id"],
            notification_type="workspace_invite",
            title="Workspace Invitation",
            message=f"{user.name} added you to workspace '{workspace['name']}'",
            from_user=user
        )
        
        return {"message": f"Added {existing_user['name']} to workspace", "pending": False}
    
    # User doesn't exist - create invitation token and send email
    token = secrets.token_urlsafe(32)
    invitation_doc = {
        "token": token,
        "email": member_email,
        "invitation_type": "workspace",
        "target_id": workspace_id,
        "role": member_role,
        "invited_by": user.user_id,
        "invited_by_name": user.name,
        "target_name": workspace["name"],
        "board_id": None,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    }
    await db.invitation_tokens.insert_one(invitation_doc)
    
    # Generate invitation link
    frontend_url = os.environ.get('FRONTEND_URL', 'https://odapto.com')
    invitation_link = f"{frontend_url}/invite/accept?token={token}"
    
    # Send email
    email_result = await send_workspace_invitation_email(
        to_email=member_email,
        inviter_name=user.name,
        workspace_name=workspace["name"],
        role=member_role,
        invitation_link=invitation_link
    )
    
    # Log email attempt
    email_log = {
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to_email": member_email,
        "subject": f"[Odapto] {user.name} invited you to {workspace['name']}",
        "email_type": "workspace_invite",
        "success": email_result.get("success", False),
        "error": email_result.get("error"),
        "invitation_token": token,
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_logs.insert_one(email_log)
    
    if not email_result.get("success"):
        logger.error(f"Failed to send workspace invitation email to {member_email}: {email_result.get('error')}")
        return {
            "message": "Invitation created but email delivery failed. The user can still join via invitation link.",
            "pending": True,
            "email": member_email,
            "invitation_link": invitation_link,
            "email_error": email_result.get("error")
        }
    
    return {
        "message": f"Invitation email sent to {member_email}",
        "pending": True,
        "email": member_email
    }

@api_router.delete("/workspaces/{workspace_id}/members/{member_user_id}")
async def remove_workspace_member(workspace_id: str, member_user_id: str, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only owner can remove members")
    
    if member_user_id == workspace["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")
    
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$pull": {"members": {"user_id": member_user_id}}}
    )
    
    return {"message": "Member removed"}

# ============== TEAM ROUTES ==============

@api_router.post("/workspaces/{workspace_id}/teams")
async def create_team(workspace_id: str, data: TeamCreate, user: User = Depends(get_current_user)):
    """Create a new team within a workspace - only workspace owner"""
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only workspace owner can create teams")
    
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    team_doc = {
        "team_id": team_id,
        "workspace_id": workspace_id,
        "name": data.name,
        "description": data.description,
        "owner_id": user.user_id,
        "members": [{"user_id": user.user_id, "role": "owner"}],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.teams.insert_one(team_doc)
    team_doc.pop("_id", None)
    return team_doc

@api_router.get("/workspaces/{workspace_id}/teams")
async def get_workspace_teams(workspace_id: str, user: User = Depends(get_current_user)):
    """Get all teams in a workspace"""
    workspace = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    teams = await db.teams.find({"workspace_id": workspace_id}, {"_id": 0}).to_list(100)
    
    # Add member details
    for team in teams:
        members_with_info = []
        for member in team.get("members", []):
            user_info = await db.users.find_one(
                {"user_id": member["user_id"]},
                {"_id": 0, "password_hash": 0}
            )
            if user_info:
                members_with_info.append({**member, **user_info})
        team["members"] = members_with_info
    
    return teams

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, user: User = Depends(get_current_user)):
    """Get team details"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get member details
    members_with_info = []
    for member in team.get("members", []):
        user_info = await db.users.find_one(
            {"user_id": member["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        if user_info:
            members_with_info.append({**member, **user_info})
    team["members"] = members_with_info
    
    return team

@api_router.patch("/teams/{team_id}")
async def update_team(team_id: str, data: TeamUpdate, user: User = Depends(get_current_user)):
    """Update team details"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can update team")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.teams.update_one({"team_id": team_id}, {"$set": update_data})
    
    return {"message": "Team updated"}

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user: User = Depends(get_current_user)):
    """Delete a team"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can delete team")
    
    # Remove team assignment from all boards
    await db.boards.update_many(
        {"team_id": team_id},
        {"$set": {"team_id": None}}
    )
    
    await db.teams.delete_one({"team_id": team_id})
    return {"message": "Team deleted"}

@api_router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, data: TeamMemberRequest, user: User = Depends(get_current_user)):
    """Add a member to a team"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can add members")
    
    # Check if already member
    if any(m["user_id"] == data.user_id for m in team.get("members", [])):
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    await db.teams.update_one(
        {"team_id": team_id},
        {"$push": {"members": {"user_id": data.user_id, "role": data.role}}}
    )
    
    return {"message": "Member added"}

@api_router.delete("/teams/{team_id}/members/{member_user_id}")
async def remove_team_member(team_id: str, member_user_id: str, user: User = Depends(get_current_user)):
    """Remove a member from a team"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can remove members")
    
    if member_user_id == team["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove team owner")
    
    await db.teams.update_one(
        {"team_id": team_id},
        {"$pull": {"members": {"user_id": member_user_id}}}
    )
    
    return {"message": "Member removed"}

@api_router.patch("/boards/{board_id}/team")
async def assign_board_to_team(board_id: str, request: Request, user: User = Depends(get_current_user)):
    """Assign a board to a team (one board can only be in one team)"""
    body = await request.json()
    team_id = body.get("team_id")
    
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    if board["created_by"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only board owner can assign team")
    
    if team_id:
        team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Verify team belongs to same workspace
        if team["workspace_id"] != board["workspace_id"]:
            raise HTTPException(status_code=400, detail="Team must be in the same workspace")
    
    await db.boards.update_one(
        {"board_id": board_id},
        {"$set": {"team_id": team_id}}
    )
    
    return {"message": "Board team assignment updated"}

@api_router.get("/teams/{team_id}/boards")
async def get_team_boards(team_id: str, user: User = Depends(get_current_user)):
    """Get all boards assigned to a team"""
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if user is team member
    if not any(m["user_id"] == user.user_id for m in team.get("members", [])):
        raise HTTPException(status_code=403, detail="Access denied")
    
    boards = await db.boards.find(
        {"team_id": team_id, "is_template": False},
        {"_id": 0}
    ).to_list(100)
    
    return boards

# ============== BOARD ROUTES ==============

@api_router.post("/workspaces/{workspace_id}/boards")
async def create_board(workspace_id: str, data: BoardCreate, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    board_id = f"board_{uuid.uuid4().hex[:12]}"
    board_doc = {
        "board_id": board_id,
        "workspace_id": workspace_id,
        "name": data.name,
        "description": data.description,
        "background": data.background or "#3A8B84",
        "background_type": data.background_type or "color",
        "members": [{"user_id": user.user_id, "role": "owner", "joined_at": datetime.now(timezone.utc).isoformat()}],
        "team_id": None,  # Board can be assigned to a team
        "is_template": False,
        "template_name": None,
        "template_description": None,
        "template_category_id": None,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boards.insert_one(board_doc)
    board_doc.pop("_id", None)
    
    # Create default lists
    default_lists = ["To Do", "In Progress", "Done"]
    for idx, list_name in enumerate(default_lists):
        list_doc = {
            "list_id": f"list_{uuid.uuid4().hex[:12]}",
            "board_id": board_id,
            "workspace_id": workspace_id,
            "name": list_name,
            "position": idx,
            "wip_limit": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lists.insert_one(list_doc)
    
    return board_doc

@api_router.get("/workspaces/{workspace_id}/boards")
async def get_boards(workspace_id: str, user: User = Depends(get_current_user)):
    workspace = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    boards = await db.boards.find(
        {"workspace_id": workspace_id, "is_template": False},
        {"_id": 0}
    ).to_list(100)
    
    # Add summary counts and categorization for each board
    for board in boards:
        list_count = await db.lists.count_documents({"board_id": board["board_id"]})
        cards = await db.cards.find({"board_id": board["board_id"]}, {"_id": 0, "attachments": 1}).to_list(1000)
        card_count = len(cards)
        attachment_count = sum(len(card.get("attachments", [])) for card in cards)
        
        board["list_count"] = list_count
        board["card_count"] = card_count
        board["attachment_count"] = attachment_count
        
        # Determine board category
        is_owner = board.get("created_by") == user.user_id
        has_team = board.get("team_id") is not None
        
        if has_team:
            board["category"] = "team"
            # Get team name
            team = await db.teams.find_one({"team_id": board["team_id"]}, {"name": 1})
            board["team_name"] = team.get("name") if team else None
        elif is_owner:
            board["category"] = "personal"
        else:
            board["category"] = "invited"
            # Get inviter info
            for member in board.get("members", []):
                if member.get("user_id") == user.user_id:
                    inviter_id = member.get("invited_by")
                    if inviter_id:
                        inviter = await db.users.find_one({"user_id": inviter_id}, {"name": 1})
                        board["invited_by_name"] = inviter.get("name") if inviter else None
                    break
    
    return boards

@api_router.get("/boards/{board_id}")
async def get_board(board_id: str, user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check workspace access OR direct board membership
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    is_board_member = any(m.get("user_id") == user.user_id for m in board.get("members", []))
    if not workspace and not is_board_member and not board.get("is_template"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get lists and cards
    lists = await db.lists.find({"board_id": board_id}, {"_id": 0}).sort("position", 1).to_list(100)
    
    for lst in lists:
        cards = await db.cards.find({"list_id": lst["list_id"]}, {"_id": 0}).sort("position", 1).to_list(100)
        lst["cards"] = cards
    
    board["lists"] = lists
    return board

@api_router.patch("/boards/{board_id}")
async def update_board(board_id: str, data: BoardUpdate, user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.boards.update_one({"board_id": board_id}, {"$set": update_data})
    
    return {"message": "Board updated"}

@api_router.delete("/boards/{board_id}")
async def delete_board(board_id: str, user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.cards.delete_many({"board_id": board_id})
    await db.lists.delete_many({"board_id": board_id})
    await db.boards.delete_one({"board_id": board_id})
    
    return {"message": "Board deleted"}

# ============== BOARD MEMBER INVITATION ==============

@api_router.post("/boards/{board_id}/invite")
async def invite_board_member(board_id: str, data: BoardInviteRequest, user: User = Depends(get_current_user)):
    """Invite a user to collaborate on a board - sends email if user not registered"""
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check if user is board owner or has invite permission
    is_owner = board.get("created_by") == user.user_id
    is_board_member = any(m.get("user_id") == user.user_id and m.get("role") in ["owner", "admin"] for m in board.get("members", []))
    
    if not is_owner and not is_board_member:
        raise HTTPException(status_code=403, detail="Only board owners can invite members")
    
    # Find the user to invite
    invite_user = await db.users.find_one({"email": data.email}, {"_id": 0, "password_hash": 0})
    
    if invite_user:
        # Check if already a member
        if any(m.get("user_id") == invite_user["user_id"] for m in board.get("members", [])):
            raise HTTPException(status_code=400, detail="User is already a board member")
        
        # Add to board members directly - track invited_by
        new_member = {
            "user_id": invite_user["user_id"],
            "role": data.role,
            "invited_by": user.user_id,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.boards.update_one(
            {"board_id": board_id},
            {"$push": {"members": new_member}}
        )
        
        # Also add to workspace if not already a member
        workspace = await db.workspaces.find_one({"workspace_id": board["workspace_id"]}, {"_id": 0})
        if workspace and not any(m["user_id"] == invite_user["user_id"] for m in workspace.get("members", [])):
            await db.workspaces.update_one(
                {"workspace_id": board["workspace_id"]},
                {"$push": {"members": {"user_id": invite_user["user_id"], "role": "member"}}}
            )
        
        # Create notification for the invited user
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": invite_user["user_id"],
            "type": "board_invite",
            "title": "Board Invitation",
            "message": f"{user.name} invited you to collaborate on '{board['name']}'",
            "board_id": board_id,
            "card_id": None,
            "from_user_id": user.user_id,
            "from_user_name": user.name,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Send email invitation to existing user
        frontend_url = os.environ.get('FRONTEND_URL', 'https://odapto.com')
        board_link = f"{frontend_url}/board/{board_id}"
        email_result = await send_board_invitation_email(
            to_email=invite_user["email"],
            inviter_name=user.name,
            board_name=board["name"],
            role=data.role,
            invitation_link=board_link
        )
        
        # Broadcast to WebSocket
        await manager.broadcast(board_id, {
            "type": "member_joined",
            "user": {"user_id": invite_user["user_id"], "name": invite_user["name"], "email": invite_user["email"]},
            "role": data.role
        })
        
        return {"message": f"Invited {invite_user['name']} to the board", "member": new_member, "pending": False}
    
    # User doesn't exist - create invitation token and send email
    token = secrets.token_urlsafe(32)
    invitation_doc = {
        "token": token,
        "email": data.email,
        "invitation_type": "board",
        "target_id": board_id,
        "role": data.role,
        "invited_by": user.user_id,
        "invited_by_name": user.name,
        "target_name": board["name"],
        "board_id": board_id,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    }
    await db.invitation_tokens.insert_one(invitation_doc)
    
    # Generate invitation link
    frontend_url = os.environ.get('FRONTEND_URL', 'https://odapto.com')
    invitation_link = f"{frontend_url}/invite/accept?token={token}"
    
    # Send email
    email_result = await send_board_invitation_email(
        to_email=data.email,
        inviter_name=user.name,
        board_name=board["name"],
        role=data.role,
        invitation_link=invitation_link
    )
    
    # Log email attempt
    email_log = {
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to_email": data.email,
        "subject": f"[Odapto] {user.name} invited you to collaborate on {board['name']}",
        "email_type": "board_invite",
        "success": email_result.get("success", False),
        "error": email_result.get("error"),
        "invitation_token": token,
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_logs.insert_one(email_log)
    
    if not email_result.get("success"):
        logger.error(f"Failed to send board invitation email to {data.email}: {email_result.get('error')}")
        return {
            "message": "Invitation created but email delivery failed. Share this link with them.",
            "pending": True,
            "email": data.email,
            "invitation_link": invitation_link,
            "email_error": email_result.get("error")
        }
    
    return {
        "message": f"Invitation email sent to {data.email}",
        "pending": True,
        "email": data.email
    }

@api_router.delete("/boards/{board_id}/members/{member_user_id}")
async def remove_board_member(board_id: str, member_user_id: str, user: User = Depends(get_current_user)):
    """Remove a member from a board - only inviter or board owner can remove"""
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Find the member to check who invited them
    member_to_remove = None
    for m in board.get("members", []):
        if m.get("user_id") == member_user_id:
            member_to_remove = m
            break
    
    if not member_to_remove:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Can't remove the owner
    if member_user_id == board.get("created_by"):
        raise HTTPException(status_code=400, detail="Cannot remove the board owner")
    
    # Only allow: board owner OR the person who invited them
    is_owner = board.get("created_by") == user.user_id
    is_inviter = member_to_remove.get("invited_by") == user.user_id
    
    if not is_owner and not is_inviter:
        raise HTTPException(status_code=403, detail="Only the board owner or the person who invited this member can remove them")
    
    await db.boards.update_one(
        {"board_id": board_id},
        {"$pull": {"members": {"user_id": member_user_id}}}
    )
    
    return {"message": "Member removed"}

@api_router.get("/boards/{board_id}/members")
async def get_board_members(board_id: str, user: User = Depends(get_current_user)):
    """Get all members of a board"""
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Get full user info for each member
    members = []
    for member in board.get("members", []):
        user_info = await db.users.find_one(
            {"user_id": member["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        if user_info:
            members.append({
                **member,
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "picture": user_info.get("picture")
            })
    
    return members

# ============== NOTIFICATIONS ==============

@api_router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get all notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({"user_id": user.user_id, "read": False})
    return {"count": count}

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

# Helper function to create notifications
async def create_notification(user_id: str, notification_type: str, title: str, message: str, 
                             from_user: User = None, board_id: str = None, card_id: str = None):
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "board_id": board_id,
        "card_id": card_id,
        "from_user_id": from_user.user_id if from_user else None,
        "from_user_name": from_user.name if from_user else None,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification

# ============== LIST ROUTES ==============

@api_router.post("/boards/{board_id}/lists")
async def create_list(board_id: str, data: ListCreate, user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get max position
    max_pos = await db.lists.find_one({"board_id": board_id}, sort=[("position", -1)])
    position = data.position if data.position is not None else (max_pos["position"] + 1 if max_pos else 0)
    
    list_id = f"list_{uuid.uuid4().hex[:12]}"
    list_doc = {
        "list_id": list_id,
        "board_id": board_id,
        "workspace_id": board["workspace_id"],
        "name": data.name,
        "position": position,
        "wip_limit": data.wip_limit,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lists.insert_one(list_doc)
    list_doc.pop("_id", None)
    
    # Broadcast list creation via WebSocket
    await manager.broadcast(board_id, {
        "type": "list_created",
        "list": list_doc
    })
    
    return list_doc

@api_router.patch("/lists/{list_id}")
async def update_list(list_id: str, data: ListUpdate, user: User = Depends(get_current_user)):
    lst = await db.lists.find_one({"list_id": list_id}, {"_id": 0})
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    board = await db.boards.find_one({"board_id": lst["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.lists.update_one({"list_id": list_id}, {"$set": update_data})
        
        # Broadcast list update via WebSocket
        updated_list = await db.lists.find_one({"list_id": list_id}, {"_id": 0})
        await manager.broadcast(lst["board_id"], {
            "type": "list_updated",
            "list": updated_list
        })
    
    return {"message": "List updated"}

@api_router.delete("/lists/{list_id}")
async def delete_list(list_id: str, user: User = Depends(get_current_user)):
    lst = await db.lists.find_one({"list_id": list_id}, {"_id": 0})
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    board = await db.boards.find_one({"board_id": lst["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.cards.delete_many({"list_id": list_id})
    await db.lists.delete_one({"list_id": list_id})
    
    # Broadcast list deletion via WebSocket
    await manager.broadcast(lst["board_id"], {
        "type": "list_deleted",
        "list_id": list_id
    })
    
    return {"message": "List deleted"}

# ============== CARD ROUTES ==============

@api_router.post("/lists/{list_id}/cards")
async def create_card(list_id: str, data: CardCreate, user: User = Depends(get_current_user)):
    lst = await db.lists.find_one({"list_id": list_id}, {"_id": 0})
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    board = await db.boards.find_one({"board_id": lst["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get max position
    max_pos = await db.cards.find_one({"list_id": list_id}, sort=[("position", -1)])
    position = data.position if data.position is not None else (max_pos["position"] + 1 if max_pos else 0)
    
    card_id = f"card_{uuid.uuid4().hex[:12]}"
    card_doc = {
        "card_id": card_id,
        "list_id": list_id,
        "board_id": lst["board_id"],
        "workspace_id": board["workspace_id"],
        "title": data.title,
        "description": data.description,
        "position": position,
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "labels": data.labels,
        "priority": data.priority,
        "assigned_members": data.assigned_members,
        "attachments": [],
        "checklist": [],
        "comments": [],
        "cover_image": None,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cards.insert_one(card_doc)
    card_doc.pop("_id", None)
    
    # Log activity
    await log_card_activity(
        card_id=card_id,
        board_id=lst["board_id"],
        user=user,
        action="created",
        details={"title": data.title, "list_name": lst.get("name")}
    )
    
    # Broadcast card creation via WebSocket
    await manager.broadcast(lst["board_id"], {
        "type": "card_created",
        "card": card_doc,
        "list_id": list_id
    })
    
    return card_doc

@api_router.get("/cards/{card_id}")
async def get_card(card_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return card

@api_router.patch("/cards/{card_id}")
async def update_card(card_id: str, data: CardUpdate, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {}
    data_dict = data.model_dump(exclude_unset=True)
    activities = []
    
    for k, v in data_dict.items():
        if k == "due_date":
            if v:
                update_data[k] = v.isoformat() if hasattr(v, 'isoformat') else v
                activities.append(("set_due_date", {"due_date": update_data[k]}))
            else:
                update_data[k] = None
                if card.get("due_date"):
                    activities.append(("removed_due_date", {"old_due_date": card.get("due_date")}))
        elif k == "priority":
            update_data[k] = v
            if v != card.get("priority"):
                activities.append(("set_priority", {"priority": v, "old_priority": card.get("priority")}))
        elif k == "title" and v is not None and v != card.get("title"):
            update_data[k] = v
            activities.append(("updated_title", {"title": v, "old_title": card.get("title")}))
        elif k == "description" and v is not None:
            update_data[k] = v
            activities.append(("updated_description", {}))
        elif k == "labels" and v is not None:
            update_data[k] = v
            old_labels = card.get("labels", [])
            new_labels = v
            added = [l for l in new_labels if l not in old_labels]
            removed = [l for l in old_labels if l not in new_labels]
            if added:
                activities.append(("added_label", {"labels": added}))
            if removed:
                activities.append(("removed_label", {"labels": removed}))
        elif v is not None:
            update_data[k] = v
    
    if update_data:
        await db.cards.update_one({"card_id": card_id}, {"$set": update_data})
        
        # Log activities
        for action, details in activities:
            await log_card_activity(
                card_id=card_id,
                board_id=card["board_id"],
                user=user,
                action=action,
                details=details
            )
        
        # Broadcast card update via WebSocket
        updated_card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
        await manager.broadcast(card["board_id"], {
            "type": "card_updated",
            "card": updated_card,
            "list_id": card["list_id"]
        })
    
    return {"message": "Card updated"}

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Log activity before deletion
    await log_card_activity(
        card_id=card_id,
        board_id=card["board_id"],
        user=user,
        action="deleted",
        details={"title": card.get("title")}
    )
    
    await db.cards.delete_one({"card_id": card_id})
    
    # Broadcast card deletion via WebSocket
    await manager.broadcast(card["board_id"], {
        "type": "card_deleted",
        "card_id": card_id,
        "list_id": card["list_id"]
    })
    
    return {"message": "Card deleted"}

# Move card between lists
@api_router.post("/cards/{card_id}/move")
async def move_card(card_id: str, request: Request, user: User = Depends(get_current_user)):
    body = await request.json()
    target_list_id = body.get("target_list_id")
    target_position = body.get("position", 0)
    
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify target list exists and is in same board
    target_list = await db.lists.find_one({"list_id": target_list_id}, {"_id": 0})
    if not target_list or target_list["board_id"] != card["board_id"]:
        raise HTTPException(status_code=400, detail="Invalid target list")
    
    # Update positions in source list
    if card["list_id"] != target_list_id:
        await db.cards.update_many(
            {"list_id": card["list_id"], "position": {"$gt": card["position"]}},
            {"$inc": {"position": -1}}
        )
    
    # Update positions in target list
    await db.cards.update_many(
        {"list_id": target_list_id, "position": {"$gte": target_position}},
        {"$inc": {"position": 1}}
    )
    
    # Move card
    old_list = await db.lists.find_one({"list_id": card["list_id"]}, {"name": 1})
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$set": {"list_id": target_list_id, "position": target_position}}
    )
    
    # Log activity for card move
    await log_card_activity(
        card_id=card_id,
        board_id=card["board_id"],
        user=user,
        action="moved",
        details={
            "from_list": old_list.get("name") if old_list else None,
            "to_list": target_list.get("name")
        }
    )
    
    # Broadcast card move via WebSocket
    await manager.broadcast(card["board_id"], {
        "type": "card_moved",
        "card_id": card_id,
        "from_list_id": card["list_id"],
        "to_list_id": target_list_id,
        "position": target_position
    })
    
    return {"message": "Card moved"}

@api_router.get("/cards/{card_id}/activities")
async def get_card_activities(card_id: str, user: User = Depends(get_current_user), limit: int = 50):
    """Get activity history for a card"""
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    activities = await db.card_activities.find(
        {"card_id": card_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return activities

# Card member invitation
@api_router.post("/cards/{card_id}/invite")
async def invite_card_member(card_id: str, data: CardInviteRequest, user: User = Depends(get_current_user)):
    """Invite a user to be assigned to a card. Sends email if user not registered."""
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find the user to invite
    invite_user = await db.users.find_one({"email": data.email}, {"_id": 0, "password_hash": 0})
    
    if invite_user:
        # User exists - add directly to card
        # Check if already assigned
        if any(m.get("user_id") == invite_user["user_id"] for m in card.get("assigned_members", [])):
            raise HTTPException(status_code=400, detail="User is already assigned to this card")
        
        new_member = {
            "user_id": invite_user["user_id"],
            "name": invite_user["name"],
            "email": invite_user["email"],
            "picture": invite_user.get("picture")
        }
        await db.cards.update_one(
            {"card_id": card_id},
            {"$push": {"assigned_members": new_member}}
        )
        
        # Also add to board and workspace if not already a member
        if not any(m.get("user_id") == invite_user["user_id"] for m in board.get("members", [])):
            await db.boards.update_one(
                {"board_id": board["board_id"]},
                {"$push": {"members": {"user_id": invite_user["user_id"], "role": "member", "invited_by": user.user_id, "joined_at": datetime.now(timezone.utc).isoformat()}}}
            )
        if not any(m.get("user_id") == invite_user["user_id"] for m in workspace.get("members", [])):
            await db.workspaces.update_one(
                {"workspace_id": board["workspace_id"]},
                {"$push": {"members": {"user_id": invite_user["user_id"], "role": "member"}}}
            )
        
        # Create notification for the invited user
        await create_notification(
            user_id=invite_user["user_id"],
            notification_type="card_assignment",
            title="Card Assignment",
            message=f"{user.name} assigned you to '{card['title']}'",
            from_user=user,
            board_id=board["board_id"],
            card_id=card_id
        )
        
        # Broadcast to WebSocket
        await manager.broadcast(board["board_id"], {
            "type": "member_assigned",
            "card_id": card_id,
            "member": new_member
        })
        
        # Log activity
        await log_card_activity(
            card_id=card_id,
            board_id=board["board_id"],
            user=user,
            action="added_member",
            details={"member_name": invite_user["name"]}
        )
        
        return {"message": f"Added {invite_user['name']} to the card", "member": new_member, "pending": False}
    
    # User doesn't exist - create invitation token and send email
    token = secrets.token_urlsafe(32)
    invitation_doc = {
        "token": token,
        "email": data.email,
        "invitation_type": "card",
        "target_id": card_id,
        "role": None,
        "invited_by": user.user_id,
        "invited_by_name": user.name,
        "target_name": card["title"],
        "board_id": board["board_id"],
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    }
    await db.invitation_tokens.insert_one(invitation_doc)
    
    # Also create pending invite for auto-add on registration
    pending_invite = {
        "invite_id": f"invite_{uuid.uuid4().hex[:12]}",
        "email": data.email,
        "invite_type": "card",
        "target_id": card_id,
        "board_id": board["board_id"],
        "board_name": board["name"],
        "card_title": card["title"],
        "invited_by": user.user_id,
        "invited_by_name": user.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pending_invites.insert_one(pending_invite)
    
    # Generate invitation link
    frontend_url = os.environ.get('FRONTEND_URL', 'https://odapto.com')
    invitation_link = f"{frontend_url}/invite/accept?token={token}"
    
    # Send email
    email_result = await send_card_invitation_email(
        to_email=data.email,
        inviter_name=user.name,
        card_title=card["title"],
        board_name=board["name"],
        invitation_link=invitation_link
    )
    
    # Log email attempt
    email_log = {
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to_email": data.email,
        "subject": f"[Odapto] {user.name} assigned you to: {card['title']}",
        "email_type": "card_invite",
        "success": email_result.get("success", False),
        "error": email_result.get("error"),
        "invitation_token": token,
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_logs.insert_one(email_log)
    
    if not email_result.get("success"):
        logger.error(f"Failed to send card invitation email to {data.email}: {email_result.get('error')}")
        return {
            "message": "Invitation created but email delivery failed. Share this link with them.",
            "pending": True,
            "email": data.email,
            "invitation_link": invitation_link,
            "email_error": email_result.get("error")
        }
    
    return {
        "message": f"Invitation email sent to {data.email}. They will be added once they sign up.",
        "pending": True,
        "email": data.email
    }

@api_router.delete("/cards/{card_id}/members/{member_user_id}")
async def remove_card_member(card_id: str, member_user_id: str, user: User = Depends(get_current_user)):
    """Remove an assigned member from a card"""
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$pull": {"assigned_members": {"user_id": member_user_id}}}
    )
    
    return {"message": "Member removed from card"}

@api_router.get("/cards/{card_id}/members")
async def get_card_members(card_id: str, user: User = Depends(get_current_user)):
    """Get all assigned members of a card"""
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    return card.get("assigned_members", [])

# Card comments
@api_router.post("/cards/{card_id}/comments")
async def add_comment(card_id: str, data: CommentCreate, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    comment = {
        "comment_id": f"cmt_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$push": {"comments": comment}}
    )
    
    # Send notifications to all board members except the commenter
    for member in board.get("members", []):
        if member["user_id"] != user.user_id:
            await create_notification(
                user_id=member["user_id"],
                notification_type="comment",
                title="New Comment",
                message=f"{user.name} commented on '{card['title']}': {data.content[:50]}{'...' if len(data.content) > 50 else ''}",
                from_user=user,
                board_id=board["board_id"],
                card_id=card_id
            )
    
    # Broadcast to WebSocket for real-time updates
    await manager.broadcast(board["board_id"], {
        "type": "new_comment",
        "card_id": card_id,
        "comment": comment
    })
    
    # Log activity (skip notification since we already notified above)
    await log_card_activity(
        card_id=card_id,
        board_id=board["board_id"],
        user=user,
        action="added_comment",
        details={"comment_preview": data.content[:100]},
        notify_members=False
    )
    
    return comment

# Card checklist
@api_router.post("/cards/{card_id}/checklist")
async def add_checklist_item(card_id: str, data: ChecklistItemCreate, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    item = {
        "item_id": f"chk_{uuid.uuid4().hex[:8]}",
        "text": data.text,
        "completed": False
    }
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$push": {"checklist": item}}
    )
    
    # Log activity
    await log_card_activity(
        card_id=card_id,
        board_id=board["board_id"],
        user=user,
        action="added_checklist_item",
        details={"item_text": data.text}
    )
    
    # Broadcast via WebSocket
    await manager.broadcast(board["board_id"], {
        "type": "checklist_item_added",
        "card_id": card_id,
        "item": item
    })
    
    return item

@api_router.patch("/cards/{card_id}/checklist/{item_id}")
async def toggle_checklist_item(card_id: str, item_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find and toggle the item
    for item in card.get("checklist", []):
        if item["item_id"] == item_id:
            new_completed = not item["completed"]
            await db.cards.update_one(
                {"card_id": card_id, "checklist.item_id": item_id},
                {"$set": {"checklist.$.completed": new_completed}}
            )
            
            # Log activity
            action = "completed_checklist_item" if new_completed else "uncompleted_checklist_item"
            await log_card_activity(
                card_id=card_id,
                board_id=board["board_id"],
                user=user,
                action=action,
                details={"item_text": item.get("text")}
            )
            
            # Broadcast via WebSocket
            await manager.broadcast(board["board_id"], {
                "type": "checklist_item_toggled",
                "card_id": card_id,
                "item_id": item_id,
                "completed": new_completed
            })
            
            return {"message": "Checklist item toggled"}
    
    raise HTTPException(status_code=404, detail="Checklist item not found")

# ============== TEMPLATE ROUTES ==============

@api_router.get("/template-categories")
async def get_template_categories():
    categories = await db.template_categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/template-categories")
async def create_template_category(data: TemplateCategoryCreate, admin: User = Depends(require_admin)):
    category_id = f"cat_{uuid.uuid4().hex[:12]}"
    category_doc = {
        "category_id": category_id,
        "name": data.name,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.template_categories.insert_one(category_doc)
    category_doc.pop("_id", None)
    return category_doc

@api_router.delete("/template-categories/{category_id}")
async def delete_template_category(category_id: str, admin: User = Depends(require_admin)):
    result = await db.template_categories.delete_one({"category_id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

@api_router.post("/boards/{board_id}/publish-template")
async def publish_board_as_template(board_id: str, data: PublishTemplateRequest, user: User = Depends(require_privileged)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    if board["created_by"] != user.user_id:
        raise HTTPException(status_code=403, detail="Can only publish your own boards")
    
    # Verify category exists
    category = await db.template_categories.find_one({"category_id": data.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Create template from board
    template_id = f"tmpl_{uuid.uuid4().hex[:12]}"
    template_doc = {
        **board,
        "board_id": template_id,
        "is_template": True,
        "template_name": data.template_name,
        "template_description": data.template_description,
        "template_category_id": data.category_id,
        "original_board_id": board_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boards.insert_one(template_doc)
    
    # Copy lists
    lists = await db.lists.find({"board_id": board_id}, {"_id": 0}).to_list(100)
    for lst in lists:
        new_list_id = f"list_{uuid.uuid4().hex[:12]}"
        new_list = {
            **lst,
            "list_id": new_list_id,
            "board_id": template_id
        }
        await db.lists.insert_one(new_list)
        
        # Copy cards
        cards = await db.cards.find({"list_id": lst["list_id"]}, {"_id": 0}).to_list(100)
        for card in cards:
            new_card = {
                **card,
                "card_id": f"card_{uuid.uuid4().hex[:12]}",
                "list_id": new_list_id,
                "board_id": template_id
            }
            await db.cards.insert_one(new_card)
    
    template_doc.pop("_id", None)
    return template_doc

@api_router.get("/templates")
async def get_templates(category_id: Optional[str] = None, search: Optional[str] = None):
    query = {"is_template": True}
    if category_id:
        query["template_category_id"] = category_id
    
    templates = await db.boards.find(query, {"_id": 0}).to_list(100)
    
    if search:
        search_lower = search.lower()
        templates = [t for t in templates if search_lower in t.get("template_name", "").lower() or search_lower in t.get("template_description", "").lower()]
    
    # Enrich with category info, creator info, and stats
    for template in templates:
        if template.get("template_category_id"):
            category = await db.template_categories.find_one(
                {"category_id": template["template_category_id"]},
                {"_id": 0}
            )
            template["category"] = category
        
        creator = await db.users.find_one(
            {"user_id": template["created_by"]},
            {"_id": 0, "password_hash": 0}
        )
        template["creator"] = creator
        
        # Add list and card counts
        list_count = await db.lists.count_documents({"board_id": template["board_id"]})
        card_count = await db.cards.count_documents({"board_id": template["board_id"]})
        template["list_count"] = list_count
        template["card_count"] = card_count
        
        # Add usage count (how many boards created from this template)
        usage_count = await db.boards.count_documents({"created_from_template": template["board_id"]})
        template["usage_count"] = usage_count
    
    return templates

@api_router.get("/templates/{template_id}")
async def get_template(template_id: str):
    template = await db.boards.find_one({"board_id": template_id, "is_template": True}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get lists and cards
    lists = await db.lists.find({"board_id": template_id}, {"_id": 0}).sort("position", 1).to_list(100)
    for lst in lists:
        cards = await db.cards.find({"list_id": lst["list_id"]}, {"_id": 0}).sort("position", 1).to_list(100)
        lst["cards"] = cards
    
    template["lists"] = lists
    
    # Get category and creator
    if template.get("template_category_id"):
        category = await db.template_categories.find_one(
            {"category_id": template["template_category_id"]},
            {"_id": 0}
        )
        template["category"] = category
    
    creator = await db.users.find_one(
        {"user_id": template["created_by"]},
        {"_id": 0, "password_hash": 0}
    )
    template["creator"] = creator
    
    return template

@api_router.post("/templates/{template_id}/use")
async def use_template(template_id: str, request: Request, user: User = Depends(get_current_user)):
    body = await request.json()
    workspace_id = body.get("workspace_id")
    board_name = body.get("board_name")
    
    template = await db.boards.find_one({"board_id": template_id, "is_template": True}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    workspace = await db.workspaces.find_one(
        {"workspace_id": workspace_id, "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Create new board from template
    new_board_id = f"board_{uuid.uuid4().hex[:12]}"
    new_board = {
        "board_id": new_board_id,
        "workspace_id": workspace_id,
        "name": board_name or template.get("template_name", "New Board"),
        "description": template.get("template_description"),
        "background": template.get("background", "#3A8B84"),
        "is_template": False,
        "template_name": None,
        "template_description": None,
        "template_category_id": None,
        "created_by": user.user_id,
        "created_from_template": template_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boards.insert_one(new_board)
    
    # Copy lists and cards
    lists = await db.lists.find({"board_id": template_id}, {"_id": 0}).to_list(100)
    list_id_map = {}
    
    for lst in lists:
        new_list_id = f"list_{uuid.uuid4().hex[:12]}"
        list_id_map[lst["list_id"]] = new_list_id
        
        new_list = {
            "list_id": new_list_id,
            "board_id": new_board_id,
            "workspace_id": workspace_id,
            "name": lst["name"],
            "position": lst["position"],
            "wip_limit": lst.get("wip_limit"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.lists.insert_one(new_list)
        
        # Copy cards
        cards = await db.cards.find({"list_id": lst["list_id"]}, {"_id": 0}).to_list(100)
        for card in cards:
            new_card = {
                "card_id": f"card_{uuid.uuid4().hex[:12]}",
                "list_id": new_list_id,
                "board_id": new_board_id,
                "workspace_id": workspace_id,
                "title": card["title"],
                "description": card.get("description"),
                "position": card["position"],
                "due_date": None,
                "labels": card.get("labels", []),
                "priority": card.get("priority"),
                "assigned_members": [],
                "attachments": [],
                "checklist": card.get("checklist", []),
                "comments": [],
                "cover_image": None,
                "created_by": user.user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.cards.insert_one(new_card)
    
    # Track template usage
    await db.template_usage.insert_one({
        "usage_id": f"usage_{uuid.uuid4().hex[:12]}",
        "template_id": template_id,
        "user_id": user.user_id,
        "board_id": new_board_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    new_board.pop("_id", None)
    return new_board

# ============== FILE UPLOAD ==============

@api_router.post("/boards/{board_id}/background")
async def upload_board_background(board_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload a background image for a board"""
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate file type
    allowed_types = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(allowed_types)}")
    
    # Save file
    file_id = f"bg_{uuid.uuid4().hex[:12]}"
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    background_url = f"/api/files/{file_id}{file_ext}"
    
    # Update board
    await db.boards.update_one(
        {"board_id": board_id},
        {"$set": {"background": background_url, "background_type": "image"}}
    )
    
    return {"background": background_url, "background_type": "image"}

@api_router.post("/cards/{card_id}/attachments")
async def upload_attachment(card_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Save file
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    file_ext = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    attachment = {
        "file_id": file_id,
        "filename": file.filename,
        "url": f"/api/files/{file_id}{file_ext}",
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$push": {"attachments": attachment}}
    )
    
    return attachment

@api_router.delete("/cards/{card_id}/attachments/{file_id}")
async def delete_attachment(card_id: str, file_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find the attachment
    attachment = next((a for a in card.get("attachments", []) if a["file_id"] == file_id), None)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Remove from card
    await db.cards.update_one(
        {"card_id": card_id},
        {"$pull": {"attachments": {"file_id": file_id}}}
    )
    
    # If this attachment was the cover, clear it
    if card.get("cover_image") == attachment.get("url"):
        await db.cards.update_one({"card_id": card_id}, {"$set": {"cover_image": None}})
    
    # Delete file from disk
    filename = attachment["url"].split("/")[-1]
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()
    
    await log_card_activity(
        card_id=card_id, board_id=board["board_id"], user=user,
        action="deleted_attachment", details={"filename": attachment["filename"]}
    )
    
    return {"message": "Attachment deleted"}

@api_router.patch("/cards/{card_id}/cover")
async def set_card_cover(card_id: str, request: Request, user: User = Depends(get_current_user)):
    body = await request.json()
    cover_url = body.get("cover_image")
    
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$set": {"cover_image": cover_url}}
    )
    
    await log_card_activity(
        card_id=card_id, board_id=board["board_id"], user=user,
        action="set_cover", details={"cover_image": cover_url}
    )
    
    await manager.broadcast(board["board_id"], {
        "type": "card_updated", "card_id": card_id,
        "updates": {"cover_image": cover_url}
    })
    
    return {"cover_image": cover_url}

@api_router.delete("/cards/{card_id}/checklist/{item_id}")
async def delete_checklist_item(card_id: str, item_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    item = next((i for i in card.get("checklist", []) if i["item_id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    await db.cards.update_one(
        {"card_id": card_id},
        {"$pull": {"checklist": {"item_id": item_id}}}
    )
    
    await log_card_activity(
        card_id=card_id, board_id=board["board_id"], user=user,
        action="deleted_checklist_item", details={"item_text": item["text"]}
    )
    
    await manager.broadcast(board["board_id"], {
        "type": "checklist_item_deleted", "card_id": card_id, "item_id": item_id
    })
    
    return {"message": "Checklist item deleted"}

@api_router.post("/cards/{card_id}/duplicate")
async def duplicate_card(card_id: str, user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    board = await db.boards.find_one({"board_id": card["board_id"]}, {"_id": 0})
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_card_id = f"card_{uuid.uuid4().hex[:12]}"
    new_card = {
        "card_id": new_card_id,
        "list_id": card["list_id"],
        "board_id": card["board_id"],
        "workspace_id": card.get("workspace_id", board["workspace_id"]),
        "title": f"{card['title']} (copy)",
        "description": card.get("description", ""),
        "due_date": card.get("due_date"),
        "labels": card.get("labels", []),
        "priority": card.get("priority"),
        "assigned_members": [],
        "attachments": [],
        "checklist": [
            {"item_id": f"chk_{uuid.uuid4().hex[:8]}", "text": item["text"], "completed": False}
            for item in card.get("checklist", [])
        ],
        "comments": [],
        "cover_image": None,
        "position": (card.get("position", 0) + 1),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cards.insert_one(new_card)
    new_card.pop("_id", None)
    
    await log_card_activity(
        card_id=new_card_id, board_id=board["board_id"], user=user,
        action="created", details={"list_name": "duplicated from " + card["title"]}
    )
    
    await manager.broadcast(board["board_id"], {
        "type": "card_created", "card": new_card
    })
    
    return new_card

@api_router.get("/files/{filename}")
async def get_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# ============== SEARCH ==============

@api_router.get("/search")
async def search(q: str, user: User = Depends(get_current_user)):
    # Get user's workspaces
    workspaces = await db.workspaces.find(
        {"members.user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    workspace_ids = [w["workspace_id"] for w in workspaces]
    
    q_lower = q.lower()
    
    # Search boards
    boards = await db.boards.find(
        {"workspace_id": {"$in": workspace_ids}, "is_template": False},
        {"_id": 0}
    ).to_list(100)
    matching_boards = [b for b in boards if q_lower in b["name"].lower()]
    
    # Search cards
    cards = await db.cards.find(
        {"workspace_id": {"$in": workspace_ids}},
        {"_id": 0}
    ).to_list(500)
    matching_cards = [c for c in cards if q_lower in c["title"].lower() or q_lower in (c.get("description") or "").lower()]
    
    # Search templates
    templates = await db.boards.find({"is_template": True}, {"_id": 0}).to_list(100)
    matching_templates = [t for t in templates if q_lower in t.get("template_name", "").lower()]
    
    return {
        "boards": matching_boards[:10],
        "cards": matching_cards[:20],
        "templates": matching_templates[:10]
    }

# ============== ANALYTICS (ADMIN) ==============

@api_router.get("/admin/analytics")
async def get_analytics(admin: User = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_workspaces = await db.workspaces.count_documents({})
    total_boards = await db.boards.count_documents({"is_template": False})
    total_templates = await db.boards.count_documents({"is_template": True})
    total_cards = await db.cards.count_documents({})
    
    # User role distribution
    admin_count = await db.users.count_documents({"role": UserRole.ADMIN})
    privileged_count = await db.users.count_documents({"role": UserRole.PRIVILEGED})
    normal_count = await db.users.count_documents({"role": UserRole.NORMAL})
    
    # Template usage stats
    template_usage = await db.template_usage.find({}, {"_id": 0}).to_list(1000)
    
    # Recent activity
    recent_boards = await db.boards.find(
        {"is_template": False},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Email statistics
    total_emails = await db.email_logs.count_documents({})
    successful_emails = await db.email_logs.count_documents({"success": True})
    failed_emails = await db.email_logs.count_documents({"success": False})
    
    # Pending invitations
    pending_invites = await db.invitation_tokens.count_documents({"used": False})
    
    return {
        "totals": {
            "users": total_users,
            "workspaces": total_workspaces,
            "boards": total_boards,
            "templates": total_templates,
            "cards": total_cards
        },
        "user_roles": {
            "admin": admin_count,
            "privileged": privileged_count,
            "normal": normal_count
        },
        "template_usage_count": len(template_usage),
        "recent_boards": recent_boards,
        "email_stats": {
            "total": total_emails,
            "successful": successful_emails,
            "failed": failed_emails
        },
        "pending_invites": pending_invites
    }

@api_router.get("/admin/email-logs")
async def get_email_logs(admin: User = Depends(require_admin), limit: int = 50, skip: int = 0, success_only: bool = None):
    """Get email send logs for admin monitoring"""
    query = {}
    if success_only is not None:
        query["success"] = success_only
    
    logs = await db.email_logs.find(query, {"_id": 0}).sort("sent_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.email_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/admin/pending-invitations")
async def get_pending_invitations(admin: User = Depends(require_admin)):
    """Get all pending invitation tokens"""
    invitations = await db.invitation_tokens.find(
        {"used": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Mark expired ones
    now = datetime.now(timezone.utc)
    for inv in invitations:
        expires_at = datetime.fromisoformat(inv["expires_at"].replace('Z', '+00:00'))
        inv["is_expired"] = now > expires_at
    
    return {"invitations": invitations}

# ============== WEBSOCKET FOR REAL-TIME ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, board_id: str):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, board_id: str):
        if board_id in self.active_connections:
            self.active_connections[board_id].remove(websocket)
            if not self.active_connections[board_id]:
                del self.active_connections[board_id]
    
    async def broadcast(self, board_id: str, message: dict):
        if board_id in self.active_connections:
            for connection in self.active_connections[board_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

@app.websocket("/ws/board/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    await manager.connect(websocket, board_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast to all clients watching this board
            await manager.broadcast(board_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Serve uploaded files
@api_router.get("/uploads/{folder}/{filename}")
async def serve_upload(folder: str, filename: str):
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# Include the router in the main app
app.include_router(api_router)

@app.on_event("startup")
async def startup_db_check():
    """Verify database connectivity at startup"""
    try:
        result = await db.command("ping")
        user_count = await db.users.count_documents({})
        session_count = await db.user_sessions.count_documents({})
        logger.info(f"[STARTUP] DB connected: {db.name}, ping={result}, users={user_count}, sessions={session_count}")
    except Exception as e:
        logger.error(f"[STARTUP] DB connection FAILED: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
