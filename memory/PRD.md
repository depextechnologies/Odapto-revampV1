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
- [x] **Template System** (NEW)
  - [x] Template categories CRUD (Admin only)
  - [x] Publish board as template (Privileged/Admin users)
  - [x] Get templates with search/filter
  - [x] Template preview with lists/cards
  - [x] Use template to create board
  - [x] Template stats (lists, cards, usage count)
- [x] Admin analytics endpoint
- [x] File upload for card attachments and board backgrounds
- [x] Teams CRUD API - Create/update/delete teams, manage members
- [x] Board-Team Assignment - Assign boards to teams
- [x] Board Categorization - personal/team/invited categories
- [x] Inviter-only member removal
- [x] Board stats endpoint - list/card/attachment counts
- [x] Real-time WebSocket Sync
  - [x] WebSocket endpoint at `/ws/board/{board_id}`
  - [x] Card create/update/delete/move broadcasts
  - [x] List create/update/delete broadcasts
  - [x] Comment and checklist broadcasts
  - [x] Member assignment broadcasts
- [x] Card Activity Logging
  - [x] `log_card_activity()` helper function
  - [x] GET `/api/cards/{card_id}/activities` endpoint

### Frontend (React)
- [x] New Odapto Logo
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] Workspace Board Organization
  - [x] 4 Tabs: All, Personal, Team, Invited
  - [x] Tab counts - accurately reflect board counts
  - [x] Team badges on team boards
- [x] Team Management
  - [x] Create Team button for workspace owners
  - [x] Board creation with team assignment dropdown
- [x] Enhanced board cards with stats
- [x] Kanban board with drag-drop
- [x] Notification bell inside BoardPage
- [x] Card action buttons - Copy, Move, Delete
- [x] Enhanced card preview with due date colors, priority badges, labels
- [x] Enhanced card detail modal
- [x] Invitation Accept Page
- [x] **Template System** (NEW)
  - [x] Admin Panel > Categories tab for template category management
  - [x] "Publish" button on BoardPage for privileged/admin users
  - [x] Publish dialog with template name, description, category
  - [x] Template Gallery page (`/templates`)
  - [x] Template cards with stats (lists, cards count)
  - [x] Template preview modal with lists/cards structure
  - [x] "Use This Template" button with workspace selection
  - [x] Category filter on Templates page
  - [x] Search functionality
- [x] Admin panel with user management
- [x] Enhanced Profile dropdown
- [x] Profile page
- [x] Dark/Light theme support
- [x] Real-time WebSocket Sync
- [x] Card Activity History

### Email System
- [x] Gmail SMTP integration with STARTTLS
- [x] Branded email templates
- [x] Workspace, board, and card invitation emails
- [x] Email send logging

## Prioritized Backlog

### P0 (COMPLETED)
All P0 features completed.

### P1 (COMPLETED)
- [x] Real-time WebSocket sync
- [x] Card activity/history log
- [x] **Template System** (NEW - COMPLETED)
  - [x] Admin template category management
  - [x] Publish board as template
  - [x] Template Gallery with search/filter
  - [x] Template preview modal

### P2 (Medium Priority - Next)
1. **Profile photo editing** - Upload, crop, 2MB limit ✅ COMPLETED
2. **Attachment previews** - Preview, download, set as cover
3. Cloud integrations (Google Drive, OneDrive, Dropbox)
4. Board export (JSON/CSV)
5. Card cover images
6. Keyboard shortcuts
7. Board filters (by label, due date, member)

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
- **Backend**: FastAPI (Python), Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB
- **Auth**: Session tokens + Emergent Google OAuth
- **Email**: Gmail SMTP (smtp.gmail.com:587 with STARTTLS)
- **Real-time**: WebSockets (FastAPI)
- **Storage**: Local file storage (MVP)

### Key API Endpoints
All endpoints prefixed with `/api`:
- `/api/auth/*` - Authentication
- `/api/workspaces/*` - Workspace management
- `/api/workspaces/{id}/teams` - Teams in workspace
- `/api/teams/{id}/*` - Team operations
- `/api/boards/*` - Board operations
- `/api/boards/{id}/team` - Assign board to team
- `/api/boards/{id}/publish-template` - Publish as template (privileged)
- `/api/lists/*` - List operations
- `/api/cards/*` - Card operations
- `/api/cards/{id}/move` - Move card to another list
- `/api/cards/{id}/activities` - Get card activity history
- `/api/invitations/{token}` - Get/accept invitation
- `/api/templates` - Template gallery
- `/api/templates/{id}` - Template details with lists/cards
- `/api/templates/{id}/use` - Create board from template
- `/api/template-categories` - Template categories (admin)
- `/api/admin/*` - Admin operations
- `/ws/board/{board_id}` - WebSocket for real-time updates

### Database Schema
- **users**: user_id, email, password_hash, name, role, picture
- **workspaces**: workspace_id, name, description, owner_id, members
- **teams**: team_id, workspace_id, name, owner_id, members
- **boards**: board_id, workspace_id, team_id, name, background, members, is_template, template_name, template_description, template_category_id, created_from_template
- **lists**: list_id, board_id, name, position
- **cards**: card_id, list_id, board_id, title, description, due_date, labels, priority, assigned_members, attachments, checklist, comments
- **card_activities**: activity_id, card_id, board_id, user_id, user_name, action, details, created_at
- **template_categories**: category_id, name, description
- **invitation_tokens**: token, email, invitation_type, target_id, used, expires_at
- **email_logs**: log_id, to_email, subject, success, error

## Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
- **Test Workspace**: ws_3a39c12c673e
- **Teams**: Marketing Team, Dev Team
- **Template Categories**: Project Management, Software Development
- **Templates**: Sprint Planning Template, Dev Team Kanban Template

## Next Tasks
1. Add profile photo upload with cropping (2MB limit)
2. Add attachment preview, download, and set-as-cover features
3. Add board filters (by label, due date, member)
4. Implement keyboard shortcuts
