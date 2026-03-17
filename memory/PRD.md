# Odapto - Kanban Work Management SaaS

## Project Overview
Odapto is a production-grade Kanban-based work management SaaS similar to Trello, built with React + FastAPI + MongoDB.

## What's Been Implemented (Updated Mar 13, 2026)

### Authentication
- [x] Email/Password registration and login
- [x] Direct Google OAuth via own Google Cloud credentials (WHITE-LABELED)
- [x] JWT-like session management with tokens
- [x] Role-based access control middleware
- [x] Removed all Emergent-hosted auth references
- [x] Workspace CRUD with member management
- [x] Board CRUD with background colors AND images
- [x] Board member invitation with notifications
- [x] List CRUD with position management
- [x] Card CRUD with full features (labels, due dates, checklists, comments)
- [x] Card move between lists endpoint
- [x] Card-level member invitation
- [x] Card Copy functionality
- [x] Card Duplicate endpoint (NEW)
- [x] Card Cover Image (set/clear) (NEW)
- [x] Attachment upload, delete, set-as-cover (NEW)
- [x] Checklist: add, toggle, delete items (NEW)
- [x] Global Search (boards, cards, templates) (NEW)
- [x] Gmail SMTP Email Service
- [x] Secure invitation tokens with 7-day expiration
- [x] Notification system
- [x] Template System (categories, publish, gallery, preview, use)
- [x] Admin analytics endpoint
- [x] File upload for card attachments and board backgrounds
- [x] Teams CRUD API
- [x] Board-Team Assignment
- [x] Board Categorization
- [x] Real-time WebSocket Sync
- [x] Card Activity Logging
- [x] CORS fix - standard CORSMiddleware with allow_origins=["*"], no credentials (NEW)
- [x] Board/Card invite auto-adds user to workspace (BUG FIX - invited users now see workspaces)
- [x] Real-time board activity notifications for all board members (comments, attachments, checklist, etc.)
- [x] Email invitations sent to existing users when invited to boards

### Frontend (React)
- [x] New Odapto Logo (light/dark mode)
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] Global Search Component (Cmd+K, debounced, dropdown results) (NEW)
- [x] Workspace Board Organization (4 Tabs: All, Personal, Team, Invited)
- [x] Team Management
- [x] Kanban board with drag-drop
- [x] Card action buttons - Copy, Move, Delete, Duplicate (NEW)
- [x] Card cover image display on board preview (NEW)
- [x] Enhanced card detail modal with:
  - Attachments (upload, preview, download, delete, set as cover) (NEW)
  - Checklists (add, toggle, delete items) (NEW)
  - Duplicate Card button (NEW)
  - Labels, due dates, priority, comments, member invite
  - Activity history
- [x] Template System (gallery, preview, use, publish)
- [x] Admin panel with user management
- [x] Profile page with photo upload
- [x] Dark/Light theme support
- [x] Real-time WebSocket Sync
- [x] Static pages: Integrations, Help, Upgrade, Privacy, Terms

### Email System
- [x] Gmail SMTP integration with STARTTLS
- [x] Branded email templates
- [x] Workspace, board, and card invitation emails

## Prioritized Backlog

### P0 (COMPLETED)
All P0 features completed including CORS fix.

### P1 (COMPLETED)
- [x] Real-time WebSocket sync
- [x] Card activity/history log
- [x] Template System
- [x] Attachment functionality (upload, delete, set-as-cover)
- [x] Checklists on Cards (add, toggle, delete)
- [x] Card Duplication
- [x] Global Search
- [x] Card Cover Image

### P2 (Medium Priority - Next)
1. Board background selection (pre-selected images or upload)
2. Cloud integrations (Google Drive, OneDrive, Dropbox)
3. Board export (JSON/CSV)
4. Keyboard shortcuts
5. Board filters (by label, due date, member)
6. Refactor `server.py` into modular FastAPI routers

### Mobile App (Capacitor - READY FOR BUILD)
- [x] Capacitor configured for Android and iOS (com.odapto.app v1.0.0)
- [x] Animated splash screen (7s video on white background) -> Login flow
- [x] Native splash screen config (white bg, immersive)
- [x] App icon and splash logo generated (resources/)
- [x] Backend URL configurable for production (config.js PRODUCTION_URL)
- [x] Responsive login screen (mobile single-column, tablet split-view)
- [x] Comprehensive MOBILE_BUILD.md with Android/iOS build instructions
- [ ] User to build APK locally (Android Studio + `yarn build && npx cap sync`)
- [ ] User to build IPA locally (Xcode + `yarn build && npx cap sync`)

### Future (Subscription & Advanced)
1. Android Tablet app (Play Store) - Capacitor configured
2. iPad app (App Store) - Capacitor configured
3. Subscription tiers (Free, Pro, Enterprise)
4. Premium templates
5. Advanced analytics dashboard
6. Microsoft OAuth

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, @hello-pangea/dnd
- **Backend**: FastAPI (Python), Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB
- **Auth**: Direct Google OAuth (own credentials) + Session tokens
- **Email**: Gmail SMTP (smtp.gmail.com:587 with STARTTLS)
- **Real-time**: WebSockets (FastAPI)
- **Storage**: Local file storage (MVP)
- **Mobile**: Capacitor (Android/iOS)

### Key API Endpoints
All endpoints prefixed with `/api`:
- `/api/auth/*` - Authentication (login, register, session, logout)
- `/api/workspaces/*` - Workspace management
- `/api/teams/*` - Team operations
- `/api/boards/*` - Board operations
- `/api/lists/*` - List operations
- `/api/cards/*` - Card operations
- `/api/cards/{id}/duplicate` - Duplicate card (NEW)
- `/api/cards/{id}/cover` - Set card cover (NEW)
- `/api/cards/{id}/attachments` - Upload attachment
- `/api/cards/{id}/attachments/{file_id}` - Delete attachment (NEW)
- `/api/cards/{id}/checklist` - Add/toggle/delete checklist items
- `/api/search?q=term` - Global search (NEW)
- `/api/templates` - Template gallery
- `/api/admin/*` - Admin operations
- `/ws/board/{board_id}` - WebSocket for real-time updates

### Database Schema
- **users**: user_id, email, password_hash, name, role, picture
- **workspaces**: workspace_id, name, description, owner_id, members
- **teams**: team_id, workspace_id, name, owner_id, members
- **boards**: board_id, workspace_id, team_id, name, background, members, template fields
- **lists**: list_id, board_id, name, position
- **cards**: card_id, list_id, board_id, title, description, due_date, labels, priority, assigned_members, attachments, checklist, comments, cover_image
- **card_activities**: activity_id, card_id, board_id, user_id, action, details
- **template_categories**: category_id, name, description
- **invitation_tokens**: token, email, invitation_type, target_id, used, expires_at

## Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
