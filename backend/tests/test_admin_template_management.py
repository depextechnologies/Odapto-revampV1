"""
Test Admin Panel Template Management Features
- PUT /api/templates/{template_id} - Update template
- DELETE /api/templates/{template_id} - Delete template
- GET /api/templates - List templates
- GET /api/templates/{template_id} - Get single template
- GET /api/template-categories - List categories
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "odapto.admin@emergent.com"
ADMIN_PASSWORD = "SecurePassword123!"


class TestAdminTemplateManagement:
    """Test suite for Admin Panel template management features"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("role") == "admin", "User is not admin"
        return data["session_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_session):
        """Get auth headers with admin token"""
        return {"Authorization": f"Bearer {admin_session}"}
    
    @pytest.fixture(scope="class")
    def test_workspace_id(self, auth_headers):
        """Get a workspace ID for testing"""
        response = requests.get(f"{BASE_URL}/api/workspaces", headers=auth_headers)
        assert response.status_code == 200
        workspaces = response.json()
        assert len(workspaces) > 0, "No workspaces found"
        return workspaces[0]["workspace_id"]
    
    @pytest.fixture(scope="class")
    def test_category_id(self):
        """Get a category ID for testing"""
        response = requests.get(f"{BASE_URL}/api/template-categories")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) > 0, "No categories found"
        return categories[0]["category_id"]
    
    # ============== GET Templates Tests ==============
    
    def test_get_templates_list(self):
        """Test GET /api/templates returns list of templates"""
        response = requests.get(f"{BASE_URL}/api/templates")
        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)
        print(f"Found {len(templates)} templates")
        
        # Verify template structure
        if len(templates) > 0:
            template = templates[0]
            assert "board_id" in template
            assert "template_name" in template
            assert "is_template" in template
            assert template["is_template"] == True
    
    def test_get_templates_with_category_filter(self, test_category_id):
        """Test GET /api/templates with category filter"""
        response = requests.get(
            f"{BASE_URL}/api/templates",
            params={"category_id": test_category_id}
        )
        assert response.status_code == 200
        templates = response.json()
        
        # All returned templates should have the specified category
        for template in templates:
            assert template.get("template_category_id") == test_category_id
    
    def test_get_single_template(self):
        """Test GET /api/templates/{template_id} returns template with lists and cards"""
        # First get a template ID
        response = requests.get(f"{BASE_URL}/api/templates")
        assert response.status_code == 200
        templates = response.json()
        
        if len(templates) == 0:
            pytest.skip("No templates available for testing")
        
        template_id = templates[0]["board_id"]
        
        # Get single template
        response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 200
        template = response.json()
        
        # Verify structure includes lists
        assert "lists" in template
        assert isinstance(template["lists"], list)
        
        # Verify lists have cards
        for lst in template["lists"]:
            assert "cards" in lst
            assert isinstance(lst["cards"], list)
    
    def test_get_nonexistent_template(self):
        """Test GET /api/templates/{nonexistent} returns 404"""
        response = requests.get(f"{BASE_URL}/api/templates/nonexistent_template_id")
        assert response.status_code == 404
    
    # ============== PUT Template Tests ==============
    
    def test_update_template_name(self, auth_headers):
        """Test PUT /api/templates/{id} updates template name"""
        # Get a template
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template = templates[0]
        template_id = template["board_id"]
        original_name = template["template_name"]
        
        # Update name
        new_name = f"Updated Name {uuid.uuid4().hex[:8]}"
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={"template_name": new_name}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["template_name"] == new_name
        
        # Verify with GET
        response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
        assert response.json()["template_name"] == new_name
        
        # Revert
        requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={"template_name": original_name}
        )
    
    def test_update_template_description(self, auth_headers):
        """Test PUT /api/templates/{id} updates template description"""
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template = templates[0]
        template_id = template["board_id"]
        original_desc = template.get("template_description", "")
        
        # Update description
        new_desc = f"Updated description {uuid.uuid4().hex[:8]}"
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={"template_description": new_desc}
        )
        assert response.status_code == 200
        assert response.json()["template_description"] == new_desc
        
        # Revert
        requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={"template_description": original_desc}
        )
    
    def test_update_template_category(self, auth_headers):
        """Test PUT /api/templates/{id} updates template category"""
        # Get templates and categories
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        response = requests.get(f"{BASE_URL}/api/template-categories")
        categories = response.json()
        if len(categories) < 2:
            pytest.skip("Need at least 2 categories for this test")
        
        template = templates[0]
        template_id = template["board_id"]
        original_category = template.get("template_category_id")
        
        # Find a different category
        new_category = None
        for cat in categories:
            if cat["category_id"] != original_category:
                new_category = cat["category_id"]
                break
        
        if not new_category:
            pytest.skip("No different category available")
        
        # Update category
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={"category_id": new_category}
        )
        assert response.status_code == 200
        assert response.json()["template_category_id"] == new_category
        
        # Revert
        if original_category:
            requests.put(
                f"{BASE_URL}/api/templates/{template_id}",
                headers=auth_headers,
                json={"category_id": original_category}
            )
    
    def test_update_template_without_auth(self):
        """Test PUT /api/templates/{id} without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template_id = templates[0]["board_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            json={"template_name": "Should Fail"}
        )
        assert response.status_code == 401
    
    def test_update_nonexistent_template(self, auth_headers):
        """Test PUT /api/templates/{nonexistent} returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/templates/nonexistent_id",
            headers=auth_headers,
            json={"template_name": "Test"}
        )
        assert response.status_code == 404
    
    def test_update_template_empty_body(self, auth_headers):
        """Test PUT /api/templates/{id} with empty body returns 400"""
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template_id = templates[0]["board_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 400
    
    # ============== DELETE Template Tests ==============
    
    def test_delete_template_without_auth(self):
        """Test DELETE /api/templates/{id} without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/templates")
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No templates available")
        
        template_id = templates[0]["board_id"]
        
        response = requests.delete(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 401
    
    def test_delete_nonexistent_template(self, auth_headers):
        """Test DELETE /api/templates/{nonexistent} returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/templates/nonexistent_id",
            headers=auth_headers
        )
        assert response.status_code == 404
    
    def test_delete_template_full_flow(self, auth_headers, test_workspace_id, test_category_id):
        """Test full flow: create board -> publish as template -> delete template"""
        # Create a test board
        response = requests.post(
            f"{BASE_URL}/api/workspaces/{test_workspace_id}/boards",
            headers=auth_headers,
            json={"name": "TEST_Board_For_Delete", "description": "Will be deleted"}
        )
        assert response.status_code == 200
        board_id = response.json()["board_id"]
        
        # Publish as template
        response = requests.post(
            f"{BASE_URL}/api/boards/{board_id}/publish-template",
            headers=auth_headers,
            json={
                "template_name": "TEST_Delete_Template",
                "template_description": "This template will be deleted",
                "category_id": test_category_id
            }
        )
        assert response.status_code == 200
        template_id = response.json()["board_id"]
        
        # Verify template exists
        response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 200
        
        # Delete template
        response = requests.delete(
            f"{BASE_URL}/api/templates/{template_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Template deleted successfully"
        
        # Verify template is deleted
        response = requests.get(f"{BASE_URL}/api/templates/{template_id}")
        assert response.status_code == 404
        
        # Clean up: delete the original board
        requests.delete(f"{BASE_URL}/api/boards/{board_id}", headers=auth_headers)
    
    # ============== Category Tests ==============
    
    def test_get_template_categories(self):
        """Test GET /api/template-categories returns list of categories"""
        response = requests.get(f"{BASE_URL}/api/template-categories")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        
        if len(categories) > 0:
            category = categories[0]
            assert "category_id" in category
            assert "name" in category


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
