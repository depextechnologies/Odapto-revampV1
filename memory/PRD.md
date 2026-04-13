# Odapto - Kanban Work Management SaaS

## Project Overview
Odapto is a production-grade Kanban-based work management SaaS similar to Trello, built with React + FastAPI + MongoDB.

## What's Been Implemented

### Authentication
- [x] Email/Password registration and login
- [x] Direct Google OAuth via own Google Cloud credentials (WHITE-LABELED)
- [x] JWT-like session management with tokens
- [x] Role-based access control middleware
- [x] Bcrypt crash fix for Google OAuth users attempting email/password login
- [x] Descriptive error messages for login/register failures
- [x] X-Error-Detail header for reliable error message delivery
- [x] Google user vs manual user conflict detection

### Backend
- [x] Workspace CRUD with member management
- [x] Board CRUD with background colors AND images
- [x] Board member invitation with notifications
- [x] Board members endpoint with is_owner and role_label fields
- [x] List CRUD with position management
- [x] Card CRUD with full features (labels, due dates, checklists, comments)
- [x] Card move, copy, duplicate, cover image
- [x] Attachment upload, delete, set-as-cover
- [x] Checklist: add, toggle, delete items
- [x] Global Search (boards, cards, templates)
- [x] Gmail SMTP Email Service
- [x] Secure invitation tokens with 7-day expiration
- [x] Notification system
- [x] Template System (categories, publish, gallery, preview, use)
- [x] Admin analytics endpoint
- [x] Teams CRUD API
- [x] Board-Team Assignment & Categorization
- [x] Real-time WebSocket Sync
- [x] Card Activity Logging
- [x] CORS with X-Error-Detail header exposure
- [x] Smart Atlas DB detection for production deployment
- [x] Comprehensive auth logging

### Frontend (React)
- [x] ThemeLogo component (dark/light mode aware) on all pages
- [x] Login/Register with consistent logo sizing
- [x] Descriptive error toasts (reads X-Error-Detail header)
- [x] Board members show "Board owner" / "Board member" labels
- [x] Dashboard with workspace listing and notification bell
- [x] Global Search (Cmd+K)
- [x] Kanban board with drag-drop
- [x] Enhanced card detail modal
- [x] Template gallery, preview, use, publish
- [x] Admin panel, Profile page, Dark/Light theme
- [x] Static pages: Integrations, Help, Upgrade, Privacy, Terms

### Mobile App (Capacitor)
- [x] Capacitor configured for Android and iOS
- [x] Animated splash screen
- [x] Responsive login UI for mobile/tablet
- [x] Android Debug APK generated (com.odapto.app, 6.7MB, points to https://odapto.com)
- [x] Download endpoint: /api/download/android

## Bug Fixes Applied (Latest)
- [x] Fix 1: Logo consistency - ThemeLogo on login/register pages
- [x] Fix 2: Login error message - "Your email id or password is incorrect..."
- [x] Fix 3: Gmail+manual conflict - "This email is already registered with Google..."
- [x] Fix 4: Members identification - "Board owner" / "Board member" labels
- [x] X-Error-Detail header system for reliable error delivery
- [x] .gitignore cleanup (removed *.env blocking for deployment)
- [x] Smart DB selection using get_default_database() for Atlas
- [x] LOGO_URL undefined fix in TemplatesPage.js (replaced with ResponsiveLogo)

## Prioritized Backlog

### P0 (Completed) - Medium Effort Items from Bug List
- [x] Admin Template Control (edit/delete any templates) - Feb 2026
- [x] Privilege User Template Permissions (creators can edit/delete own) - Feb 2026
- [x] Board Creation Template Preview (preview dialog with lists/cards) - Feb 2026
- [x] Remember User Login (web: localStorage vs sessionStorage, checkbox on login) - Feb 2026
- [x] Admin Panel Template Management tab (clickable stat cards, category drill-down, table with edit/delete/preview) - Apr 2026
- [x] Admin Template Board Editing (full Kanban editor for templates — add/edit/delete lists, cards, attachments via check_board_access helper) - Apr 2026
- [x] Gmail Auth Flow (mobile return to app after Google OAuth via Capacitor Browser plugin + deep linking) - Apr 2026

### P1 (Completed) - High Effort Items from Bug List
- [x] Real-time Collaboration: WebSocket broadcast for comments, file uploads, member additions, card moves, attachments, board updates (18 event types) - Apr 2026
- [x] Cloud Storage: Google Drive integration (OAuth connect/disconnect, file browsing, attach to cards) - Apr 2026
- [x] Cloud Storage: Dropbox integration (OAuth connect/disconnect, file browsing, attach to cards, sharing links) - Apr 2026
- [x] Integrations Page: functional with connect/disconnect for Google Drive & Dropbox, Coming Soon for OneDrive - Apr 2026
- [x] Emergent Object Storage: Cloud files (Drive/Dropbox) downloaded and stored locally for cover image use - Apr 2026
- [x] Android APK Generation: Debug APK built with Capacitor, configured for production (odapto.com) - Apr 2026

### P2 - Future
- [ ] Cloud Storage: Dropbox, OneDrive (user will provide OAuth keys)
- [ ] Board background customization (pre-selected images/upload)
- [ ] Advanced board filters (by label, due date, member)
- [ ] Refactor server.py into modular FastAPI routers
- [ ] Board export (JSON/CSV), keyboard shortcuts
- [ ] Subscription tiers & monetization

## Technical Architecture

### Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, @hello-pangea/dnd
- **Backend**: FastAPI, Motor (async MongoDB), bcrypt, httpx
- **Database**: MongoDB (local: test_database, production: Atlas via get_default_database)
- **Auth**: Direct Google OAuth + Session tokens
- **Email**: Gmail SMTP
- **Real-time**: WebSockets (FastAPI)
- **Mobile**: Capacitor 6 (Android/iOS), Gradle 8.7, AGP 8.3.2, Android SDK 34
- **Object Storage**: Emergent Object Storage (for cloud file persistence)

### Key Files
- `/app/backend/server.py` - Main backend (monolith)
- `/app/frontend/src/context/AuthContext.js` - Auth state management
- `/app/frontend/src/config.js` - API URL configuration
- `/app/frontend/src/components/ThemeLogo.js` - Theme-aware logo

### Test Credentials
- **Admin**: odapto.admin@emergent.com / SecurePassword123!
