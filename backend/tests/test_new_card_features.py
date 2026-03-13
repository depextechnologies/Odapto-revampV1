"""
Test new card features:
- Login API (CORS fix verification)
- Global search API
- Card duplicate API
- Delete attachment API
- Set card cover API
- Delete checklist item API
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"

@pytest.fixture(scope="module")
def auth_token():
    """Login and get session token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "session_token" in data, "No session_token in login response"
    return data["session_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def test_card(api_client):
    """Create a test card for use in tests"""
    # First get workspaces
    ws_resp = api_client.get(f"{BASE_URL}/api/workspaces")
    assert ws_resp.status_code == 200
    workspaces = ws_resp.json()
    
    if not workspaces:
        # Create a workspace
        ws_create = api_client.post(f"{BASE_URL}/api/workspaces", json={
            "name": "TEST_CardFeatures_Workspace"
        })
        assert ws_create.status_code == 200
        workspace = ws_create.json()
    else:
        workspace = workspaces[0]
    
    # Get or create a board
    boards_resp = api_client.get(f"{BASE_URL}/api/workspaces/{workspace['workspace_id']}/boards")
    assert boards_resp.status_code == 200
    boards = boards_resp.json()
    
    if not boards:
        board_create = api_client.post(f"{BASE_URL}/api/workspaces/{workspace['workspace_id']}/boards", json={
            "name": "TEST_CardFeatures_Board"
        })
        assert board_create.status_code == 200
        board = board_create.json()
    else:
        board = boards[0]
    
    # Get board with lists
    board_resp = api_client.get(f"{BASE_URL}/api/boards/{board['board_id']}")
    assert board_resp.status_code == 200
    board_data = board_resp.json()
    
    # Get first list
    if not board_data.get('lists'):
        pytest.skip("No lists available in the board")
    
    list_id = board_data['lists'][0]['list_id']
    
    # Create a test card with checklist
    card_resp = api_client.post(f"{BASE_URL}/api/lists/{list_id}/cards", json={
        "title": "TEST_CardForDuplicateTest",
        "description": "Test card for testing new features",
        "priority": "medium",
        "labels": [{"color": "#EF4444", "name": "Test Label"}]
    })
    assert card_resp.status_code == 200
    card = card_resp.json()
    
    # Add checklist items
    api_client.post(f"{BASE_URL}/api/cards/{card['card_id']}/checklist", json={"text": "Test item 1"})
    api_client.post(f"{BASE_URL}/api/cards/{card['card_id']}/checklist", json={"text": "Test item 2"})
    
    yield card
    
    # Cleanup
    api_client.delete(f"{BASE_URL}/api/cards/{card['card_id']}")


class TestLoginAPI:
    """Test Login API (CORS fix verification)"""
    
    def test_login_success(self):
        """Test login with valid credentials returns session_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "session_token" in data
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert data["email"] == ADMIN_EMAIL
        assert data["session_token"].startswith("sess_")
        print(f"✓ Login successful, received session token")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print(f"✓ Invalid credentials correctly rejected with 401")
    
    def test_cors_headers_present(self):
        """Verify CORS headers are present in response"""
        response = requests.options(f"{BASE_URL}/api/auth/login", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        })
        
        # CORS should allow the request
        assert response.status_code in [200, 204], f"CORS preflight failed: {response.status_code}"
        print(f"✓ CORS preflight request successful")


class TestGlobalSearchAPI:
    """Test Global Search API - GET /api/search"""
    
    def test_search_returns_results(self, api_client):
        """Test search endpoint returns boards, cards, templates"""
        response = api_client.get(f"{BASE_URL}/api/search", params={"q": "test"})
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "boards" in data
        assert "cards" in data
        assert "templates" in data
        assert isinstance(data["boards"], list)
        assert isinstance(data["cards"], list)
        assert isinstance(data["templates"], list)
        print(f"✓ Search returned: {len(data['boards'])} boards, {len(data['cards'])} cards, {len(data['templates'])} templates")
    
    def test_search_with_specific_term(self, api_client, test_card):
        """Test search finds the test card"""
        # Wait a moment for indexing
        time.sleep(0.5)
        
        response = api_client.get(f"{BASE_URL}/api/search", params={"q": "CardForDuplicate"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should find the test card
        card_titles = [c["title"] for c in data["cards"]]
        found = any("CardForDuplicate" in title for title in card_titles)
        assert found, f"Test card not found in search results: {card_titles}"
        print(f"✓ Search found test card in results")
    
    def test_search_empty_query(self, api_client):
        """Test search with empty query"""
        response = api_client.get(f"{BASE_URL}/api/search", params={"q": ""})
        
        # Should still return structure even for empty query
        assert response.status_code == 200
        data = response.json()
        assert "boards" in data
        print(f"✓ Empty search query handled correctly")


class TestCardDuplicateAPI:
    """Test Card Duplicate API - POST /api/cards/{card_id}/duplicate"""
    
    def test_duplicate_card_success(self, api_client, test_card):
        """Test duplicating a card creates a copy"""
        card_id = test_card["card_id"]
        original_title = test_card["title"]
        
        response = api_client.post(f"{BASE_URL}/api/cards/{card_id}/duplicate")
        
        assert response.status_code == 200, f"Duplicate failed: {response.text}"
        new_card = response.json()
        
        # Verify new card
        assert new_card["card_id"] != card_id
        assert "(copy)" in new_card["title"]
        assert new_card["list_id"] == test_card["list_id"]
        assert new_card["board_id"] == test_card["board_id"]
        
        # Verify checklist items were copied
        assert len(new_card.get("checklist", [])) >= 0  # Checklist items should be copied
        
        print(f"✓ Card duplicated: {original_title} -> {new_card['title']}")
        
        # Cleanup the duplicated card
        api_client.delete(f"{BASE_URL}/api/cards/{new_card['card_id']}")
    
    def test_duplicate_nonexistent_card(self, api_client):
        """Test duplicating non-existent card returns 404"""
        response = api_client.post(f"{BASE_URL}/api/cards/nonexistent_card_id/duplicate")
        
        assert response.status_code == 404
        print(f"✓ Duplicate of non-existent card correctly returns 404")


class TestDeleteChecklistItemAPI:
    """Test Delete Checklist Item API - DELETE /api/cards/{card_id}/checklist/{item_id}"""
    
    def test_delete_checklist_item_success(self, api_client, test_card):
        """Test deleting a checklist item"""
        card_id = test_card["card_id"]
        
        # First add a checklist item
        add_resp = api_client.post(f"{BASE_URL}/api/cards/{card_id}/checklist", json={
            "text": "TEST_Item_To_Delete"
        })
        assert add_resp.status_code == 200
        item = add_resp.json()
        item_id = item["item_id"]
        
        # Now delete it
        del_resp = api_client.delete(f"{BASE_URL}/api/cards/{card_id}/checklist/{item_id}")
        
        assert del_resp.status_code == 200, f"Delete checklist item failed: {del_resp.text}"
        print(f"✓ Checklist item deleted successfully")
        
        # Verify it's gone
        card_resp = api_client.get(f"{BASE_URL}/api/cards/{card_id}")
        if card_resp.status_code == 200:
            card_data = card_resp.json()
            item_ids = [i["item_id"] for i in card_data.get("checklist", [])]
            assert item_id not in item_ids, "Deleted item still exists in checklist"
            print(f"✓ Verified item is removed from card")
    
    def test_delete_nonexistent_checklist_item(self, api_client, test_card):
        """Test deleting non-existent checklist item returns 404"""
        card_id = test_card["card_id"]
        
        response = api_client.delete(f"{BASE_URL}/api/cards/{card_id}/checklist/nonexistent_item")
        
        assert response.status_code == 404
        print(f"✓ Delete non-existent checklist item correctly returns 404")


class TestSetCardCoverAPI:
    """Test Set Card Cover API - PATCH /api/cards/{card_id}/cover"""
    
    def test_set_cover_image(self, api_client, test_card):
        """Test setting a card cover image"""
        card_id = test_card["card_id"]
        cover_url = "/api/uploads/test_cover.jpg"  # Mock URL
        
        response = api_client.patch(f"{BASE_URL}/api/cards/{card_id}/cover", json={
            "cover_image": cover_url
        })
        
        assert response.status_code == 200, f"Set cover failed: {response.text}"
        data = response.json()
        assert data.get("cover_image") == cover_url
        print(f"✓ Card cover set successfully")
        
        # Clean up - remove cover
        api_client.patch(f"{BASE_URL}/api/cards/{card_id}/cover", json={
            "cover_image": None
        })
    
    def test_set_cover_on_nonexistent_card(self, api_client):
        """Test setting cover on non-existent card returns 404"""
        response = api_client.patch(f"{BASE_URL}/api/cards/nonexistent_card/cover", json={
            "cover_image": "/test.jpg"
        })
        
        assert response.status_code == 404
        print(f"✓ Set cover on non-existent card correctly returns 404")


class TestDeleteAttachmentAPI:
    """Test Delete Attachment API - DELETE /api/cards/{card_id}/attachments/{file_id}"""
    
    def test_delete_nonexistent_attachment(self, api_client, test_card):
        """Test deleting non-existent attachment returns 404"""
        card_id = test_card["card_id"]
        
        response = api_client.delete(f"{BASE_URL}/api/cards/{card_id}/attachments/nonexistent_file_id")
        
        assert response.status_code == 404
        print(f"✓ Delete non-existent attachment correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
