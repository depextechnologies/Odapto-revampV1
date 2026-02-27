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

## User Personas

### Admin User
- Full system access
- Can manage all users and roles
- Can create/manage template categories
- View platform analytics
- First registered user becomes admin

### Privileged User
- Can create workspaces and boards
- Can publish boards as templates
- Access to template gallery

### Normal User
- Can create workspaces and boards
- Can use templates from gallery
- Cannot publish templates

## Core Requirements (Static)
1. **Authentication**: Email/password + Google OAuth via Emergent Auth
2. **Role-based Access**: Admin, Privileged, Normal user roles
3. **Workspaces**: Multi-workspace support with member management
4. **Kanban Boards**: Drag-and-drop lists and cards
5. **Card Features**: Description, due dates, labels, checklists, comments
6. **Templates**: Public template gallery with categories
7. **Admin Panel**: User management, analytics, category management

## What's Been Implemented (MVP - Feb 27, 2026)

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

### Frontend (React)
- [x] Landing page with Odapto branding
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with workspace listing and notification bell
- [x] Workspace page with board grid
- [x] Kanban board with drag-drop (hello-pangea/dnd)
- [x] Board member management and invitation
- [x] Board background color/image customization
- [x] Card detail modal with full editing
- [x] Template gallery page
- [x] Admin panel with user/category management and analytics
- [x] Profile page
- [x] Real-time notification system
- [x] Dark/Light theme support
- [x] Session persistence (localStorage + cookies)
- [x] Toast notifications (sonner)

### Design
- Odapto branding with logo colors (Orange #E67E4C, Teal #3A8B84)
- Outfit font for headings, Inter for body
- Clean enterprise-grade UI
- Responsive tablet-friendly design

## Prioritized Backlog

### P0 (Critical - Next Phase)
1. WebSocket integration for real-time board updates
2. Card drag-and-drop animations optimization
3. Board background image customization
4. Email notifications for due dates

### P1 (High Priority)
1. Member invitation to workspaces
2. Card cover images
3. Activity log/history on cards
4. Board filters (by label, due date, member)
5. Keyboard shortcuts

### P2 (Medium Priority)
1. Board export (JSON/CSV)
2. Card attachments preview
3. Checklist progress visualization
4. Board templates preview before use
5. User avatar upload

### Future (Subscription-Ready)
1. Subscription tiers (Free, Pro, Enterprise)
2. Premium templates
3. Feature flags system
4. Workspace-based billing
5. Advanced analytics dashboard

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, Framer Motion, @hello-pangea/dnd
- **Backend**: FastAPI, Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB
- **Auth**: Session tokens + Emergent Google OAuth
- **Storage**: Local file storage (MVP), ready for S3 migration

### API Endpoints
All endpoints prefixed with `/api`:
- `/api/auth/*` - Authentication
- `/api/workspaces/*` - Workspace management
- `/api/boards/*` - Board operations
- `/api/lists/*` - List operations
- `/api/cards/*` - Card operations
- `/api/templates` - Template gallery
- `/api/template-categories` - Admin category management
- `/api/admin/*` - Admin operations
- `/api/search` - Global search
- `/ws/board/{board_id}` - WebSocket for real-time

## Next Tasks
1. Implement real-time board sync via WebSockets
2. Add board filters and search within boards
3. Enhance card detail with file preview
4. Add member invitation flow
5. Implement email notifications
