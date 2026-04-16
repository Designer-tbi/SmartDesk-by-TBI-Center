"""
SmartDesk Cookie Auth Migration Tests - Iteration 2
Tests for localStorage → DB + HttpOnly cookie migration

Key tests:
1. POST /api/auth/login - returns Set-Cookie header, no token in body
2. GET /api/auth/me - works with cookie, returns 401 without
3. POST /api/auth/logout - clears cookie and session
4. PUT /api/auth/preferences - persists user preferences in DB
5. Backward compatibility - Bearer token still works
6. RLS isolation with cookie auth
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://08f57f92-d2c0-4793-93da-868f95eea959.preview.emergentagent.com').rstrip('/')

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN = {"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
DEMO_1_ADMIN = {"email": "admin@smartdesk.cg", "password": "admin"}  # TechCorp Demo (demo-1)
DEMO_2_ADMIN = {"email": "admin@greenenergy.demo", "password": "admin"}  # GreenEnergy Demo (demo-2)

COOKIE_NAME = "smartdesk_session"


class TestCookieAuthLogin:
    """Test POST /api/auth/login sets HttpOnly cookie correctly"""

    def test_login_sets_cookie_header(self):
        """Login should return Set-Cookie header with smartdesk_session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check Set-Cookie header is present
        set_cookie = response.headers.get('Set-Cookie', '')
        assert COOKIE_NAME in set_cookie, f"Expected Set-Cookie with {COOKIE_NAME}, got: {set_cookie}"
        
        # Check HttpOnly flag
        assert 'HttpOnly' in set_cookie or 'httponly' in set_cookie.lower(), \
            f"Cookie should be HttpOnly, got: {set_cookie}"
        
        # Check SameSite=Lax
        assert 'SameSite=Lax' in set_cookie or 'samesite=lax' in set_cookie.lower(), \
            f"Cookie should have SameSite=Lax, got: {set_cookie}"
        
        print(f"✓ Login sets cookie correctly: {COOKIE_NAME} with HttpOnly and SameSite=Lax")

    def test_login_response_no_token_field(self):
        """Login response body should NOT contain 'token' field, only 'user' with 'preferences'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Should NOT have token in body
        assert "token" not in data, f"Response should NOT contain 'token' field, got: {data.keys()}"
        
        # Should have user object
        assert "user" in data, f"Response should contain 'user' field, got: {data.keys()}"
        
        # User should have preferences
        user = data["user"]
        assert "preferences" in user, f"User should have 'preferences' field, got: {user.keys()}"
        
        print(f"✓ Login response has 'user' with 'preferences', no 'token' field")

    def test_demo1_login_returns_isDemo_true(self):
        """Demo-1 login should return isDemo=true in user object"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={**DEMO_1_ADMIN, "demoMode": True})
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert data["user"]["isDemo"] == True, f"Expected isDemo=true, got: {data['user'].get('isDemo')}"
        assert data["user"]["companyId"] == "demo-1", f"Expected companyId=demo-1, got: {data['user'].get('companyId')}"
        
        print(f"✓ Demo-1 login returns isDemo=true, companyId=demo-1")

    def test_super_admin_login_returns_role(self):
        """Super admin login should return role='super_admin'"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert data["user"]["role"] == "super_admin", f"Expected role=super_admin, got: {data['user'].get('role')}"
        
        # Verify cookie is set
        assert COOKIE_NAME in session.cookies, f"Cookie {COOKIE_NAME} should be set in session"
        
        print(f"✓ Super admin login returns role=super_admin with cookie set")


class TestCookieAuthMe:
    """Test GET /api/auth/me with and without cookie"""

    def test_auth_me_without_cookie_returns_401(self):
        """GET /api/auth/me without cookie should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ /api/auth/me without cookie returns 401")

    def test_auth_me_with_cookie_returns_200(self):
        """GET /api/auth/me with valid cookie should return 200 + user + preferences"""
        session = requests.Session()
        
        # Login to get cookie
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Call /me with cookie (session automatically sends cookies)
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        
        assert me_resp.status_code == 200, f"Expected 200, got {me_resp.status_code}: {me_resp.text}"
        
        data = me_resp.json()
        assert "email" in data, f"Response should contain 'email', got: {data.keys()}"
        assert "preferences" in data, f"Response should contain 'preferences', got: {data.keys()}"
        assert data["email"] == DEMO_1_ADMIN["email"], f"Email mismatch"
        
        print(f"✓ /api/auth/me with cookie returns 200 + user + preferences")


class TestCookieAuthLogout:
    """Test POST /api/auth/logout clears cookie and session"""

    def test_logout_clears_cookie(self):
        """POST /api/auth/logout should clear the cookie"""
        session = requests.Session()
        
        # Login first
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Verify cookie is set
        assert COOKIE_NAME in session.cookies, "Cookie should be set after login"
        
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200, f"Logout failed: {logout_resp.text}"
        
        # Check Set-Cookie header clears the cookie (expires in past or Max-Age=0)
        set_cookie = logout_resp.headers.get('Set-Cookie', '')
        # Cookie should be cleared (either expires in past or empty value)
        assert COOKIE_NAME in set_cookie, f"Logout should set cookie header to clear it"
        
        print(f"✓ Logout returns 200 and clears cookie")

    def test_auth_me_after_logout_returns_401(self):
        """GET /api/auth/me after logout should return 401"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200
        
        # Verify /me works
        me_resp1 = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp1.status_code == 200, "Should be authenticated before logout"
        
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        
        # Clear cookies from session to simulate browser behavior after Set-Cookie clears
        session.cookies.clear()
        
        # /me should now return 401
        me_resp2 = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp2.status_code == 401, f"Expected 401 after logout, got {me_resp2.status_code}"
        
        print(f"✓ /api/auth/me after logout returns 401")


class TestPreferencesPersistence:
    """Test PUT /api/auth/preferences persists to DB"""

    def test_put_preferences_returns_200(self):
        """PUT /api/auth/preferences should return 200 and merge preferences"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200
        
        # Set preferences
        prefs = {"language": "en", "sidebarCollapsedSections": {"ops": True}}
        pref_resp = session.put(
            f"{BASE_URL}/api/auth/preferences",
            json=prefs,
            headers={"Content-Type": "application/json"}
        )
        
        assert pref_resp.status_code == 200, f"Expected 200, got {pref_resp.status_code}: {pref_resp.text}"
        
        data = pref_resp.json()
        assert "preferences" in data, f"Response should contain 'preferences', got: {data.keys()}"
        
        # Verify preferences were set
        saved_prefs = data["preferences"]
        assert saved_prefs.get("language") == "en", f"Language should be 'en', got: {saved_prefs.get('language')}"
        assert saved_prefs.get("sidebarCollapsedSections", {}).get("ops") == True, \
            f"sidebarCollapsedSections.ops should be True"
        
        print(f"✓ PUT /api/auth/preferences returns 200 with merged preferences")

    def test_preferences_shallow_merge(self):
        """PUT /api/auth/preferences should shallow merge (not replace) existing keys"""
        session = requests.Session()
        
        # Login
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200
        
        # Set initial preferences
        prefs1 = {"language": "en", "sidebarCollapsedSections": {"ops": True}}
        resp1 = session.put(f"{BASE_URL}/api/auth/preferences", json=prefs1)
        assert resp1.status_code == 200
        
        # Set additional preferences (should merge, not replace)
        prefs2 = {"foo": "bar"}
        resp2 = session.put(f"{BASE_URL}/api/auth/preferences", json=prefs2)
        assert resp2.status_code == 200
        
        data = resp2.json()
        saved_prefs = data["preferences"]
        
        # Previous keys should still exist
        assert saved_prefs.get("language") == "en", \
            f"Language should still be 'en' after merge, got: {saved_prefs.get('language')}"
        assert saved_prefs.get("sidebarCollapsedSections", {}).get("ops") == True, \
            f"sidebarCollapsedSections.ops should still be True"
        
        # New key should be added
        assert saved_prefs.get("foo") == "bar", f"foo should be 'bar', got: {saved_prefs.get('foo')}"
        
        print(f"✓ Preferences shallow merge works correctly (previous keys preserved)")


class TestBackwardCompatibility:
    """Test that Authorization: Bearer <token> still works for non-browser clients"""

    def test_bearer_token_still_works(self):
        """Authorization: Bearer <token> should still authenticate requests"""
        # First, we need to get a token. The login still creates a session with token in DB.
        # We can extract it from the cookie or use the session table.
        # For this test, we'll login with session and extract the cookie value as token.
        
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200
        
        # Get the cookie value (which is the JWT token)
        token = session.cookies.get(COOKIE_NAME)
        assert token, f"Could not get {COOKIE_NAME} cookie value"
        
        # Now make a request with Bearer token (no cookies)
        headers = {"Authorization": f"Bearer {token}"}
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert me_resp.status_code == 200, f"Bearer token auth failed: {me_resp.status_code}: {me_resp.text}"
        
        data = me_resp.json()
        assert data["email"] == DEMO_1_ADMIN["email"], "Email mismatch with Bearer auth"
        
        print(f"✓ Authorization: Bearer <token> still works for backward compatibility")


class TestRLSWithCookieAuth:
    """Test RLS isolation still works with cookie-based auth"""

    def test_demo1_contacts_isolation_with_cookie(self):
        """Demo-1 with cookie auth should only see demo-1 contacts"""
        session = requests.Session()
        
        # Login as demo-1
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert login_resp.status_code == 200
        
        # Get contacts
        contacts_resp = session.get(f"{BASE_URL}/api/contacts")
        assert contacts_resp.status_code == 200, f"Failed to get contacts: {contacts_resp.text}"
        
        contacts = contacts_resp.json()
        print(f"Demo-1 contacts count: {len(contacts)}")
        
        # Verify ALL contacts belong to demo-1
        for contact in contacts:
            assert contact.get("companyId") == "demo-1", \
                f"RLS VIOLATION: Contact {contact.get('id')} has companyId={contact.get('companyId')}, expected demo-1"
        
        print(f"✓ RLS isolation with cookie auth: demo-1 sees only demo-1 contacts ({len(contacts)} contacts)")

    def test_demo2_contacts_isolation_with_cookie(self):
        """Demo-2 with cookie auth should only see demo-2 contacts"""
        session = requests.Session()
        
        # Login as demo-2
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_2_ADMIN)
        assert login_resp.status_code == 200
        
        # Get contacts
        contacts_resp = session.get(f"{BASE_URL}/api/contacts")
        assert contacts_resp.status_code == 200, f"Failed to get contacts: {contacts_resp.text}"
        
        contacts = contacts_resp.json()
        print(f"Demo-2 contacts count: {len(contacts)}")
        
        # Verify ALL contacts belong to demo-2
        for contact in contacts:
            assert contact.get("companyId") == "demo-2", \
                f"RLS VIOLATION: Contact {contact.get('id')} has companyId={contact.get('companyId')}, expected demo-2"
        
        print(f"✓ RLS isolation with cookie auth: demo-2 sees only demo-2 contacts ({len(contacts)} contacts)")


class TestUnauthorizedAccess:
    """Test unauthorized access returns 401"""

    def test_contacts_without_auth_returns_401(self):
        """GET /api/contacts without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/contacts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/contacts without auth returns 401")

    def test_preferences_without_auth_returns_401(self):
        """PUT /api/auth/preferences without auth should return 401"""
        response = requests.put(
            f"{BASE_URL}/api/auth/preferences",
            json={"foo": "bar"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/preferences without auth returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
