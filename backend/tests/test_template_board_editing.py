"""
Test Admin Template Board Editing - Iteration 16
Tests the new check_board_access() helper that allows admins/creators to edit template boards.
Features tested:
- Admin can GET /api/boards/{template_id} for a template board
- Admin can POST /api/boards/{template_id}/lists to create a list in a template board
- Admin can POST /api/lists/{list_id}/cards to create a card in a template board's list
- Admin can PATCH /api/cards/{card_id} to update a card in a template
- Admin can DELETE /api/lists/{list_id} to delete a list from a template
- Admin can DELETE /api/cards/{card_id} to delete a card from a template
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://workspace-collab-3.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"

# Known template ID from the database
TEMPLATE_ID = "tmpl_b20fe7c991b9"


class TestAdminTemplateBoardEditing:
    """Test admin access to template board editing via check_board_access() helper"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.session_token = data["session_token"]
        self.user_id = data["user_id"]
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        # Track created resources for cleanup
        self.created_lists = []
        self.created_cards = []
        yield
        # Cleanup created test data
        for card_id in self.created_cards:
            try:
                requests.delete(f"{BASE_URL}/api/cards/{card_id}", headers=self.headers)
            except:
                pass
        for list_id in self.created_lists:
            try:
                requests.delete(f"{BASE_URL}/api/lists/{list_id}", headers=self.headers)
            except:
                pass
    
    # ============== GET TEMPLATE BOARD ==============
    
    def test_admin_can_get_template_board(self):
        """Admin can GET /api/boards/{template_id} for a template board"""
        response = requests.get(f"{BASE_URL}/api/boards/{TEMPLATE_ID}", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify it's a template board
        assert data.get("is_template") == True, "Board should be a template"
        assert data.get("board_id") == TEMPLATE_ID, f"Expected board_id {TEMPLATE_ID}"
        
        # Verify board has lists
        assert "lists" in data, "Board should have lists array"
        print(f"✓ Admin can GET template board {TEMPLATE_ID}")
        print(f"  - Template name: {data.get('template_name')}")
        print(f"  - Lists count: {len(data.get('lists', []))}")
    
    def test_template_board_returns_lists_and_cards(self):
        """Template board GET returns lists with cards"""
        response = requests.get(f"{BASE_URL}/api/boards/{TEMPLATE_ID}", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        lists = data.get("lists", [])
        assert len(lists) > 0, "Template should have at least one list"
        
        # Check first list has cards array
        first_list = lists[0]
        assert "cards" in first_list, "List should have cards array"
        print(f"✓ Template board has {len(lists)} lists")
        for lst in lists:
            print(f"  - {lst.get('name')}: {len(lst.get('cards', []))} cards")
    
    # ============== CREATE LIST IN TEMPLATE ==============
    
    def test_admin_can_create_list_in_template(self):
        """Admin can POST /api/boards/{template_id}/lists to create a list"""
        list_name = f"TEST_List_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": list_name}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("name") == list_name, f"Expected name {list_name}"
        assert data.get("board_id") == TEMPLATE_ID, "List should belong to template board"
        assert "list_id" in data, "Response should have list_id"
        
        self.created_lists.append(data["list_id"])
        print(f"✓ Admin created list '{list_name}' in template board")
        print(f"  - list_id: {data['list_id']}")
    
    def test_create_list_without_auth_fails(self):
        """Creating list without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            json={"name": "Unauthorized List"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Creating list without auth returns 401")
    
    # ============== CREATE CARD IN TEMPLATE LIST ==============
    
    def test_admin_can_create_card_in_template_list(self):
        """Admin can POST /api/lists/{list_id}/cards to create a card in template"""
        # First create a list
        list_name = f"TEST_CardList_{uuid.uuid4().hex[:8]}"
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": list_name}
        )
        assert list_response.status_code == 200
        list_id = list_response.json()["list_id"]
        self.created_lists.append(list_id)
        
        # Now create a card in that list
        card_title = f"TEST_Card_{uuid.uuid4().hex[:8]}"
        card_response = requests.post(
            f"{BASE_URL}/api/lists/{list_id}/cards",
            headers=self.headers,
            json={"title": card_title, "description": "Test card in template"}
        )
        
        assert card_response.status_code == 200, f"Expected 200, got {card_response.status_code}: {card_response.text}"
        card_data = card_response.json()
        
        assert card_data.get("title") == card_title
        assert card_data.get("list_id") == list_id
        assert card_data.get("board_id") == TEMPLATE_ID
        assert "card_id" in card_data
        
        self.created_cards.append(card_data["card_id"])
        print(f"✓ Admin created card '{card_title}' in template list")
        print(f"  - card_id: {card_data['card_id']}")
    
    def test_create_card_in_existing_template_list(self):
        """Admin can create card in existing template list"""
        # Get template board to find existing list
        board_response = requests.get(f"{BASE_URL}/api/boards/{TEMPLATE_ID}", headers=self.headers)
        assert board_response.status_code == 200
        
        lists = board_response.json().get("lists", [])
        assert len(lists) > 0, "Template should have lists"
        
        existing_list_id = lists[0]["list_id"]
        
        # Create card in existing list
        card_title = f"TEST_ExistingList_Card_{uuid.uuid4().hex[:8]}"
        card_response = requests.post(
            f"{BASE_URL}/api/lists/{existing_list_id}/cards",
            headers=self.headers,
            json={"title": card_title}
        )
        
        assert card_response.status_code == 200, f"Expected 200, got {card_response.status_code}: {card_response.text}"
        card_data = card_response.json()
        
        self.created_cards.append(card_data["card_id"])
        print(f"✓ Admin created card in existing template list '{lists[0]['name']}'")
    
    # ============== UPDATE CARD IN TEMPLATE ==============
    
    def test_admin_can_update_card_in_template(self):
        """Admin can PATCH /api/cards/{card_id} to update a card in template"""
        # First create a list and card
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": f"TEST_UpdateList_{uuid.uuid4().hex[:8]}"}
        )
        list_id = list_response.json()["list_id"]
        self.created_lists.append(list_id)
        
        card_response = requests.post(
            f"{BASE_URL}/api/lists/{list_id}/cards",
            headers=self.headers,
            json={"title": "Original Title"}
        )
        card_id = card_response.json()["card_id"]
        self.created_cards.append(card_id)
        
        # Update the card
        updated_title = f"Updated_Title_{uuid.uuid4().hex[:8]}"
        update_response = requests.patch(
            f"{BASE_URL}/api/cards/{card_id}",
            headers=self.headers,
            json={"title": updated_title, "description": "Updated description"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update by getting the card
        get_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers=self.headers)
        assert get_response.status_code == 200
        card_data = get_response.json()
        
        assert card_data.get("title") == updated_title, f"Expected title '{updated_title}'"
        assert card_data.get("description") == "Updated description"
        print(f"✓ Admin updated card in template: '{updated_title}'")
    
    def test_update_card_with_labels_and_priority(self):
        """Admin can update card with labels and priority"""
        # Create list and card
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": f"TEST_LabelList_{uuid.uuid4().hex[:8]}"}
        )
        list_id = list_response.json()["list_id"]
        self.created_lists.append(list_id)
        
        card_response = requests.post(
            f"{BASE_URL}/api/lists/{list_id}/cards",
            headers=self.headers,
            json={"title": "Card with labels"}
        )
        card_id = card_response.json()["card_id"]
        self.created_cards.append(card_id)
        
        # Update with labels and priority
        update_response = requests.patch(
            f"{BASE_URL}/api/cards/{card_id}",
            headers=self.headers,
            json={
                "labels": [{"color": "#FF0000", "name": "Urgent"}],
                "priority": "high"
            }
        )
        
        assert update_response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers=self.headers)
        card_data = get_response.json()
        
        assert card_data.get("priority") == "high"
        assert len(card_data.get("labels", [])) > 0
        print("✓ Admin updated card with labels and priority in template")
    
    # ============== DELETE LIST FROM TEMPLATE ==============
    
    def test_admin_can_delete_list_from_template(self):
        """Admin can DELETE /api/lists/{list_id} to delete a list from template"""
        # Create a list to delete
        list_name = f"TEST_DeleteList_{uuid.uuid4().hex[:8]}"
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": list_name}
        )
        assert list_response.status_code == 200
        list_id = list_response.json()["list_id"]
        
        # Delete the list
        delete_response = requests.delete(
            f"{BASE_URL}/api/lists/{list_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify list is deleted by trying to get it
        board_response = requests.get(f"{BASE_URL}/api/boards/{TEMPLATE_ID}", headers=self.headers)
        lists = board_response.json().get("lists", [])
        list_ids = [l["list_id"] for l in lists]
        
        assert list_id not in list_ids, "Deleted list should not be in board"
        print(f"✓ Admin deleted list '{list_name}' from template")
    
    def test_delete_list_without_auth_fails(self):
        """Deleting list without auth returns 401"""
        # Create a list first
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": f"TEST_AuthList_{uuid.uuid4().hex[:8]}"}
        )
        list_id = list_response.json()["list_id"]
        self.created_lists.append(list_id)
        
        # Try to delete without auth
        delete_response = requests.delete(f"{BASE_URL}/api/lists/{list_id}")
        
        assert delete_response.status_code == 401, f"Expected 401, got {delete_response.status_code}"
        print("✓ Deleting list without auth returns 401")
    
    # ============== DELETE CARD FROM TEMPLATE ==============
    
    def test_admin_can_delete_card_from_template(self):
        """Admin can DELETE /api/cards/{card_id} to delete a card from template"""
        # Create list and card
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": f"TEST_DeleteCardList_{uuid.uuid4().hex[:8]}"}
        )
        list_id = list_response.json()["list_id"]
        self.created_lists.append(list_id)
        
        card_response = requests.post(
            f"{BASE_URL}/api/lists/{list_id}/cards",
            headers=self.headers,
            json={"title": "Card to delete"}
        )
        card_id = card_response.json()["card_id"]
        
        # Delete the card
        delete_response = requests.delete(
            f"{BASE_URL}/api/cards/{card_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify card is deleted
        get_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers=self.headers)
        assert get_response.status_code == 404, "Deleted card should return 404"
        print("✓ Admin deleted card from template")
    
    # ============== VERIFY check_board_access LOGIC ==============
    
    def test_check_board_access_allows_admin_for_template(self):
        """Verify check_board_access allows admin to access template board"""
        # This is implicitly tested by all the above tests
        # But let's do an explicit verification
        
        # Get template board
        response = requests.get(f"{BASE_URL}/api/boards/{TEMPLATE_ID}", headers=self.headers)
        assert response.status_code == 200
        
        board = response.json()
        assert board.get("is_template") == True
        
        # Admin should be able to create list (proves check_board_access works)
        list_response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            headers=self.headers,
            json={"name": f"TEST_AccessCheck_{uuid.uuid4().hex[:8]}"}
        )
        assert list_response.status_code == 200, "Admin should have access to template board"
        self.created_lists.append(list_response.json()["list_id"])
        
        print("✓ check_board_access() correctly allows admin access to template boards")


class TestNonAdminTemplateBoardAccess:
    """Test that non-admin users cannot edit template boards (unless they are the creator)"""
    
    def test_unauthenticated_cannot_access_template_board_editing(self):
        """Unauthenticated users cannot create lists in template"""
        response = requests.post(
            f"{BASE_URL}/api/boards/{TEMPLATE_ID}/lists",
            json={"name": "Unauthorized List"}
        )
        
        assert response.status_code == 401
        print("✓ Unauthenticated users cannot edit template boards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
