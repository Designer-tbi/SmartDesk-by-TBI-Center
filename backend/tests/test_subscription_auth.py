"""
Test suite for SmartDesk subscription and auth features - Iteration 13
Tests:
1. Super admin login returns preferences.selectedCompanyId='comp_default' (TBI Center)
2. POST /api/auth/logout returns 200 and clears cookie
3. POST /api/subscription/create returns valid PayPal approveUrl
4. Verify comp_default is TBI Center (type='real')
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

class TestSuperAdminLogin:
    """Super admin login and preferences tests"""
    
    def test_super_admin_login_returns_comp_default(self):
        """Test that super admin login returns preferences.selectedCompanyId='comp_default'"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' key"
        
        user = data["user"]
        assert user["role"] == "super_admin", "User should be super_admin"
        assert "preferences" in user, "User should have preferences"
        
        prefs = user["preferences"]
        assert "selectedCompanyId" in prefs, "Preferences should have selectedCompanyId"
        assert prefs["selectedCompanyId"] == "comp_default", f"selectedCompanyId should be 'comp_default', got '{prefs['selectedCompanyId']}'"
        
        print(f"SUCCESS: Super admin login returns selectedCompanyId='comp_default'")
    
    def test_comp_default_is_tbi_center(self):
        """Test that comp_default is TBI Center with type='real'"""
        # Login first
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get companies list
        companies_response = session.get(f"{BASE_URL}/api/admin/companies")
        assert companies_response.status_code == 200, f"Failed to get companies: {companies_response.text}"
        
        companies = companies_response.json()
        comp_default = next((c for c in companies if c["id"] == "comp_default"), None)
        
        assert comp_default is not None, "comp_default company not found"
        assert comp_default["name"] == "TBI Center", f"comp_default name should be 'TBI Center', got '{comp_default['name']}'"
        assert comp_default["type"] == "real", f"comp_default type should be 'real', got '{comp_default['type']}'"
        assert comp_default["country"] == "CG", f"comp_default country should be 'CG', got '{comp_default['country']}'"
        
        print(f"SUCCESS: comp_default is TBI Center (type='real', country='CG')")


class TestAuthLogout:
    """Auth logout endpoint tests"""
    
    def test_logout_returns_200(self):
        """Test that POST /api/auth/logout returns 200"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Verify we have a session cookie
        assert "smartdesk_session" in session.cookies, "Should have smartdesk_session cookie after login"
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        data = logout_response.json()
        assert data.get("ok") == True, f"Logout response should have ok=true, got {data}"
        
        print(f"SUCCESS: POST /api/auth/logout returns 200 with ok=true")
    
    def test_logout_clears_session(self):
        """Test that logout clears the session (subsequent /api/auth/me returns 401)"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Verify we can access /api/auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"/api/auth/me should return 200 when logged in"
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        # Verify /api/auth/me now returns 401
        me_response_after = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response_after.status_code == 401, f"/api/auth/me should return 401 after logout, got {me_response_after.status_code}"
        
        print(f"SUCCESS: Logout clears session (subsequent /api/auth/me returns 401)")


class TestSubscriptionCreate:
    """Subscription create endpoint tests"""
    
    def test_subscription_create_returns_approve_url(self):
        """Test that POST /api/subscription/create returns valid PayPal approveUrl"""
        session = requests.Session()
        
        # Login with a user that has a company (not super admin without company)
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "designer@tbi-center.fr", "password": "admin"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Create subscription
        create_response = session.post(f"{BASE_URL}/api/subscription/create")
        assert create_response.status_code == 200, f"Subscription create failed: {create_response.text}"
        
        data = create_response.json()
        assert "approveUrl" in data, f"Response should contain 'approveUrl', got {data}"
        assert "subscriptionId" in data, f"Response should contain 'subscriptionId', got {data}"
        
        approve_url = data["approveUrl"]
        assert "paypal.com" in approve_url, f"approveUrl should contain 'paypal.com', got '{approve_url}'"
        
        print(f"SUCCESS: POST /api/subscription/create returns valid PayPal approveUrl")
        print(f"  subscriptionId: {data['subscriptionId']}")
        print(f"  approveUrl: {approve_url[:80]}...")
    
    def test_subscription_create_returns_plan_info(self):
        """Test that subscription create returns plan info with correct pricing"""
        session = requests.Session()
        
        # Login with a CG user
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "designer@tbi-center.fr", "password": "admin"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Create subscription
        create_response = session.post(f"{BASE_URL}/api/subscription/create")
        assert create_response.status_code == 200, f"Subscription create failed: {create_response.text}"
        
        data = create_response.json()
        assert "plan" in data, f"Response should contain 'plan', got {data}"
        
        plan = data["plan"]
        assert plan["id"] == "CG_XAF", f"Plan id should be 'CG_XAF' for CG user, got '{plan['id']}'"
        assert plan["amountUSD"] == "75.00", f"Plan amountUSD should be '75.00', got '{plan['amountUSD']}'"
        assert "45 000 XAF" in plan["displayLocal"], f"Plan displayLocal should contain '45 000 XAF', got '{plan['displayLocal']}'"
        
        print(f"SUCCESS: Subscription create returns correct plan info for CG user")
        print(f"  plan: {plan}")


class TestSubscriptionStatus:
    """Subscription status endpoint tests"""
    
    def test_subscription_status_returns_plan_info(self):
        """Test that GET /api/subscription/status returns plan info"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "designer@tbi-center.fr", "password": "admin"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get status
        status_response = session.get(f"{BASE_URL}/api/subscription/status")
        assert status_response.status_code == 200, f"Subscription status failed: {status_response.text}"
        
        data = status_response.json()
        assert "access" in data, f"Response should contain 'access', got {data}"
        assert "plan" in data, f"Response should contain 'plan', got {data}"
        assert "country" in data, f"Response should contain 'country', got {data}"
        
        print(f"SUCCESS: GET /api/subscription/status returns plan info")
        print(f"  access: {data['access']}")
        print(f"  country: {data['country']}")
        print(f"  plan: {data['plan']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
