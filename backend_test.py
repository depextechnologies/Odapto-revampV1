#!/usr/bin/env python3

import requests
import sys
import json
import uuid
from datetime import datetime, timezone

class OdaptoAPITester:
    def __init__(self, base_url="https://kanban-workspace.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        # Use session to maintain cookies
        self.session = requests.Session()

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            self.failed_tests.append({"test": name, "details": details})
            print(f"❌ {name} - FAILED: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add session token if available
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            # Check expected status
            if expected_status and response.status_code != expected_status:
                return False, f"Expected {expected_status}, got {response.status_code}: {response.text}"
            
            try:
                return True, response.json()
            except:
                return True, response.text
                
        except Exception as e:
            return False, str(e)

    def test_health_check(self):
        """Test health check endpoint"""
        success, result = self.make_request('GET', 'health', expected_status=200)
        self.log_test("Health Check", success, result if not success else "")
        return success

    def test_registration(self):
        """Test user registration"""
        test_email = f"test.user.{int(datetime.now().timestamp())}@example.com"
        test_data = {
            "email": test_email,
            "password": "Test123!",
            "name": "Test User"
        }
        
        success, result = self.make_request('POST', 'auth/register', test_data, expected_status=200)
        if success:
            self.user_data = result
            # Registration should return user data and set session cookie
            if 'user_id' in result and 'email' in result:
                self.log_test("User Registration", True)
                return True
            else:
                self.log_test("User Registration", False, "Missing user data in response")
                return False
        else:
            self.log_test("User Registration", False, result)
            return False

    def test_login(self):
        """Test user login - create a new user and login"""
        test_email = f"test.login.{int(datetime.now().timestamp())}@example.com"
        
        # First register a user
        reg_data = {
            "email": test_email,
            "password": "Test123!",
            "name": "Login Test User"
        }
        
        reg_success, reg_result = self.make_request('POST', 'auth/register', reg_data, expected_status=200)
        if not reg_success:
            self.log_test("Login - Registration Setup", False, reg_result)
            return False

        # Now try to login
        login_data = {
            "email": test_email,
            "password": "Test123!"
        }
        
        success, result = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        if success and 'user_id' in result:
            self.log_test("User Login", True)
            return True
        else:
            self.log_test("User Login", False, result if not success else "Missing user data")
            return False

    def test_me_endpoint_without_auth(self):
        """Test /auth/me without authentication"""
        success, result = self.make_request('GET', 'auth/me', expected_status=401)
        self.log_test("Auth Required for /auth/me", success, result if not success else "")
        return success

    def test_workspace_operations(self):
        """Test workspace CRUD operations"""
        if not self.user_data:
            self.log_test("Workspace Operations", False, "No authenticated user")
            return False

        # Create workspace
        workspace_data = {
            "name": f"Test Workspace {int(datetime.now().timestamp())}",
            "description": "Test workspace description"
        }
        
        success, result = self.make_request('POST', 'workspaces', workspace_data, expected_status=200)
        if not success:
            self.log_test("Create Workspace", False, result)
            return False
        
        workspace_id = result.get('workspace_id')
        if not workspace_id:
            self.log_test("Create Workspace", False, "No workspace_id in response")
            return False
        
        self.log_test("Create Workspace", True)
        
        # Get workspaces
        success, result = self.make_request('GET', 'workspaces', expected_status=200)
        if success and isinstance(result, list):
            self.log_test("Get Workspaces", True)
            return True
        else:
            self.log_test("Get Workspaces", False, result if not success else "Invalid response format")
            return False

    def test_board_operations(self):
        """Test board operations within workspace"""
        if not self.user_data:
            self.log_test("Board Operations", False, "No authenticated user")
            return False

        # First create a workspace
        workspace_data = {
            "name": f"Board Test Workspace {int(datetime.now().timestamp())}",
            "description": "For testing boards"
        }
        
        success, workspace_result = self.make_request('POST', 'workspaces', workspace_data, expected_status=200)
        if not success:
            self.log_test("Board Operations - Workspace Setup", False, workspace_result)
            return False
        
        workspace_id = workspace_result.get('workspace_id')
        
        # Create board
        board_data = {
            "name": f"Test Board {int(datetime.now().timestamp())}",
            "description": "Test board description",
            "background": "#FF6B35"
        }
        
        success, result = self.make_request('POST', f'workspaces/{workspace_id}/boards', board_data, expected_status=200)
        if success and 'board_id' in result:
            board_id = result['board_id']
            self.log_test("Create Board", True)
            
            # Get board details
            success, board_details = self.make_request('GET', f'boards/{board_id}', expected_status=200)
            if success and 'lists' in board_details:
                self.log_test("Get Board Details", True)
                return True
            else:
                self.log_test("Get Board Details", False, board_details if not success else "Missing lists")
                return False
        else:
            self.log_test("Create Board", False, result if not success else "Missing board_id")
            return False

    def test_template_endpoints(self):
        """Test template-related endpoints"""
        # Get template categories (public endpoint)
        success, result = self.make_request('GET', 'template-categories', expected_status=200)
        if success and isinstance(result, list):
            self.log_test("Get Template Categories", True)
        else:
            self.log_test("Get Template Categories", False, result if not success else "Invalid response")

        # Get templates (public endpoint)
        success, result = self.make_request('GET', 'templates', expected_status=200)
        if success and isinstance(result, list):
            self.log_test("Get Templates", True)
            return True
        else:
            self.log_test("Get Templates", False, result if not success else "Invalid response")
            return False

    def test_search_functionality(self):
        """Test search endpoint"""
        if not self.user_data:
            self.log_test("Search Functionality", False, "No authenticated user")
            return False

        success, result = self.make_request('GET', 'search?q=test', expected_status=200)
        if success and isinstance(result, dict):
            required_keys = ['boards', 'cards', 'templates']
            if all(key in result for key in required_keys):
                self.log_test("Search Functionality", True)
                return True
            else:
                self.log_test("Search Functionality", False, "Missing required keys in response")
                return False
        else:
            self.log_test("Search Functionality", False, result if not success else "Invalid response")
            return False

    def run_comprehensive_tests(self):
        """Run all API tests"""
        print("=" * 60)
        print("🧪 STARTING ODAPTO API COMPREHENSIVE TESTING")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print()

        # Test 1: Health check (should always work)
        print("1️⃣ Testing Basic Health...")
        if not self.test_health_check():
            print("❌ CRITICAL: Health check failed - stopping tests")
            return self.print_summary()

        # Test 2: Test authentication required endpoints
        print("\n2️⃣ Testing Authentication Requirements...")
        self.test_me_endpoint_without_auth()

        # Test 3: User registration
        print("\n3️⃣ Testing User Registration...")
        if not self.test_registration():
            print("❌ CRITICAL: User registration failed - some tests may be skipped")

        # Test 4: User login (separate from registration)
        print("\n4️⃣ Testing User Login...")
        self.test_login()

        # Test 5: Workspace operations (requires auth)
        print("\n5️⃣ Testing Workspace Operations...")
        self.test_workspace_operations()

        # Test 6: Board operations (requires auth)
        print("\n6️⃣ Testing Board Operations...")
        self.test_board_operations()

        # Test 7: Template endpoints (public)
        print("\n7️⃣ Testing Template Endpoints...")
        self.test_template_endpoints()

        # Test 8: Search functionality (requires auth)
        print("\n8️⃣ Testing Search Functionality...")
        self.test_search_functionality()

        return self.print_summary()

    def print_summary(self):
        """Print test summary and return success status"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['details']}")
        
        print("\n" + "=" * 60)
        
        # Return True if all critical tests passed (>80% success rate)
        return self.tests_passed / self.tests_run >= 0.8

def main():
    """Main test execution"""
    tester = OdaptoAPITester()
    
    try:
        success = tester.run_comprehensive_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Unexpected error during testing: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())