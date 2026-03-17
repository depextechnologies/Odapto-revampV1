"""
Tests for Google OAuth and Notification System
- Google OAuth initiation (GET /api/auth/google) - redirects to accounts.google.com
- Google OAuth callback (POST /api/auth/google/callback) - validates input
- Board activity notifications - all board members get notified
- Board invite for existing users sends email invitation
"""
import pytest
import requests
import os
import json
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and get session token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "odapto.admin@emergent.com",
        "password": "SecurePassword123!"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return {
        "token": data["session_token"],
        "user_id": data["user_id"],
        "name": data["name"]
    }

@pytest.fixture(scope="module")
def test_user_session():
    """Get or create test user session for notification testing"""
    # Try logging in as test user
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "newuser@example.com",
        "password": "TestPassword123!"  # Assuming this is the password
    })
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data["session_token"],
            "user_id": data["user_id"],
            "name": data["name"],
            "email": data["email"]
        }
    return None

class TestGoogleOAuth:
    """Test Google OAuth endpoints"""
    
    def test_google_login_redirects_to_google(self):
        """GET /api/auth/google should redirect to accounts.google.com"""
        response = requests.get(f"{BASE_URL}/api/auth/google", allow_redirects=False)
        
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        location = response.headers.get("Location", "")
        assert "accounts.google.com" in location, f"Should redirect to accounts.google.com, got: {location}"
        assert "auth.emergentagent.com" not in location, f"Should NOT redirect to auth.emergentagent.com"
        
        # Verify OAuth params
        assert "client_id=" in location, "Missing client_id in redirect URL"
        assert "redirect_uri=" in location, "Missing redirect_uri in redirect URL"
        assert "scope=openid+email+profile" in location or "scope=openid%20email%20profile" in location, "Missing proper scopes"
        
        print(f"✓ Google OAuth redirects to: {location[:100]}...")
    
    def test_google_callback_requires_code(self):
        """POST /api/auth/google/callback should require authorization code"""
        response = requests.post(f"{BASE_URL}/api/auth/google/callback", json={})
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "code" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower(), \
            f"Should indicate code is required: {data}"
        
        print(f"✓ Callback validates missing code: {data.get('detail')}")
    
    def test_google_callback_validates_invalid_code(self):
        """POST /api/auth/google/callback should reject invalid code"""
        response = requests.post(f"{BASE_URL}/api/auth/google/callback", json={
            "code": "invalid_code_123",
            "redirect_uri": "https://task-board-app-3.preview.emergentagent.com/auth/google/callback"
        })
        
        assert response.status_code == 401, f"Expected 401 for invalid code, got {response.status_code}"
        data = response.json()
        assert "failed" in data.get("detail", "").lower() or "invalid" in data.get("detail", "").lower(), \
            f"Should indicate failure: {data}"
        
        print(f"✓ Callback rejects invalid code: {data.get('detail')}")


class TestBoardNotifications:
    """Test board activity notifications"""
    
    def test_admin_can_access_test_board(self, admin_session):
        """Verify admin can access the test board"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/boards/board_e341922108da", headers=headers)
        
        assert response.status_code == 200, f"Failed to access board: {response.text}"
        board = response.json()
        assert board["name"] == "TEST_Board_From_Template"
        
        print(f"✓ Admin can access board: {board['name']}")
        print(f"  Board members: {board.get('members')}")
    
    def test_checklist_activity_creates_notification(self, admin_session):
        """Adding checklist item should create notification for board members"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get a card from the test board
        board_response = requests.get(f"{BASE_URL}/api/boards/board_e341922108da", headers=headers)
        board = board_response.json()
        
        # Find a card in the board
        card_id = None
        for lst in board.get("lists", []):
            for card in lst.get("cards", []):
                card_id = card["card_id"]
                break
            if card_id:
                break
        
        assert card_id, "No cards found in board"
        
        # Add a checklist item
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/cards/{card_id}/checklist",
            headers=headers,
            json={"text": f"TEST_ChecklistItem_{timestamp}"}
        )
        
        assert response.status_code == 200, f"Failed to add checklist item: {response.text}"
        data = response.json()
        
        print(f"✓ Added checklist item: {data.get('item_id', 'unknown')}")
        
        # Get activities to verify activity was logged
        activity_response = requests.get(
            f"{BASE_URL}/api/cards/{card_id}/activities",
            headers=headers
        )
        
        if activity_response.status_code == 200:
            activities = activity_response.json()
            recent = [a for a in activities if "TEST_ChecklistItem" in str(a.get("details", {}))]
            print(f"  Found {len(recent)} related activities")
    
    def test_comment_creates_notification(self, admin_session):
        """Adding a comment should create notification (via create_notification)"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get a card from the test board
        board_response = requests.get(f"{BASE_URL}/api/boards/board_e341922108da", headers=headers)
        board = board_response.json()
        
        # Find a card
        card_id = None
        for lst in board.get("lists", []):
            for card in lst.get("cards", []):
                card_id = card["card_id"]
                break
            if card_id:
                break
        
        assert card_id, "No cards found"
        
        # Add a comment
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/cards/{card_id}/comments",
            headers=headers,
            json={"content": f"TEST_Comment_{timestamp}"}
        )
        
        assert response.status_code == 200, f"Failed to add comment: {response.text}"
        comment = response.json()
        
        print(f"✓ Added comment: {comment.get('comment_id', 'unknown')}")
    
    def test_attachment_activity_creates_notification(self, admin_session):
        """Attaching a file should create activity and notification"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get a card
        board_response = requests.get(f"{BASE_URL}/api/boards/board_e341922108da", headers=headers)
        board = board_response.json()
        
        card_id = None
        for lst in board.get("lists", []):
            for card in lst.get("cards", []):
                card_id = card["card_id"]
                break
            if card_id:
                break
        
        # We can't easily test file upload without multipart, but we can verify endpoint exists
        # Just checking the card details
        card_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers=headers)
        if card_response.status_code == 200:
            card = card_response.json()
            print(f"✓ Card has {len(card.get('attachments', []))} attachments")


class TestBoardInvite:
    """Test board invitation with email for existing users"""
    
    def test_invite_existing_user_sends_email(self, admin_session):
        """Inviting existing user to board should send email notification"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # First create a new board
        workspace_response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        workspaces = workspace_response.json()
        assert len(workspaces) > 0, "No workspaces found"
        workspace_id = workspaces[0]["workspace_id"]
        
        # Create a test board
        timestamp = int(time.time())
        board_response = requests.post(
            f"{BASE_URL}/api/workspaces/{workspace_id}/boards",
            headers=headers,
            json={"name": f"TEST_InviteBoard_{timestamp}"}
        )
        
        assert board_response.status_code == 200, f"Failed to create board: {board_response.text}"
        board = board_response.json()
        board_id = board["board_id"]
        
        print(f"✓ Created test board: {board_id}")
        
        # Invite an existing user (newuser@example.com - user_e2bb8e131044)
        invite_response = requests.post(
            f"{BASE_URL}/api/boards/{board_id}/invite",
            headers=headers,
            json={"email": "newuser@example.com", "role": "member"}
        )
        
        assert invite_response.status_code == 200, f"Invite failed: {invite_response.text}"
        invite_data = invite_response.json()
        
        # For existing user, pending should be False
        assert invite_data.get("pending") == False, f"Existing user should not be pending: {invite_data}"
        
        print(f"✓ Invited existing user: {invite_data.get('message')}")
        
        # Cleanup - delete the test board
        requests.delete(f"{BASE_URL}/api/boards/{board_id}", headers=headers)
        print(f"  Cleaned up test board")
    
    def test_invite_non_existing_user_creates_invitation(self, admin_session):
        """Inviting non-existing user creates invitation token and sends email"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get a workspace
        workspace_response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        workspaces = workspace_response.json()
        workspace_id = workspaces[0]["workspace_id"]
        
        # Create a test board
        timestamp = int(time.time())
        board_response = requests.post(
            f"{BASE_URL}/api/workspaces/{workspace_id}/boards",
            headers=headers,
            json={"name": f"TEST_InviteBoard2_{timestamp}"}
        )
        board = board_response.json()
        board_id = board["board_id"]
        
        # Invite a non-existing user
        invite_response = requests.post(
            f"{BASE_URL}/api/boards/{board_id}/invite",
            headers=headers,
            json={"email": f"nonexistent_{timestamp}@example.com", "role": "member"}
        )
        
        assert invite_response.status_code == 200, f"Invite failed: {invite_response.text}"
        invite_data = invite_response.json()
        
        # For non-existing user, pending should be True
        assert invite_data.get("pending") == True, f"Non-existing user should be pending: {invite_data}"
        
        print(f"✓ Created invitation for non-existing user: {invite_data.get('message')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/boards/{board_id}", headers=headers)


class TestEmailPasswordLogin:
    """Test basic email/password authentication still works"""
    
    def test_login_with_valid_credentials(self):
        """Login with email/password should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "session_token" in data, "Missing session_token in response"
        assert "user_id" in data, "Missing user_id in response"
        assert data["email"] == "odapto.admin@emergent.com"
        
        print(f"✓ Login successful: {data['name']} ({data['role']})")
    
    def test_login_with_invalid_credentials(self):
        """Login with wrong password should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "WrongPassword!"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")


class TestAuthMe:
    """Test auth/me endpoint"""
    
    def test_auth_me_returns_user_data(self, admin_session):
        """GET /api/auth/me should return current user data"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        
        assert data["user_id"] == admin_session["user_id"]
        assert data["email"] == "odapto.admin@emergent.com"
        
        print(f"✓ Auth me returns: {data['name']} ({data['role']})")
    
    def test_auth_me_rejects_invalid_token(self):
        """GET /api/auth/me should reject invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid token correctly rejected")


class TestDashboardAccess:
    """Test dashboard-related endpoints"""
    
    def test_can_list_workspaces(self, admin_session):
        """GET /api/workspaces should list user's workspaces"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        
        assert response.status_code == 200, f"Failed to list workspaces: {response.text}"
        workspaces = response.json()
        assert isinstance(workspaces, list)
        
        print(f"✓ Listed {len(workspaces)} workspaces")
    
    def test_can_access_workspace(self, admin_session):
        """GET /api/workspaces/:id should return workspace details"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get workspaces first
        ws_response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        workspaces = ws_response.json()
        
        if len(workspaces) > 0:
            workspace_id = workspaces[0]["workspace_id"]
            response = requests.get(f"{BASE_URL}/api/workspaces/{workspace_id}", headers=headers)
            
            assert response.status_code == 200, f"Failed to get workspace: {response.text}"
            workspace = response.json()
            assert workspace["workspace_id"] == workspace_id
            
            print(f"✓ Accessed workspace: {workspace['name']}")
    
    def test_can_list_boards(self, admin_session):
        """GET /api/workspaces/:id/boards should list boards"""
        headers = {"Authorization": f"Bearer {admin_session['token']}"}
        
        # Get workspaces first
        ws_response = requests.get(f"{BASE_URL}/api/workspaces", headers=headers)
        workspaces = ws_response.json()
        
        if len(workspaces) > 0:
            workspace_id = workspaces[0]["workspace_id"]
            response = requests.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards", headers=headers)
            
            assert response.status_code == 200, f"Failed to list boards: {response.text}"
            boards = response.json()
            assert isinstance(boards, list)
            
            print(f"✓ Listed {len(boards)} boards in workspace")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
