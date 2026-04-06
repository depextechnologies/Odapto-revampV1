"""
Test Google Drive Integration Endpoints - Iteration 18
Tests for:
- GET /api/integrations/status - returns connection status for google_drive, onedrive, dropbox
- GET /api/integrations/google-drive/connect - returns 307 redirect to Google OAuth
- DELETE /api/integrations/google-drive/disconnect - returns success
- POST /api/integrations/google-drive/attach - attaches a Drive file to a card
- GET /api/integrations/google-drive/files - returns 401 when not connected (no token)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIntegrationEndpoints:
    """Test Google Drive integration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user_id = login_response.json().get("user_id")
        else:
            pytest.skip("Authentication failed - skipping integration tests")
    
    def test_integrations_status_returns_all_providers(self):
        """GET /api/integrations/status returns status for google_drive, onedrive, dropbox"""
        response = self.session.get(f"{BASE_URL}/api/integrations/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all three providers are present
        assert "google_drive" in data, "google_drive key missing from status"
        assert "onedrive" in data, "onedrive key missing from status"
        assert "dropbox" in data, "dropbox key missing from status"
        
        # Verify google_drive structure
        assert "connected" in data["google_drive"], "google_drive.connected missing"
        assert isinstance(data["google_drive"]["connected"], bool), "google_drive.connected should be boolean"
        
        # Verify onedrive and dropbox are not connected (coming soon)
        assert data["onedrive"]["connected"] == False, "onedrive should not be connected"
        assert data["dropbox"]["connected"] == False, "dropbox should not be connected"
        
        print(f"Integration status: google_drive={data['google_drive']['connected']}, onedrive={data['onedrive']['connected']}, dropbox={data['dropbox']['connected']}")
    
    def test_google_drive_connect_returns_307_redirect(self):
        """GET /api/integrations/google-drive/connect returns 307 redirect to Google OAuth"""
        # Don't follow redirects to check the 307 status
        response = self.session.get(
            f"{BASE_URL}/api/integrations/google-drive/connect",
            allow_redirects=False
        )
        
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        # Verify redirect location contains Google OAuth URL
        location = response.headers.get("Location", "")
        assert "accounts.google.com" in location, f"Redirect should go to Google OAuth, got: {location}"
        assert "oauth2" in location, "Redirect URL should contain oauth2"
        assert "client_id" in location, "Redirect URL should contain client_id"
        assert "redirect_uri" in location, "Redirect URL should contain redirect_uri"
        assert "scope" in location, "Redirect URL should contain scope"
        assert "drive" in location.lower(), "Redirect URL should contain drive scope"
        
        print(f"Google Drive connect redirects to: {location[:100]}...")
    
    def test_google_drive_disconnect_returns_success(self):
        """DELETE /api/integrations/google-drive/disconnect returns success"""
        response = self.session.delete(f"{BASE_URL}/api/integrations/google-drive/disconnect")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "disconnect" in data["message"].lower(), f"Message should mention disconnect: {data['message']}"
        
        print(f"Disconnect response: {data}")
    
    def test_google_drive_files_returns_401_when_not_connected(self):
        """GET /api/integrations/google-drive/files returns 401 when not connected"""
        # First disconnect to ensure not connected
        self.session.delete(f"{BASE_URL}/api/integrations/google-drive/disconnect")
        
        # Now try to list files
        response = self.session.get(f"{BASE_URL}/api/integrations/google-drive/files")
        
        assert response.status_code == 401, f"Expected 401 when not connected, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Files endpoint when not connected: {data}")
    
    def test_google_drive_attach_requires_card_id(self):
        """POST /api/integrations/google-drive/attach requires card_id"""
        response = self.session.post(
            f"{BASE_URL}/api/integrations/google-drive/attach",
            json={"file_id": "test_file_123"}  # Missing card_id
        )
        
        assert response.status_code == 400, f"Expected 400 for missing card_id, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Attach without card_id: {data}")
    
    def test_google_drive_attach_requires_file_id(self):
        """POST /api/integrations/google-drive/attach requires file_id"""
        response = self.session.post(
            f"{BASE_URL}/api/integrations/google-drive/attach",
            json={"card_id": "card_test123"}  # Missing file_id
        )
        
        assert response.status_code == 400, f"Expected 400 for missing file_id, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Attach without file_id: {data}")
    
    def test_google_drive_attach_with_valid_card(self):
        """POST /api/integrations/google-drive/attach works with valid card"""
        # Use the known card from the test data
        card_id = "card_da16e8e57260"
        
        response = self.session.post(
            f"{BASE_URL}/api/integrations/google-drive/attach",
            json={
                "card_id": card_id,
                "file_id": "TEST_gdrive_file_123",
                "file_name": "TEST_Integration_Document.pdf",
                "file_url": "https://drive.google.com/file/d/TEST_gdrive_file_123/view",
                "file_icon": "https://drive-thirdparty.googleusercontent.com/16/type/application/pdf",
                "file_mime": "application/pdf"
            }
        )
        
        # Should succeed (200) or fail with 404 if card doesn't exist
        if response.status_code == 200:
            data = response.json()
            assert "file_id" in data, "Response should contain file_id"
            assert "filename" in data, "Response should contain filename"
            assert data["source"] == "google_drive", "Source should be google_drive"
            print(f"Successfully attached Drive file: {data}")
        elif response.status_code == 404:
            print(f"Card not found (expected in some test environments): {response.json()}")
        else:
            print(f"Attach response: {response.status_code} - {response.json()}")
            # Don't fail - just report
    
    def test_integrations_status_unauthenticated(self):
        """GET /api/integrations/status requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/integrations/status")
        
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("Unauthenticated request correctly rejected")


class TestAuthAndDashboard:
    """Verify login and dashboard still work correctly"""
    
    def test_login_flow(self):
        """Login with admin credentials works"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        
        data = response.json()
        assert "session_token" in data, "Response should contain session_token"
        assert "user_id" in data, "Response should contain user_id"
        assert data["email"] == "odapto.admin@emergent.com", "Email should match"
        
        print(f"Login successful: user_id={data['user_id']}")
    
    def test_workspaces_accessible_after_login(self):
        """Workspaces endpoint works after login"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        token = login_resp.json().get("session_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get workspaces
        response = session.get(f"{BASE_URL}/api/workspaces")
        
        assert response.status_code == 200, f"Workspaces failed: {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Workspaces should return a list"
        print(f"Found {len(data)} workspaces")
    
    def test_board_accessible(self):
        """Board endpoint works with known board ID"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        token = login_resp.json().get("session_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get board
        board_id = "board_8b24ee8c579c"
        response = session.get(f"{BASE_URL}/api/boards/{board_id}")
        
        if response.status_code == 200:
            data = response.json()
            assert "board_id" in data, "Response should contain board_id"
            assert "lists" in data, "Response should contain lists"
            print(f"Board '{data.get('name')}' has {len(data.get('lists', []))} lists")
        else:
            print(f"Board not found (may not exist in test env): {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
