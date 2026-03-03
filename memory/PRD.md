# Odapto - Kanban Work Management SaaS

## Project Overview
Odapto is a production-grade Kanban-based work management SaaS similar to Trello, built with React + FastAPI + MongoDB.

## Original Problem Statement
Build Odapto with:
- React frontend (Web-first with responsive tablet support)
- FastAPI backend with MongoDB
- Email/Password + Google OAuth authentication
- WebSockets for real-time collaboration
- Local file storage for attachments
- Role-based access control (Admin, Privileged, Normal)
- Workspace and board management
- Template system for reusable board templates
- Admin panel for user management and analytics

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
- [x] **Card Copy functionality** (NEW - Mar 3)
- [x] Pending invites for unregistered users
- [x] Gmail SMTP Email Service
- [x] Secure invitation tokens with 7-day expiration
- [x] Single-use invitation token validation
- [x] Email logs with success/failure tracking
- [x] Admin email logs endpoint
- [x] Admin pending invitations endpoint
- [x] Comment notifications to board members
- [x] Notification system (create, read, mark read)
- [x] Template categories (admin only)
- [x] Board to template publishing (privileged users)
- [x] Template gallery with category filtering
- [x] Use template to create board
- [x] Global search across boards/cards/templates
- [x] Admin analytics endpoint
- [x] WebSocket endpoint for real-time collaboration
- [x] File upload for card attachments and board backgrounds
- [x] **Teams CRUD API** (NEW - Mar 3)
  - Create/update/delete teams
  - Add/remove team members
  - Assign boards to teams
- [x] **Inviter-only member removal** (NEW - Mar 3)
- [x] **Board stats endpoint** - list/card/attachment counts (NEW - Mar 3)

### Frontend (React)
- [x] **New Odapto Logo** (NEW - Mar 3)
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] Workspace page with board grid
- [x] **Enhanced board cards with stats** (NEW - Mar 3)
  - Background image preview
  - List count icon
  - Card count icon
  - Attachment count icon
- [x] Kanban board with drag-drop (hello-pangea/dnd)
- [x] **Notification bell inside BoardPage** (NEW - Mar 3)
- [x] Board member management and invitation
- [x] Board background color/image customization
- [x] **Card action buttons** (NEW - Mar 3)
  - Copy Card
  - Move Card (with list selector dialog)
  - Delete Card
- [x] Enhanced card preview with:
  - Due date color-coding (red=overdue, orange=today, gray=future)
  - Priority badges (Low/Medium/High/Urgent)
  - Named labels with colors
  - Assigned member avatars
  - Attachment count
- [x] Enhanced card detail modal
- [x] Invitation Accept Page
- [x] Template gallery page
- [x] Admin panel with user/category management and analytics
- [x] **Enhanced Profile dropdown** (NEW - Mar 3)
  - Profile
  - Integrations
  - Change Password
  - Help
  - Upgrade Plan
  - Admin Panel (for admins)
  - Log out
- [x] Profile page
- [x] Real-time notification system
- [x] Dark/Light theme support
- [x] Session persistence (localStorage + cookies)
- [x] Toast notifications (sonner)

### Email System
- [x] Gmail SMTP integration with STARTTLS
- [x] Branded email templates with Odapto colors
- [x] Workspace, board, and card invitation emails
- [x] Invitation token generation and validation
- [x] 7-day token expiration
- [x] Single-use token enforcement
- [x] Email send logging

## Prioritized Backlog

### P0 (COMPLETED)
All P0 features completed as of Mar 3, 2026.

### P1 (High Priority - Next)
1. **Workspace organization** - Divide into Invited/Personal/Team boards
2. **Profile photo editing** - Upload, crop, 2MB limit
3. **Attachment previews** - Preview, download, set as cover
4. WebSocket integration for real-time board updates
5. Card activity/history log
6. Board filters (by label, due date, member)

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
5. Feature flags system
6. Advanced analytics dashboard
7. Microsoft OAuth

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, @hello-pangea/dnd
- **Backend**: FastAPI, Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB
- **Auth**: Session tokens + Emergent Google OAuth
- **Email**: Gmail SMTP (smtp.gmail.com:587 with STARTTLS)
- **Storage**: Local file storage (MVP), ready for S3 migration

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
- `/api/search` - Global search
- `/ws/board/{id}` - WebSocket for real-time

### Database Schema
- **users**: user_id, email, password_hash, name, role, picture
- **workspaces**: workspace_id, name, description, owner_id, members
- **teams**: team_id, workspace_id, name, owner_id, members
- **boards**: board_id, workspace_id, team_id, name, background, members, is_template
- **lists**: list_id, board_id, name, position
- **cards**: card_id, list_id, board_id, title, description, due_date, labels, priority, assigned_members, attachments, checklist, comments
- **invitation_tokens**: token, email, invitation_type, target_id, used, expires_at
- **email_logs**: log_id, to_email, subject, success, error

## Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
- **Test Board**: board_8b24ee8c579c
- **Test Workspace**: ws_3a39c12c673e

## Next Tasks
1. Implement workspace board organization (Invited/Personal/Team categories)
2. Add profile photo upload with cropping
3. Add attachment preview, download, and set-as-cover features
4. Implement real-time board sync via WebSockets
5. Add card activity/history log
