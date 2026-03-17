# Odapto Deployment Guide - odapto.com

## Google OAuth Configuration

### Google Cloud Console Settings
Go to: https://console.cloud.google.com/apis/credentials

**OAuth 2.0 Client ID:** `1066884375701-mkm1of8qe6miibn0t7tffg91fm3188q5.apps.googleusercontent.com`

**Authorized redirect URIs** (add these in Google Cloud Console):
```
https://odapto.com/auth/google/callback
```

**Authorized JavaScript origins:**
```
https://odapto.com
```

### Backend Environment Variables
Add/update these in your production `backend/.env`:
```
GOOGLE_CLIENT_ID=1066884375701-mkm1of8qe6miibn0t7tffg91fm3188q5.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
FRONTEND_URL=https://odapto.com
```

### Frontend Configuration
Update `frontend/src/config.js`:
```javascript
const PRODUCTION_URL = 'https://odapto.com';
```

Update `frontend/.env.production`:
```
REACT_APP_BACKEND_URL=https://odapto.com
```

---

## OAuth Flow (How it works)

1. User clicks "Continue with Google" on login page
2. Frontend redirects to `https://odapto.com/api/auth/google`
3. Backend builds Google OAuth URL and redirects (307) to `accounts.google.com`
4. User authenticates with Google
5. Google redirects to `https://odapto.com/auth/google/callback?code=xxx`
6. Frontend `GoogleAuthCallback` component extracts the `code`
7. Frontend POSTs `code` to `https://odapto.com/api/auth/google/callback`
8. Backend exchanges code with Google for access token
9. Backend fetches user info (email, name, picture) from Google
10. Backend creates/updates user in MongoDB, creates session
11. Frontend stores session token and redirects to dashboard

---

## Email / SMTP Configuration
Ensure these are set in `backend/.env` for email invitations:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<your-gmail>
SMTP_PASSWORD=<your-app-password>
SMTP_FROM_EMAIL=<your-from-email>
```

---

## Build & Deploy Checklist

1. Update `frontend/src/config.js` → `PRODUCTION_URL = 'https://odapto.com'`
2. Update `frontend/.env.production` → `REACT_APP_BACKEND_URL=https://odapto.com`
3. Update `backend/.env` → `FRONTEND_URL=https://odapto.com`
4. Verify Google Cloud Console has `https://odapto.com/auth/google/callback` as authorized redirect URI
5. Run `cd frontend && yarn build`
6. Deploy backend and frontend
7. Test: Email/password login, Google OAuth login, board notifications

---

## Mobile Build (after deploying to odapto.com)
```bash
cd frontend
# Config already points to odapto.com after step 1 above
yarn build
npx cap sync
npx cap open android   # For Android APK
npx cap open ios       # For iOS IPA
```
