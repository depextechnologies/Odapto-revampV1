"""
Test Template Management Features - Iteration 14
Tests for:
1. Template Edit (PUT /api/templates/{id})
2. Template Delete (DELETE /api/templates/{id})
3. Template Preview (GET /api/templates/{id})
4. Remember Me (login with token storage)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"


class TestAuthRememberMe:
    """Test Remember Me functionality - backend login returns session_token"""
    
    def test_login_returns_session_token(self):
        """Login should return session_token for Remember Me feature"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "session_token" in data, "session_token not in response"
        assert data["session_token"].startswith("sess_"), "session_token format incorrect"
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        print(f"Login successful, session_token: {data['session_token'][:20]}...")


class TestTemplatePreview:
    """Test Template Preview functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Authentication failed")
    
    def test_get_templates_list(self):
        """Get list of templates (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/templates")
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        print(f"Found {len(templates)} templates")
        
        if len(templates) > 0:
            template = templates[0]
            assert "board_id" in template, "Template should have board_id"
            assert "template_name" in template, "Template should have template_name"
            print(f"First template: {template.get('template_name')}")
        
        return templates
    
    def test_get_template_preview(self):
        """Get single template with lists and cards for preview"""
        # First get templates list
        templates_response = requests.get(f"{BASE_URL}/api/templates")
        assert templates_response.status_code == 200
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available for preview test")
        
        template_id = templates[0]["board_id"]
        
        # Get template preview
        response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 200, f"Failed to get template preview: {response.text}"
        
        template = response.json()
        assert "board_id" in template
        assert "template_name" in template
        assert "lists" in template, "Template preview should include lists"
        
        print(f"Template preview: {template.get('template_name')}")
        print(f"Lists count: {len(template.get('lists', []))}")
        
        # Check lists have cards
        for lst in template.get("lists", []):
            assert "list_id" in lst
            assert "name" in lst
            assert "cards" in lst, "List should include cards"
            print(f"  List '{lst['name']}' has {len(lst.get('cards', []))} cards")


class TestTemplateEdit:
    """Test Template Edit functionality (PUT /api/templates/{id})"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_edit_template_name(self, auth_headers):
        """Admin can edit template name"""
        # Get templates list
        templates_response = requests.get(f"{BASE_URL}/api/templates")
        assert templates_response.status_code == 200
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available for edit test")
        
        template = templates[0]
        template_id = template["board_id"]
        original_name = template.get("template_name", "")
        
        # Edit template name
        new_name = f"TEST_EDIT_{original_name}"
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_name": new_name},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to edit template: {response.text}"
        
        updated = response.json()
        assert updated.get("template_name") == new_name, "Template name not updated"
        print(f"Template name updated to: {new_name}")
        
        # Revert the change
        revert_response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_name": original_name},
            headers=auth_headers
        )
        assert revert_response.status_code == 200, "Failed to revert template name"
        print(f"Template name reverted to: {original_name}")
    
    def test_edit_template_description(self, auth_headers):
        """Admin can edit template description"""
        # Get templates list
        templates_response = requests.get(f"{BASE_URL}/api/templates")
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template = templates[0]
        template_id = template["board_id"]
        original_desc = template.get("template_description", "")
        
        # Edit description
        new_desc = "TEST_DESCRIPTION_UPDATED"
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_description": new_desc},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to edit description: {response.text}"
        
        updated = response.json()
        assert updated.get("template_description") == new_desc
        print(f"Template description updated")
        
        # Revert
        requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_description": original_desc},
            headers=auth_headers
        )
    
    def test_edit_template_without_auth_fails(self):
        """Editing template without auth should fail"""
        templates_response = requests.get(f"{BASE_URL}/api/templates")
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template_id = templates[0]["board_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_name": "Unauthorized Edit"}
        )
        assert response.status_code == 401, "Should require authentication"
        print("Correctly rejected unauthorized edit")
    
    def test_edit_nonexistent_template_fails(self, auth_headers):
        """Editing non-existent template should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/templates/nonexistent_template_id",
            json={"template_name": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent template"
        print("Correctly returned 404 for non-existent template")


class TestTemplateDelete:
    """Test Template Delete functionality (DELETE /api/templates/{id})"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("session_token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_delete_template_without_auth_fails(self):
        """Deleting template without auth should fail"""
        templates_response = requests.get(f"{BASE_URL}/api/templates")
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template_id = templates[0]["board_id"]
        
        response = requests.delete(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 401, "Should require authentication"
        print("Correctly rejected unauthorized delete")
    
    def test_delete_nonexistent_template_fails(self, auth_headers):
        """Deleting non-existent template should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/templates/nonexistent_template_id",
            headers=auth_headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent template"
        print("Correctly returned 404 for non-existent template")
    
    def test_delete_template_endpoint_exists(self, auth_headers):
        """Verify DELETE endpoint exists and is accessible"""
        # We won't actually delete a template, just verify the endpoint works
        # by checking that it returns proper error for non-existent template
        response = requests.delete(
            f"{BASE_URL}/api/templates/test_nonexistent",
            headers=auth_headers
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code != 405, "DELETE method should be allowed"
        print("DELETE endpoint is accessible")


class TestTemplateCategories:
    """Test Template Categories for edit dialog"""
    
    def test_get_template_categories(self):
        """Get list of template categories"""
        response = requests.get(f"{BASE_URL}/api/template-categories")
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should be a list"
        print(f"Found {len(categories)} categories")
        
        if len(categories) > 0:
            category = categories[0]
            assert "category_id" in category
            assert "name" in category
            print(f"Categories: {[c['name'] for c in categories]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
