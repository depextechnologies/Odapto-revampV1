# Odapto - Kanban Work Management SaaS

## Project Overview
Odapto is a production-grade Kanban-based work management SaaS similar to Trello, built with React + FastAPI + MongoDB.

## What's Been Implemented (Updated Mar 3, 2026)

### Backend (FastAPI)
- [x] Email/Password registration and login
- [x] Google OAuth via Emergent Auth integration
- [x] JWT-like session management with tokens
- [x] Role-based access control middleware
- [x] Workspace CRUD with member management
- [x] Board CRUD with background colors AND images
- [x] Board member invitation with notifications
- [x] List CRUD with position management
- [x] Card CRUD with full features (labels, due dates, checklists, comments)
- [x] Card move between lists endpoint
- [x] Card-level member invitation
- [x] Card Copy functionality
- [x] Gmail SMTP Email Service
- [x] Secure invitation tokens with 7-day expiration
- [x] Notification system
- [x] Template categories and gallery
- [x] Admin analytics endpoint
- [x] WebSocket endpoint for real-time collaboration
- [x] File upload for card attachments and board backgrounds
- [x] **Teams CRUD API** - Create/update/delete teams, manage members
- [x] **Board-Team Assignment** - Assign boards to teams
- [x] **Board Categorization** - personal/team/invited categories
- [x] **Inviter-only member removal**
- [x] **Board stats endpoint** - list/card/attachment counts

### Frontend (React)
- [x] **New Odapto Logo**
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] **Workspace Board Organization** (NEW)
  - [x] **4 Tabs**: All, Personal, Team, Invited
  - [x] **Tab counts** - accurately reflect board counts
  - [x] **Personal tab** - boards created by user without team
  - [x] **Team tab** - boards assigned to teams with team name badge
  - [x] **Invited tab** - boards user was invited to
- [x] **Team Management**
  - [x] Create Team button for workspace owners
  - [x] Create Team dialog with name/description
  - [x] Board creation with team assignment dropdown
- [x] **Enhanced board cards with stats** - list/card/attachment counts
- [x] Kanban board with drag-drop
- [x] **Notification bell inside BoardPage**
- [x] **Card action buttons** - Copy, Move, Delete
- [x] Enhanced card preview with due date colors, priority badges, labels
- [x] Enhanced card detail modal
- [x] Invitation Accept Page
- [x] Template gallery page
- [x] Admin panel
- [x] **Enhanced Profile dropdown** - Profile, Integrations, Change Password, Help, Upgrade, Admin, Logout
- [x] Profile page
- [x] Real-time notification system
- [x] Dark/Light theme support

### Email System
- [x] Gmail SMTP integration with STARTTLS
- [x] Branded email templates
- [x] Workspace, board, and card invitation emails
- [x] Email send logging

## Prioritized Backlog

### P0 (COMPLETED)
All P0 features completed.

### P1 (High Priority - Next)
1. **Profile photo editing** - Upload, crop, 2MB limit
2. **Attachment previews** - Preview, download, set as cover
3. WebSocket integration for real-time board updates
4. Card activity/history log
5. Board filters (by label, due date, member)

### P2 (Medium Priority)
1. Cloud integrations (Google Drive, OneDrive, Dropbox)
2. Board export (JSON/CSV)
3. Card cover images
4. Keyboard shortcuts

### Future (Mobile & Subscription)
1. Android Tablet app (Play Store)
2. iPad app (App Store)
3. Subscription tiers (Free, Pro, Enterprise)
4. Premium templates
5. Advanced analytics dashboard
6. Microsoft OAuth

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, @hello-pangea/dnd
- **Backend**: FastAPI, Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB
- **Auth**: Session tokens + Emergent Google OAuth
- **Email**: Gmail SMTP (smtp.gmail.com:587 with STARTTLS)
- **Storage**: Local file storage (MVP)

### Key API Endpoints
All endpoints prefixed with `/api`:
- `/api/auth/*` - Authentication
- `/api/workspaces/*` - Workspace management
- `/api/workspaces/{id}/teams` - Teams in workspace
- `/api/teams/{id}/*` - Team operations
- `/api/boards/*` - Board operations
- `/api/boards/{id}/team` - Assign board to team
- `/api/lists/*` - List operations
- `/api/cards/*` - Card operations
- `/api/cards/{id}/move` - Move card to another list
- `/api/invitations/{token}` - Get/accept invitation
- `/api/templates` - Template gallery
- `/api/admin/*` - Admin operations

### Database Schema
- **users**: user_id, email, password_hash, name, role, picture
- **workspaces**: workspace_id, name, description, owner_id, members
- **teams**: team_id, workspace_id, name, owner_id, members
- **boards**: board_id, workspace_id, team_id, name, background, members, is_template, category
- **lists**: list_id, board_id, name, position
- **cards**: card_id, list_id, board_id, title, description, due_date, labels, priority, assigned_members, attachments, checklist, comments
- **invitation_tokens**: token, email, invitation_type, target_id, used, expires_at
- **email_logs**: log_id, to_email, subject, success, error

## Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
- **Test Board**: board_8b24ee8c579c
- **Test Workspace**: ws_3a39c12c673e
- **Teams**: Marketing Team, Dev Team

## Next Tasks
1. Add profile photo upload with cropping (2MB limit)
2. Add attachment preview, download, and set-as-cover features
3. Implement real-time board sync via WebSockets
4. Add card activity/history log
5. Add board filters (by label, due date, member)
