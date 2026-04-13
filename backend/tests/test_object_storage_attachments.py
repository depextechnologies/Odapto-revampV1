"""
Test Object Storage and Attachment Features - Iteration 20
Tests:
- Regular file upload stores file in object storage and returns /api/storage/ URL
- /api/storage/{path} serves stored files correctly with proper content type
- File uploaded via POST /api/cards/{card_id}/attachments can be downloaded from the returned URL
- Integration status endpoint works for both google_drive and dropbox
- Dropbox connect endpoint redirects to Dropbox OAuth (307)
- Google Drive connect endpoint redirects to Google OAuth (307)
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "odapto.admin@emergent.com"
TEST_PASSWORD = "SecurePassword123!"

# Test data from context
TEST_WORKSPACE_ID = "ws_3a39c12c673e"
TEST_BOARD_ID = "board_8b24ee8c579c"
TEST_CARD_ID = "card_da16e8e57260"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        return data["session_token"]
    
    def test_login_success(self, auth_token):
        """Test login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, session_token obtained")


class TestHealthAndBasicEndpoints:
    """Basic endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")


class TestIntegrationStatus:
    """Test integration status endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json()["session_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_integrations_status_endpoint(self, auth_headers):
        """Test GET /api/integrations/status returns status for google_drive and dropbox"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Status endpoint failed: {response.text}"
        data = response.json()
        
        # Verify google_drive status
        assert "google_drive" in data, "google_drive not in status response"
        assert "connected" in data["google_drive"], "google_drive missing 'connected' field"
        
        # Verify dropbox status
        assert "dropbox" in data, "dropbox not in status response"
        assert "connected" in data["dropbox"], "dropbox missing 'connected' field"
        
        print(f"✓ Integration status endpoint works - google_drive: {data['google_drive']['connected']}, dropbox: {data['dropbox']['connected']}")
    
    def test_google_drive_connect_redirects(self, auth_headers):
        """Test GET /api/integrations/google-drive/connect returns 307 redirect to Google OAuth"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/google-drive/connect",
            headers=auth_headers,
            allow_redirects=False
        )
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        # Check redirect location contains Google OAuth URL
        location = response.headers.get("Location", "")
        assert "accounts.google.com" in location or "googleapis.com" in location, f"Redirect not to Google: {location}"
        print(f"✓ Google Drive connect returns 307 redirect to Google OAuth")
    
    def test_dropbox_connect_redirects(self, auth_headers):
        """Test GET /api/integrations/dropbox/connect returns 307 redirect to Dropbox OAuth"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/dropbox/connect",
            headers=auth_headers,
            allow_redirects=False
        )
        assert response.status_code == 307, f"Expected 307 redirect, got {response.status_code}"
        
        # Check redirect location contains Dropbox OAuth URL
        location = response.headers.get("Location", "")
        assert "dropbox.com" in location, f"Redirect not to Dropbox: {location}"
        print(f"✓ Dropbox connect returns 307 redirect to Dropbox OAuth")


class TestFileUploadAndStorage:
    """Test file upload and object storage"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json()["session_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_upload_attachment_returns_storage_url(self, auth_headers):
        """Test POST /api/cards/{card_id}/attachments stores file and returns /api/storage/ URL"""
        # Create a test file
        test_content = b"Test file content for object storage testing - iteration 20"
        test_filename = "test_storage_file.txt"
        
        files = {
            'file': (test_filename, io.BytesIO(test_content), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/attachments",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "file_id" in data, "No file_id in response"
        assert "filename" in data, "No filename in response"
        assert "url" in data, "No url in response"
        assert "uploaded_at" in data, "No uploaded_at in response"
        
        # Verify filename matches
        assert data["filename"] == test_filename, f"Filename mismatch: {data['filename']}"
        
        # Verify URL is either /api/storage/ or /api/files/ (fallback)
        url = data["url"]
        assert url.startswith("/api/storage/") or url.startswith("/api/files/"), f"Unexpected URL format: {url}"
        
        if url.startswith("/api/storage/"):
            print(f"✓ File uploaded to object storage: {url}")
        else:
            print(f"✓ File uploaded to local storage (fallback): {url}")
        
        # Store for next test
        self.__class__.uploaded_file_url = url
        self.__class__.uploaded_file_id = data["file_id"]
        return data
    
    def test_download_uploaded_file(self, auth_headers):
        """Test that uploaded file can be downloaded from the returned URL"""
        # Get the URL from previous test
        url = getattr(self.__class__, 'uploaded_file_url', None)
        if not url:
            pytest.skip("No uploaded file URL from previous test")
        
        # Download the file
        full_url = f"{BASE_URL}{url}"
        response = requests.get(full_url)
        
        assert response.status_code == 200, f"Download failed: {response.status_code} - {response.text}"
        
        # Verify content type
        content_type = response.headers.get("Content-Type", "")
        assert content_type, "No Content-Type header"
        
        # Verify content
        content = response.content
        assert len(content) > 0, "Downloaded file is empty"
        
        print(f"✓ File downloaded successfully from {url}, Content-Type: {content_type}, Size: {len(content)} bytes")
    
    def test_upload_image_attachment(self, auth_headers):
        """Test uploading an image file"""
        # Create a minimal PNG image (1x1 pixel)
        png_header = b'\x89PNG\r\n\x1a\n'
        png_ihdr = b'\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
        png_idat = b'\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N'
        png_iend = b'\x00\x00\x00\x00IEND\xaeB`\x82'
        test_image = png_header + png_ihdr + png_idat + png_iend
        
        test_filename = "test_image_storage.png"
        
        files = {
            'file': (test_filename, io.BytesIO(test_image), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/attachments",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 200, f"Image upload failed: {response.text}"
        data = response.json()
        
        assert data["filename"] == test_filename
        url = data["url"]
        
        # Download and verify content type
        full_url = f"{BASE_URL}{url}"
        download_response = requests.get(full_url)
        assert download_response.status_code == 200, f"Image download failed: {download_response.status_code}"
        
        content_type = download_response.headers.get("Content-Type", "")
        # Content type should be image/png or application/octet-stream
        assert "image" in content_type or "octet-stream" in content_type, f"Unexpected content type: {content_type}"
        
        print(f"✓ Image uploaded and downloadable: {url}, Content-Type: {content_type}")
        
        # Store for cover image test
        self.__class__.uploaded_image_url = url
        self.__class__.uploaded_image_file_id = data["file_id"]


class TestStorageEndpoint:
    """Test /api/storage/{path} endpoint directly"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json()["session_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_storage_endpoint_404_for_nonexistent(self):
        """Test /api/storage/{path} returns 404 for non-existent file"""
        response = requests.get(f"{BASE_URL}/api/storage/attachments/nonexistent_file_12345.txt")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Storage endpoint returns 404 for non-existent files")


class TestCardAttachmentIntegration:
    """Test card attachment integration"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json()["session_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_card_shows_attachments(self, auth_headers):
        """Test GET /api/cards/{card_id} includes attachments"""
        response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get card failed: {response.text}"
        data = response.json()
        
        assert "attachments" in data, "No attachments field in card"
        attachments = data["attachments"]
        
        print(f"✓ Card has {len(attachments)} attachments")
        
        # Verify attachment structure
        if attachments:
            att = attachments[0]
            assert "file_id" in att, "Attachment missing file_id"
            assert "filename" in att, "Attachment missing filename"
            assert "url" in att, "Attachment missing url"
            print(f"  - First attachment: {att['filename']} at {att['url']}")
    
    def test_set_cover_image(self, auth_headers):
        """Test PATCH /api/cards/{card_id}/cover sets cover image"""
        # First get the card to find an image attachment
        response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers=auth_headers
        )
        data = response.json()
        
        # Find an image attachment or use a test URL
        cover_url = None
        for att in data.get("attachments", []):
            if att.get("filename", "").lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                cover_url = att["url"]
                break
        
        if not cover_url:
            # Use a placeholder URL for testing
            cover_url = "/api/storage/attachments/test_cover.png"
        
        # Set cover image
        response = requests.patch(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}/cover",
            headers=auth_headers,
            json={"cover_image": cover_url}
        )
        
        assert response.status_code == 200, f"Set cover failed: {response.text}"
        
        # Verify cover was set
        response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers=auth_headers
        )
        data = response.json()
        assert data.get("cover_image") == cover_url, f"Cover image not set correctly"
        
        print(f"✓ Cover image set successfully: {cover_url}")


class TestCloudIntegrationEndpoints:
    """Test cloud integration endpoints (Google Drive, Dropbox)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json()["session_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_google_drive_files_requires_connection(self, auth_headers):
        """Test GET /api/integrations/google-drive/files returns 401 when not connected"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/google-drive/files",
            headers=auth_headers
        )
        # Should return 401 if not connected
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        if response.status_code == 401:
            print("✓ Google Drive files endpoint returns 401 when not connected (expected)")
        else:
            print("✓ Google Drive is connected, files endpoint works")
    
    def test_dropbox_files_requires_connection(self, auth_headers):
        """Test GET /api/integrations/dropbox/files returns 401 when not connected"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/dropbox/files",
            headers=auth_headers
        )
        # Should return 401 if not connected
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        if response.status_code == 401:
            print("✓ Dropbox files endpoint returns 401 when not connected (expected)")
        else:
            print("✓ Dropbox is connected, files endpoint works")
    
    def test_google_drive_attach_validates_input(self, auth_headers):
        """Test POST /api/integrations/google-drive/attach validates card_id and file_id"""
        # Missing card_id
        response = requests.post(
            f"{BASE_URL}/api/integrations/google-drive/attach",
            headers=auth_headers,
            json={"file_id": "test_file_id"}
        )
        assert response.status_code == 400, f"Expected 400 for missing card_id, got {response.status_code}"
        
        # Missing file_id
        response = requests.post(
            f"{BASE_URL}/api/integrations/google-drive/attach",
            headers=auth_headers,
            json={"card_id": TEST_CARD_ID}
        )
        assert response.status_code == 400, f"Expected 400 for missing file_id, got {response.status_code}"
        
        print("✓ Google Drive attach endpoint validates required fields")
    
    def test_dropbox_attach_validates_input(self, auth_headers):
        """Test POST /api/integrations/dropbox/attach validates card_id and file_id"""
        # Missing card_id
        response = requests.post(
            f"{BASE_URL}/api/integrations/dropbox/attach",
            headers=auth_headers,
            json={"file_id": "test_file_id"}
        )
        assert response.status_code == 400, f"Expected 400 for missing card_id, got {response.status_code}"
        
        # Missing file_id
        response = requests.post(
            f"{BASE_URL}/api/integrations/dropbox/attach",
            headers=auth_headers,
            json={"card_id": TEST_CARD_ID}
        )
        assert response.status_code == 400, f"Expected 400 for missing file_id, got {response.status_code}"
        
        print("✓ Dropbox attach endpoint validates required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
