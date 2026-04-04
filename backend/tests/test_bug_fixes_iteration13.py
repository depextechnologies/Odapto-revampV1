"""
Bug Fixes Tests - Iteration 13
Tests for 4 quick fixes from user's bug list:
1) Logo consistency (frontend test)
2) Better login error messages with X-Error-Detail header
3) Gmail+manual registration conflict messages
4) Board member identification (owner vs member labels)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"
GOOGLE_USER_EMAIL = "google_user@test.com"  # Google OAuth user with no password_hash


class TestLoginErrorMessages:
    """Test improved login error messages with X-Error-Detail header"""

    def test_login_wrong_password_returns_descriptive_error(self):
        """POST /api/auth/login with wrong password returns descriptive error in X-Error-Detail header"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "WrongPassword123!"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Check X-Error-Detail header
        error_detail = response.headers.get('X-Error-Detail', '')
        expected_msg = "Your email id or password is incorrect, please try again with correct credentials"
        assert expected_msg in error_detail, f"Expected '{expected_msg}' in X-Error-Detail, got: '{error_detail}'"
        
        # Also check response body
        data = response.json()
        assert expected_msg in data.get('detail', ''), f"Expected '{expected_msg}' in body, got: {data}"
        
        print(f"✅ Wrong password returns descriptive error: '{error_detail}'")

    def test_login_nonexistent_user_returns_descriptive_error(self):
        """POST /api/auth/login for non-existent user returns same descriptive error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent_user_12345@example.com", "password": "anypassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Check X-Error-Detail header
        error_detail = response.headers.get('X-Error-Detail', '')
        expected_msg = "Your email id or password is incorrect, please try again with correct credentials"
        assert expected_msg in error_detail, f"Expected '{expected_msg}' in X-Error-Detail, got: '{error_detail}'"
        
        print(f"✅ Non-existent user returns descriptive error: '{error_detail}'")

    def test_login_google_oauth_user_returns_google_signin_message(self):
        """POST /api/auth/login for Google OAuth user returns 'use Continue with Google' message"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": GOOGLE_USER_EMAIL, "password": "anypassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Check X-Error-Detail header
        error_detail = response.headers.get('X-Error-Detail', '')
        expected_msg = "This account was registered with Google. Please use 'Continue with Google' to sign in."
        assert expected_msg in error_detail, f"Expected '{expected_msg}' in X-Error-Detail, got: '{error_detail}'"
        
        print(f"✅ Google OAuth user login returns: '{error_detail}'")


class TestRegisterErrorMessages:
    """Test improved registration error messages"""

    def test_register_existing_email_returns_descriptive_error(self):
        """POST /api/auth/register with existing email returns descriptive error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": ADMIN_EMAIL,
                "password": "AnyPassword123!",
                "name": "Duplicate User"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        # Check X-Error-Detail header
        error_detail = response.headers.get('X-Error-Detail', '')
        expected_msg = "This email is already registered. Please try with a different email or sign in to your existing account."
        assert expected_msg in error_detail, f"Expected '{expected_msg}' in X-Error-Detail, got: '{error_detail}'"
        
        print(f"✅ Existing email registration returns: '{error_detail}'")

    def test_register_google_oauth_email_returns_google_signin_message(self):
        """POST /api/auth/register with Google OAuth user email returns 'use Continue with Google' message"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": GOOGLE_USER_EMAIL,
                "password": "AnyPassword123!",
                "name": "Google User Duplicate"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        # Check X-Error-Detail header
        error_detail = response.headers.get('X-Error-Detail', '')
        expected_msg = "This email is already registered with Google. Please use 'Continue with Google' to sign in."
        assert expected_msg in error_detail, f"Expected '{expected_msg}' in X-Error-Detail, got: '{error_detail}'"
        
        print(f"✅ Google OAuth email registration returns: '{error_detail}'")


class TestBoardMembersEndpoint:
    """Test board members endpoint with is_owner and role_label fields"""

    def get_admin_session_and_board(self):
        """Helper to get admin session and an existing board"""
        # Login
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_resp.status_code != 200:
            return None, None
        session_token = login_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {session_token}"}
        
        # Get existing workspaces
        ws_resp = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        if ws_resp.status_code != 200 or not ws_resp.json():
            return session_token, None
        
        workspace_id = ws_resp.json()[0]["workspace_id"]
        
        # Get boards in workspace
        boards_resp = requests.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards", headers=headers)
        if boards_resp.status_code != 200 or not boards_resp.json():
            return session_token, None
        
        return session_token, boards_resp.json()[0]["board_id"]

    def test_board_members_returns_is_owner_field(self):
        """GET /api/boards/{board_id}/members returns is_owner field"""
        session_token, board_id = self.get_admin_session_and_board()
        if not session_token or not board_id:
            pytest.skip("Could not get admin session or board")
        
        response = requests.get(
            f"{BASE_URL}/api/boards/{board_id}/members",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        members = response.json()
        assert isinstance(members, list), f"Expected list, got {type(members)}"
        assert len(members) > 0, "Expected at least one member (the owner)"
        
        # Check first member has is_owner field
        first_member = members[0]
        assert "is_owner" in first_member, f"Member missing 'is_owner' field: {first_member}"
        assert isinstance(first_member["is_owner"], bool), f"is_owner should be boolean: {first_member['is_owner']}"
        
        print(f"✅ Board members endpoint returns is_owner field: {first_member['is_owner']}")

    def test_board_members_returns_role_label_field(self):
        """GET /api/boards/{board_id}/members returns role_label field"""
        session_token, board_id = self.get_admin_session_and_board()
        if not session_token or not board_id:
            pytest.skip("Could not get admin session or board")
        
        response = requests.get(
            f"{BASE_URL}/api/boards/{board_id}/members",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        members = response.json()
        assert len(members) > 0, "Expected at least one member"
        
        # Check first member has role_label field
        first_member = members[0]
        assert "role_label" in first_member, f"Member missing 'role_label' field: {first_member}"
        assert first_member["role_label"] in ["Board owner", "Board member"], \
            f"Unexpected role_label: {first_member['role_label']}"
        
        print(f"✅ Board members endpoint returns role_label: '{first_member['role_label']}'")

    def test_board_owner_has_correct_labels(self):
        """Board owner should have is_owner=True and role_label='Board owner'"""
        session_token, board_id = self.get_admin_session_and_board()
        if not session_token or not board_id:
            pytest.skip("Could not get admin session or board")
        
        response = requests.get(
            f"{BASE_URL}/api/boards/{board_id}/members",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        
        members = response.json()
        
        # Find the owner (should be first due to sorting)
        owner = next((m for m in members if m.get("is_owner")), None)
        assert owner is not None, "No owner found in members list"
        assert owner["is_owner"] == True, f"Owner's is_owner should be True: {owner}"
        assert owner["role_label"] == "Board owner", f"Owner's role_label should be 'Board owner': {owner['role_label']}"
        
        print(f"✅ Board owner has correct labels: is_owner=True, role_label='Board owner'")

    def test_board_owner_appears_first_in_list(self):
        """Board owner should appear first in the members list"""
        session_token, board_id = self.get_admin_session_and_board()
        if not session_token or not board_id:
            pytest.skip("Could not get admin session or board")
        
        response = requests.get(
            f"{BASE_URL}/api/boards/{board_id}/members",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        
        members = response.json()
        assert len(members) > 0, "Expected at least one member"
        
        # First member should be the owner
        first_member = members[0]
        assert first_member.get("is_owner") == True, \
            f"First member should be the owner (is_owner=True), got: {first_member}"
        
        print(f"✅ Board owner appears first in members list")


class TestLoginSuccessFlow:
    """Test that login with correct credentials still works"""

    def test_login_with_correct_credentials_works(self):
        """POST /api/auth/login with correct credentials returns 200 and session_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "session_token" in data, "Response missing session_token"
        assert "user_id" in data, "Response missing user_id"
        assert "email" in data, "Response missing email"
        assert data["email"] == ADMIN_EMAIL, f"Email mismatch: {data['email']}"
        
        print(f"✅ Login with correct credentials works: {data['email']}")

    def test_login_session_can_access_protected_routes(self):
        """After login, session token can access protected routes like /api/auth/me"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        session_token = login_response.json()["session_token"]
        
        # Access protected route
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.status_code}"
        
        me_data = me_response.json()
        assert me_data["email"] == ADMIN_EMAIL
        
        print(f"✅ Session token can access protected routes")


class TestCORSExposesErrorHeader:
    """Test that CORS exposes X-Error-Detail header"""

    def test_cors_exposes_x_error_detail_header(self):
        """CORS should expose X-Error-Detail header for frontend to read"""
        # Make a request that will fail to check headers
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"}
        )
        
        # Check that X-Error-Detail is in the response headers
        assert 'X-Error-Detail' in response.headers, \
            f"X-Error-Detail header not found in response. Headers: {dict(response.headers)}"
        
        print(f"✅ X-Error-Detail header is present in error responses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
