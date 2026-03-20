"""
Auth Flow Tests for Odapto
Tests login, register, Google OAuth edge cases, and /api/auth/me endpoint
Focus: Bug fixes for DB_NAME change and bcrypt crash for Google OAuth users
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"
GOOGLE_USER_EMAIL = "google_user@test.com"  # Google OAuth user with no password_hash


class TestHealthEndpoint:
    """Health check endpoint tests - verify basic connectivity"""

    def test_health_returns_200(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        print("✅ Health endpoint returns healthy status")


class TestLoginEndpoint:
    """Login endpoint tests - /api/auth/login"""

    def test_login_with_valid_credentials(self):
        """POST /api/auth/login with valid credentials should return user data and session_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert "name" in data, "Response missing name"
        assert "session_token" in data, "Response missing session_token"
        assert data["email"] == ADMIN_EMAIL, f"Email mismatch: {data['email']}"
        assert data["session_token"].startswith("sess_"), f"Invalid session_token format: {data['session_token']}"
        
        print(f"✅ Login successful for {ADMIN_EMAIL}, session_token starts with sess_")
        return data["session_token"]

    def test_login_with_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        print("✅ Invalid credentials correctly return 401 Unauthorized")

    def test_login_with_wrong_password(self):
        """POST /api/auth/login with correct email but wrong password should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "WrongPassword123!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Wrong password correctly returns 401")

    def test_login_google_oauth_user_no_password_returns_401_not_500(self):
        """
        POST /api/auth/login with Google OAuth user (no password) should return 401, NOT 500
        This tests the bcrypt fix - previously crashed with 'Invalid salt'
        """
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": GOOGLE_USER_EMAIL, "password": "anypassword"}
        )
        # Should be 401 (invalid credentials), NOT 500 (server error)
        assert response.status_code in [401, 404], \
            f"Expected 401 or 404, got {response.status_code}: {response.text}"
        
        # Verify it's not a 500 Internal Server Error
        assert response.status_code != 500, \
            "BUG: Login with Google OAuth user still crashes with 500 error (bcrypt fix not applied)"
        
        print("✅ Google OAuth user login attempt returns 401/404 (not 500 crash)")


class TestRegisterEndpoint:
    """Register endpoint tests - /api/auth/register"""

    def test_register_new_user(self):
        """POST /api/auth/register with new user should return user data and session_token"""
        unique_email = f"TEST_register_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPassword123!",
                "name": "Test Register User"
            }
        )
        assert response.status_code == 200, f"Registration failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert "name" in data, "Response missing name"
        assert "session_token" in data, "Response missing session_token"
        assert data["email"] == unique_email, f"Email mismatch: {data['email']}"
        
        print(f"✅ New user registered: {unique_email}")
        return data

    def test_register_existing_email(self):
        """POST /api/auth/register with existing email should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": ADMIN_EMAIL,
                "password": "AnyPassword123!",
                "name": "Duplicate User"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        assert "already registered" in data["detail"].lower(), f"Unexpected error message: {data['detail']}"
        
        print("✅ Duplicate email correctly returns 400 Bad Request")


class TestAuthMeEndpoint:
    """Auth/me endpoint tests - /api/auth/me"""

    def test_auth_me_with_valid_token(self):
        """GET /api/auth/me with valid session token should return user info"""
        # First login to get a token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        session_token = login_response.json()["session_token"]
        
        # Now test /api/auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert "name" in data, "Response missing name"
        assert data["email"] == ADMIN_EMAIL, f"Email mismatch: {data['email']}"
        
        print(f"✅ Auth/me returns correct user: {data['email']}")

    def test_auth_me_with_invalid_token(self):
        """GET /api/auth/me with invalid token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_session_token_12345"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Invalid token correctly returns 401 Unauthorized")

    def test_auth_me_without_token(self):
        """GET /api/auth/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ Missing token correctly returns 401 Unauthorized")


class TestGoogleOAuthEndpoints:
    """Google OAuth endpoint tests - verify proper configuration"""

    def test_google_oauth_initiation(self):
        """GET /api/auth/google should redirect to accounts.google.com"""
        response = requests.get(
            f"{BASE_URL}/api/auth/google",
            allow_redirects=False
        )
        # Should return 307 redirect
        assert response.status_code == 307, f"Expected 307, got {response.status_code}: {response.text}"
        
        location = response.headers.get("location", "")
        assert "accounts.google.com" in location, \
            f"OAuth redirect should go to accounts.google.com, got: {location}"
        assert "auth.emergentagent.com" not in location, \
            f"OAuth redirect should NOT go to auth.emergentagent.com: {location}"
        
        print(f"✅ Google OAuth redirects to accounts.google.com")

    def test_google_callback_without_code(self):
        """POST /api/auth/google/callback without code should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/callback",
            json={"redirect_uri": "https://example.com/callback"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing error detail"
        
        print("✅ Google callback without code returns 400 Bad Request")

    def test_google_callback_with_invalid_code(self):
        """POST /api/auth/google/callback with invalid code should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/callback",
            json={
                "code": "invalid_auth_code_12345",
                "redirect_uri": "https://example.com/callback"
            }
        )
        # Should return 401 (failed to exchange code)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        
        print("✅ Google callback with invalid code returns 401")


class TestLoginRegisterThenVerify:
    """Integration tests: Login/Register then verify with /api/auth/me"""

    def test_register_then_verify_session(self):
        """Register a new user, then verify session with /api/auth/me"""
        unique_email = f"TEST_verify_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "VerifyTest123!",
                "name": "Verify Test User"
            }
        )
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        reg_data = reg_response.json()
        session_token = reg_data["session_token"]
        
        # Verify with /api/auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        me_data = me_response.json()
        
        assert me_data["email"] == unique_email, f"Email mismatch: {me_data['email']}"
        assert me_data["user_id"] == reg_data["user_id"], f"User ID mismatch"
        
        print(f"✅ Register→Verify flow works: {unique_email}")

    def test_login_then_verify_session(self):
        """Login as admin, then verify session with /api/auth/me"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        session_token = login_data["session_token"]
        
        # Verify with /api/auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        me_data = me_response.json()
        
        assert me_data["email"] == ADMIN_EMAIL, f"Email mismatch: {me_data['email']}"
        assert me_data["user_id"] == login_data["user_id"], f"User ID mismatch"
        
        print(f"✅ Login→Verify flow works: {ADMIN_EMAIL}")


# Pytest fixtures
@pytest.fixture(scope="module")
def admin_session():
    """Get admin session token for authenticated requests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["session_token"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
