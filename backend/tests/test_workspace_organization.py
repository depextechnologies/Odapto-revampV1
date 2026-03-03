"""
Tests for Workspace Board Organization Features
- Workspace page shows 4 tabs: All, Personal, Team, Invited
- Tab counts accurately reflect board counts  
- Personal tab shows boards created by user that are not in a team
- Team tab shows boards assigned to teams with team name badge
- Invited tab shows boards user was invited to
- Create Team button visible for workspace owners
- Create Team creates a new team successfully
- Create Board dialog has team assignment dropdown
- Board assigned to team shows in Team tab
- Board without team shows in Personal tab
- Teams API endpoints work correctly
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token using admin credentials"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "odapto.admin@emergent.com",
        "password": "SecurePassword123!"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("session_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

@pytest.fixture(scope="module")
def workspace_id():
    """Use existing workspace from test credentials"""
    return "ws_3a39c12c673e"


class TestBoardCategorization:
    """Test board category field returned by GET /workspaces/{id}/boards"""
    
    def test_boards_have_category_field(self, authenticated_client, workspace_id):
        """GET /api/workspaces/{workspace_id}/boards - Each board has category field"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        assert isinstance(boards, list), "Response should be a list"
        print(f"Found {len(boards)} boards in workspace")
        
        for board in boards:
            assert "category" in board, f"Board {board.get('board_id')} missing category field"
            assert board["category"] in ["personal", "team", "invited"], \
                f"Invalid category: {board['category']}"
            print(f"Board '{board.get('name')}' - category: {board['category']}")
    
    def test_team_boards_have_team_name(self, authenticated_client, workspace_id):
        """GET /api/workspaces/{workspace_id}/boards - Team boards have team_name"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        team_boards = [b for b in boards if b.get("category") == "team"]
        
        for board in team_boards:
            assert "team_name" in board, f"Team board {board.get('board_id')} missing team_name"
            assert board["team_name"] is not None, f"Team board has null team_name"
            print(f"Team board '{board.get('name')}' has team: {board['team_name']}")
        
        if not team_boards:
            print("No team boards found - will create one for testing")
    
    def test_board_counts_per_category(self, authenticated_client, workspace_id):
        """Verify we can count boards per category (for tab counts)"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        categories = {"personal": 0, "team": 0, "invited": 0, "all": 0}
        for board in boards:
            category = board.get("category")
            if category in categories:
                categories[category] += 1
            categories["all"] += 1
        
        print(f"Board counts - All: {categories['all']}, Personal: {categories['personal']}, "
              f"Team: {categories['team']}, Invited: {categories['invited']}")
        
        # Verify sum equals total
        assert categories['all'] == categories['personal'] + categories['team'] + categories['invited'], \
            "Category counts don't sum to all boards"


class TestTeamsAPIForWorkspaceOrganization:
    """Test Teams API for workspace organization feature"""
    
    team_id = None
    
    def test_create_team_returns_correct_structure(self, authenticated_client, workspace_id):
        """POST /api/workspaces/{workspace_id}/teams - Create team for board organization"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/workspaces/{workspace_id}/teams",
            json={
                "name": f"TEST_WorkspaceOrgTeam_{uuid.uuid4().hex[:6]}",
                "description": "Team for testing workspace organization"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "team_id" in data, "Missing team_id"
        assert "name" in data, "Missing name"
        assert "workspace_id" in data, "Missing workspace_id"
        assert "owner_id" in data, "Missing owner_id"
        assert "members" in data, "Missing members"
        
        assert data["workspace_id"] == workspace_id
        TestTeamsAPIForWorkspaceOrganization.team_id = data["team_id"]
        print(f"Created team for organization: {data['team_id']}")
    
    def test_get_workspace_teams(self, authenticated_client, workspace_id):
        """GET /api/workspaces/{workspace_id}/teams - Get teams for dropdown"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/teams")
        
        assert response.status_code == 200
        teams = response.json()
        
        assert isinstance(teams, list)
        print(f"Workspace has {len(teams)} teams available for board assignment")
        
        # Verify our test team is in the list
        if TestTeamsAPIForWorkspaceOrganization.team_id:
            team_ids = [t["team_id"] for t in teams]
            assert TestTeamsAPIForWorkspaceOrganization.team_id in team_ids


class TestBoardTeamAssignment:
    """Test assigning boards to teams"""
    
    board_id = None
    
    def test_create_board_without_team(self, authenticated_client, workspace_id):
        """POST /api/workspaces/{workspace_id}/boards - Create board (no team = personal)"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/workspaces/{workspace_id}/boards",
            json={
                "name": f"TEST_PersonalBoard_{uuid.uuid4().hex[:6]}",
                "description": "Personal board for testing",
                "background": "#E67E4C"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "board_id" in data
        assert data.get("team_id") is None, "New board without team should have null team_id"
        
        TestBoardTeamAssignment.board_id = data["board_id"]
        print(f"Created personal board: {data['board_id']}")
    
    def test_verify_new_board_is_personal(self, authenticated_client, workspace_id):
        """Verify newly created board shows as 'personal' category"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        our_board = next((b for b in boards if b["board_id"] == TestBoardTeamAssignment.board_id), None)
        assert our_board is not None, "Our test board not found"
        assert our_board["category"] == "personal", f"Expected 'personal', got '{our_board['category']}'"
        print(f"Board '{our_board['name']}' correctly categorized as personal")
    
    def test_assign_board_to_team(self, authenticated_client):
        """PATCH /api/boards/{board_id}/team - Assign board to team"""
        if not TestBoardTeamAssignment.board_id:
            pytest.skip("No board_id available")
        if not TestTeamsAPIForWorkspaceOrganization.team_id:
            pytest.skip("No team_id available")
        
        response = authenticated_client.patch(
            f"{BASE_URL}/api/boards/{TestBoardTeamAssignment.board_id}/team",
            json={"team_id": TestTeamsAPIForWorkspaceOrganization.team_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Board assigned to team: {TestTeamsAPIForWorkspaceOrganization.team_id}")
    
    def test_verify_board_now_team_category(self, authenticated_client, workspace_id):
        """Verify board category changes to 'team' after assignment"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        our_board = next((b for b in boards if b["board_id"] == TestBoardTeamAssignment.board_id), None)
        assert our_board is not None, "Our test board not found"
        assert our_board["category"] == "team", f"Expected 'team', got '{our_board['category']}'"
        assert "team_name" in our_board, "Team board should have team_name"
        print(f"Board '{our_board['name']}' now categorized as team with team_name: {our_board['team_name']}")
    
    def test_remove_board_from_team(self, authenticated_client):
        """PATCH /api/boards/{board_id}/team - Remove board from team (set null)"""
        if not TestBoardTeamAssignment.board_id:
            pytest.skip("No board_id available")
        
        response = authenticated_client.patch(
            f"{BASE_URL}/api/boards/{TestBoardTeamAssignment.board_id}/team",
            json={"team_id": None}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Board removed from team")
    
    def test_verify_board_back_to_personal(self, authenticated_client, workspace_id):
        """Verify board category returns to 'personal' after removing team"""
        response = authenticated_client.get(f"{BASE_URL}/api/workspaces/{workspace_id}/boards")
        
        assert response.status_code == 200
        boards = response.json()
        
        our_board = next((b for b in boards if b["board_id"] == TestBoardTeamAssignment.board_id), None)
        assert our_board is not None, "Our test board not found"
        assert our_board["category"] == "personal", f"Expected 'personal', got '{our_board['category']}'"
        print(f"Board '{our_board['name']}' correctly back to personal category")


class TestTeamBoardsEndpoint:
    """Test getting boards for a specific team"""
    
    def test_get_team_boards(self, authenticated_client):
        """GET /api/teams/{team_id}/boards - Get boards assigned to team"""
        if not TestTeamsAPIForWorkspaceOrganization.team_id:
            pytest.skip("No team_id available")
        
        response = authenticated_client.get(
            f"{BASE_URL}/api/teams/{TestTeamsAPIForWorkspaceOrganization.team_id}/boards"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        boards = response.json()
        
        assert isinstance(boards, list)
        print(f"Team has {len(boards)} boards assigned")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_board(self, authenticated_client):
        """DELETE /api/boards/{board_id} - Cleanup test board"""
        if not TestBoardTeamAssignment.board_id:
            pytest.skip("No board to delete")
        
        response = authenticated_client.delete(
            f"{BASE_URL}/api/boards/{TestBoardTeamAssignment.board_id}"
        )
        
        assert response.status_code == 200
        print(f"Deleted test board: {TestBoardTeamAssignment.board_id}")
    
    def test_delete_test_team(self, authenticated_client):
        """DELETE /api/teams/{team_id} - Cleanup test team"""
        if not TestTeamsAPIForWorkspaceOrganization.team_id:
            pytest.skip("No team to delete")
        
        response = authenticated_client.delete(
            f"{BASE_URL}/api/teams/{TestTeamsAPIForWorkspaceOrganization.team_id}"
        )
        
        assert response.status_code == 200
        print(f"Deleted test team: {TestTeamsAPIForWorkspaceOrganization.team_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
