from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Request, Response
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# File storage directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Odapto API", version="1.0.0")

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
    background: Optional[str] = "#3A8B84"
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

class BoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background: Optional[str] = None

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

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    card_id: str
    list_id: str
    board_id: str
    title: str
    description: Optional[str] = None
    position: int
    due_date: Optional[datetime] = None
    labels: List[str] = []
    priority: Optional[str] = None  # low, medium, high, urgent
    assigned_members: List[str] = []
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
    labels: List[str] = []
    priority: Optional[str] = None
    assigned_members: List[str] = []

class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None
    list_id: Optional[str] = None
    due_date: Optional[datetime] = None
    labels: Optional[List[str]] = None
    priority: Optional[str] = None
    assigned_members: Optional[List[str]] = None
    cover_image: Optional[str] = None

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

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def get_current_user(request: Request) -> User:
    # Check cookie first, then Authorization header
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
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

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(data.password)
    
    # Check if first user - make them admin
    user_count = await db.users.count_documents({})
    role = UserRole.ADMIN if user_count == 0 else UserRole.NORMAL
    
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
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {"user_id": user_id, "email": data.email, "name": data.name, "role": role}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"sess_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", UserRole.NORMAL),
        "picture": user.get("picture")
    }

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api_router.post("/auth/session")
async def process_oauth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        oauth_data = resp.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": oauth_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update name and picture if changed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": oauth_data["name"], "picture": oauth_data.get("picture")}}
        )
        role = existing_user.get("role", UserRole.NORMAL)
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_count = await db.users.count_documents({})
        role = UserRole.ADMIN if user_count == 0 else UserRole.NORMAL
        
        user_doc = {
            "user_id": user_id,
            "email": oauth_data["email"],
            "name": oauth_data["name"],
            "picture": oauth_data.get("picture"),
            "role": role,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {
        "user_id": user_id,
        "email": oauth_data["email"],
        "name": oauth_data["name"],
        "role": role,
        "picture": oauth_data.get("picture")
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "picture": user.picture
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/", samesite="none", secure=True)
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
    body = await request.json()
    member_email = body.get("email")
    member_role = body.get("role", "member")
    
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only owner can add members")
    
    new_member = await db.users.find_one({"email": member_email}, {"_id": 0})
    if not new_member:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already member
    for m in workspace.get("members", []):
        if m["user_id"] == new_member["user_id"]:
            raise HTTPException(status_code=400, detail="User already a member")
    
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$push": {"members": {"user_id": new_member["user_id"], "role": member_role}}}
    )
    
    return {"message": "Member added"}

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
    return boards

@api_router.get("/boards/{board_id}")
async def get_board(board_id: str, user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"board_id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check workspace access
    workspace = await db.workspaces.find_one(
        {"workspace_id": board["workspace_id"], "members.user_id": user.user_id},
        {"_id": 0}
    )
    if not workspace and not board.get("is_template"):
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
    for k, v in data.model_dump().items():
        if v is not None:
            if k == "due_date" and v:
                update_data[k] = v.isoformat() if hasattr(v, 'isoformat') else v
            else:
                update_data[k] = v
    
    if update_data:
        await db.cards.update_one({"card_id": card_id}, {"$set": update_data})
    
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
    
    await db.cards.delete_one({"card_id": card_id})
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
    await db.cards.update_one(
        {"card_id": card_id},
        {"$set": {"list_id": target_list_id, "position": target_position}}
    )
    
    return {"message": "Card moved"}

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
            await db.cards.update_one(
                {"card_id": card_id, "checklist.item_id": item_id},
                {"$set": {"checklist.$.completed": not item["completed"]}}
            )
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
    
    # Enrich with category info and creator info
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
        "recent_boards": recent_boards
    }

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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
