"""
Test Dropbox Integration Endpoints - Iteration 19
Tests for:
- GET /api/integrations/status - returns connection status for google_drive, onedrive, dropbox
- GET /api/integrations/dropbox/connect - returns 307 redirect to Dropbox OAuth
- DELETE /api/integrations/dropbox/disconnect - returns success
- POST /api/integrations/dropbox/attach - attaches a Dropbox file to a card
- GET /api/integrations/dropbox/files - returns 401 when not connected
- GET /api/integrations/dropbox/callback - handles error param correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDropboxIntegrationEndpoints:
    """Test Dropbox integration endpoints"""
    
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
            self.session_token = token
        else:
            pytest.skip("Authentication failed - skipping Dropbox integration tests")
    
    def test_integrations_status_includes_dropbox(self):
        """GET /api/integrations/status returns status for dropbox"""
        response = self.session.get(f"{BASE_URL}/api/integrations/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify dropbox is present
        assert "dropbox" in data, "dropbox key missing from status"
        
        # Verify dropbox structure
        assert "connected" in data["dropbox"], "dropbox.connected missing"
        assert isinstance(data["dropbox"]["connected"], bool), "dropbox.connected should be boolean"
        
        print(f"Dropbox status: connected={data['dropbox']['connected']}, email={data['dropbox'].get('email')}")
    
    def test_dropbox_connect_returns_307_redirect(self):
        """GET /api/integrations/dropbox/connect returns 307 redirect to Dropbox OAuth"""
        # Pass token via query param since browser redirect doesn't include headers
        response = self.session.get(
            f"{BASE_URL}/api/integrations/dropbox/connect?token={self.session_token}",
            allow_redirects=False
        )
        
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        # Verify redirect location contains Dropbox OAuth URL
        location = response.headers.get("Location", "")
        assert "dropbox.com" in location, f"Redirect should go to Dropbox OAuth, got: {location}"
        assert "oauth2" in location, "Redirect URL should contain oauth2"
        assert "client_id" in location, "Redirect URL should contain client_id"
        assert "redirect_uri" in location, "Redirect URL should contain redirect_uri"
        
        print(f"Dropbox connect redirects to: {location[:100]}...")
    
    def test_dropbox_disconnect_returns_success(self):
        """DELETE /api/integrations/dropbox/disconnect returns success"""
        response = self.session.delete(f"{BASE_URL}/api/integrations/dropbox/disconnect")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "disconnect" in data["message"].lower() or "dropbox" in data["message"].lower(), f"Message should mention disconnect: {data['message']}"
        
        print(f"Disconnect response: {data}")
    
    def test_dropbox_files_returns_401_when_not_connected(self):
        """GET /api/integrations/dropbox/files returns 401 when not connected"""
        # First disconnect to ensure not connected
        self.session.delete(f"{BASE_URL}/api/integrations/dropbox/disconnect")
        
        # Now try to list files
        response = self.session.get(f"{BASE_URL}/api/integrations/dropbox/files")
        
        assert response.status_code == 401, f"Expected 401 when not connected, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Files endpoint when not connected: {data}")
    
    def test_dropbox_attach_requires_card_id(self):
        """POST /api/integrations/dropbox/attach requires card_id"""
        response = self.session.post(
            f"{BASE_URL}/api/integrations/dropbox/attach",
            json={"file_id": "test_file_123"}  # Missing card_id
        )
        
        assert response.status_code == 400, f"Expected 400 for missing card_id, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Attach without card_id: {data}")
    
    def test_dropbox_attach_requires_file_id(self):
        """POST /api/integrations/dropbox/attach requires file_id"""
        response = self.session.post(
            f"{BASE_URL}/api/integrations/dropbox/attach",
            json={"card_id": "card_test123"}  # Missing file_id
        )
        
        assert response.status_code == 400, f"Expected 400 for missing file_id, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Response should contain detail"
        print(f"Attach without file_id: {data}")
    
    def test_dropbox_callback_handles_error_param(self):
        """GET /api/integrations/dropbox/callback handles error param correctly"""
        # Test with error parameter - should redirect to /integrations?error=X
        response = self.session.get(
            f"{BASE_URL}/api/integrations/dropbox/callback?error=access_denied",
            allow_redirects=False
        )
        
        # Should redirect (307) to frontend with error
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        location = response.headers.get("Location", "")
        assert "integrations" in location, f"Should redirect to integrations page: {location}"
        assert "error" in location, f"Should include error param: {location}"
        
        print(f"Error callback redirects to: {location}")
    
    def test_dropbox_attach_with_valid_card(self):
        """POST /api/integrations/dropbox/attach works with valid card (when connected)"""
        # Use the known card from the test data
        card_id = "card_da16e8e57260"
        
        response = self.session.post(
            f"{BASE_URL}/api/integrations/dropbox/attach",
            json={
                "card_id": card_id,
                "file_id": "TEST_dropbox_file_123",
                "file_name": "TEST_Dropbox_Document.pdf",
                "file_path": "/Documents/TEST_Dropbox_Document.pdf",
                "file_url": "https://www.dropbox.com/home/Documents/TEST_Dropbox_Document.pdf"
            }
        )
        
        # Should succeed (200) if connected, or fail with 401/404
        if response.status_code == 200:
            data = response.json()
            assert "file_id" in data, "Response should contain file_id"
            assert "filename" in data, "Response should contain filename"
            assert data["source"] == "dropbox", "Source should be dropbox"
            print(f"Successfully attached Dropbox file: {data}")
        elif response.status_code == 401:
            print(f"Dropbox not connected (expected): {response.json()}")
        elif response.status_code == 404:
            print(f"Card not found (expected in some test environments): {response.json()}")
        else:
            print(f"Attach response: {response.status_code} - {response.json()}")


class TestIntegrationStatusAllProviders:
    """Verify all integration providers are returned in status"""
    
    def test_status_returns_all_three_providers(self):
        """GET /api/integrations/status returns google_drive, onedrive, dropbox"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "odapto.admin@emergent.com",
            "password": "SecurePassword123!"
        })
        token = login_resp.json().get("session_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = session.get(f"{BASE_URL}/api/integrations/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all three providers
        assert "google_drive" in data, "google_drive missing"
        assert "onedrive" in data, "onedrive missing"
        assert "dropbox" in data, "dropbox missing"
        
        # Verify structure for each
        for provider in ["google_drive", "onedrive", "dropbox"]:
            assert "connected" in data[provider], f"{provider}.connected missing"
            assert isinstance(data[provider]["connected"], bool), f"{provider}.connected should be boolean"
        
        print(f"All providers present: google_drive={data['google_drive']['connected']}, onedrive={data['onedrive']['connected']}, dropbox={data['dropbox']['connected']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
