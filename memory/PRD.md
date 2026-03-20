# Odapto - Kanban Work Management SaaS

## Project Overview
Odapto is a production-grade Kanban-based work management SaaS similar to Trello, built with React + FastAPI + MongoDB.

## What's Been Implemented (Updated Mar 20, 2026)

### Authentication
- [x] Email/Password registration and login
- [x] Direct Google OAuth via own Google Cloud credentials (WHITE-LABELED)
- [x] JWT-like session management with tokens
- [x] Role-based access control middleware
- [x] Removed all Emergent-hosted auth references
- [x] Bcrypt crash fix for Google OAuth users attempting email/password login

### Backend
- [x] Workspace CRUD with member management
- [x] Board CRUD with background colors AND images
- [x] Board member invitation with notifications
- [x] List CRUD with position management
- [x] Card CRUD with full features (labels, due dates, checklists, comments)
- [x] Card move between lists endpoint
- [x] Card-level member invitation
- [x] Card Copy functionality
- [x] Card Duplicate endpoint
- [x] Card Cover Image (set/clear)
- [x] Attachment upload, delete, set-as-cover
- [x] Checklist: add, toggle, delete items
- [x] Global Search (boards, cards, templates)
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
- [x] CORS fix - standard CORSMiddleware with allow_origins=["*"]
- [x] Board/Card invite auto-adds user to workspace
- [x] Real-time board activity notifications for all board members
- [x] Email invitations sent to existing users when invited to boards
- [x] Smart Atlas DB detection for production deployment

### Frontend (React)
- [x] New Odapto Logo (light/dark mode)
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] Global Search Component (Cmd+K, debounced, dropdown results)
- [x] Workspace Board Organization (4 Tabs: All, Personal, Team, Invited)
- [x] Team Management
- [x] Kanban board with drag-drop
- [x] Card action buttons - Copy, Move, Delete, Duplicate
- [x] Card cover image display on board preview
- [x] Enhanced card detail modal (attachments, checklists, labels, etc.)
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

### Mobile App (Capacitor)
- [x] Capacitor configured for Android and iOS
- [x] Animated splash screen
- [x] Responsive login UI for mobile/tablet
- [x] MOBILE_BUILD.md with build instructions

## Recent Bug Fixes (Mar 20, 2026)
- [x] Fixed DB_NAME from 'test_database' to 'odapto' (production Atlas auth failure)
- [x] Added smart Atlas DB detection (extracts DB from connection string)
- [x] Fixed bcrypt ValueError: Invalid salt crash for OAuth users
- [x] Fixed SMTP_PASSWORD quoting in .env
- [x] Added _id:0 projection to card attachments query

## Prioritized Backlog

### P0 (CURRENT)
- [ ] Production redeployment to odapto.com (user action needed)
- [ ] Post-deployment sanity check on odapto.com

### P1
- [ ] Mobile Build Guidance (APK/IPA generation)
- [ ] Production end-to-end validation

### P2 (Medium Priority)
1. Board background selection (pre-selected images or upload)
2. Advanced board filters (by label, due date, member)
3. Refactor server.py into modular FastAPI routers
4. Board export (JSON/CSV)
5. Keyboard shortcuts
6. N+1 query optimization (boards, teams, members endpoints)

### Future
1. Subscription tiers (Free, Pro, Enterprise)
2. Premium templates
3. Advanced analytics dashboard
4. Microsoft OAuth
5. Cloud integrations (Google Drive, OneDrive, Dropbox)

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, @hello-pangea/dnd
- **Backend**: FastAPI (Python), Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB (local dev: 'odapto', production: Atlas)
- **Auth**: Direct Google OAuth (own credentials) + Session tokens
- **Email**: Gmail SMTP (smtp.gmail.com:587 with STARTTLS)
- **Real-time**: WebSockets (FastAPI)
- **Mobile**: Capacitor (Android/iOS)

### Key API Endpoints
All endpoints prefixed with `/api`:
- `/api/auth/*` - Authentication (login, register, session, logout, google)
- `/api/workspaces/*` - Workspace management
- `/api/teams/*` - Team operations
- `/api/boards/*` - Board operations
- `/api/lists/*` - List operations
- `/api/cards/*` - Card operations
- `/api/search?q=term` - Global search
- `/api/templates` - Template gallery
- `/api/admin/*` - Admin operations
- `/ws/board/{board_id}` - WebSocket for real-time updates

### Database Schema
- **users**: user_id, email, password_hash, name, role, picture
- **workspaces**: workspace_id, name, description, owner_id, members
- **teams**: team_id, workspace_id, name, owner_id, members
- **boards**: board_id, workspace_id, team_id, name, background, members
- **lists**: list_id, board_id, name, position
- **cards**: card_id, list_id, board_id, title, description, due_date, labels, priority, assigned_members, attachments, checklist, comments, cover_image
- **card_activities**: activity_id, card_id, board_id, user_id, action, details
- **notifications**: notification_id, user_id, type, title, message, read
- **invitation_tokens**: token, email, invitation_type, target_id, used, expires_at

## Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
