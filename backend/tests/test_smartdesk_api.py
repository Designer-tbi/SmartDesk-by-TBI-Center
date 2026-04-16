"""
SmartDesk API Tests - Multi-tenant ERP/CRM
Tests authentication, RLS isolation, admin endpoints, and cross-tenant security
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from /app/memory/test_credentials.md
SUPER_ADMIN = {"email": "eden@tbi-center.fr", "password": "loub@ki2014D"}
DEMO_1_ADMIN = {"email": "admin@smartdesk.cg", "password": "admin"}  # TechCorp Demo (demo-1)
DEMO_2_ADMIN = {"email": "admin@greenenergy.demo", "password": "admin"}  # GreenEnergy Demo (demo-2)


class TestAuthentication:
    """Authentication endpoint tests"""

    def test_super_admin_login(self):
        """Super admin login should return 200 + token + role=super_admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "super_admin", f"Expected role=super_admin, got {data['user']['role']}"
        assert data["user"]["email"] == SUPER_ADMIN["email"]
        print(f"✓ Super admin login successful: {data['user']['email']}")

    def test_demo1_login_with_demoMode(self):
        """Demo-1 user login with demoMode=true should return companyId=demo-1 and isDemo=true"""
        payload = {**DEMO_1_ADMIN, "demoMode": True}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert data["user"]["companyId"] == "demo-1", f"Expected companyId=demo-1, got {data['user']['companyId']}"
        assert data["user"]["isDemo"] == True, f"Expected isDemo=true, got {data['user'].get('isDemo')}"
        print(f"✓ Demo-1 login successful: companyId={data['user']['companyId']}, isDemo={data['user']['isDemo']}")

    def test_demo2_login(self):
        """Demo-2 user login should return companyId=demo-2"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_2_ADMIN)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["user"]["companyId"] == "demo-2", f"Expected companyId=demo-2, got {data['user']['companyId']}"
        print(f"✓ Demo-2 login successful: companyId={data['user']['companyId']}")

    def test_login_wrong_password(self):
        """Login with wrong password should return 401"""
        payload = {"email": SUPER_ADMIN["email"], "password": "wrongpassword"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Wrong password correctly rejected with 401")

    def test_auth_me_with_valid_token(self):
        """GET /api/auth/me with valid token should return 200 + user data"""
        # First login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Then call /me
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == SUPER_ADMIN["email"]
        print(f"✓ /api/auth/me returned user: {data['email']}")

    def test_auth_me_without_token(self):
        """GET /api/auth/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/me without token correctly rejected with 401")


class TestRLSIsolation:
    """Row-Level Security isolation tests - CRITICAL for multi-tenant security"""

    @pytest.fixture
    def demo1_token(self):
        """Get token for demo-1 user"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200, f"Demo-1 login failed: {resp.text}"
        return resp.json()["token"]

    @pytest.fixture
    def demo2_token(self):
        """Get token for demo-2 user"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_2_ADMIN)
        assert resp.status_code == 200, f"Demo-2 login failed: {resp.text}"
        return resp.json()["token"]

    def test_demo1_contacts_isolation(self, demo1_token):
        """Demo-1 should only see contacts with companyId=demo-1"""
        headers = {"Authorization": f"Bearer {demo1_token}"}
        response = requests.get(f"{BASE_URL}/api/contacts", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        contacts = response.json()
        print(f"Demo-1 contacts count: {len(contacts)}")
        
        # Verify ALL contacts belong to demo-1
        for contact in contacts:
            assert contact.get("companyId") == "demo-1", \
                f"RLS VIOLATION: Contact {contact.get('id')} has companyId={contact.get('companyId')}, expected demo-1"
        
        print(f"✓ Demo-1 RLS isolation verified: {len(contacts)} contacts, all with companyId=demo-1")

    def test_demo2_contacts_isolation(self, demo2_token):
        """Demo-2 should only see contacts with companyId=demo-2"""
        headers = {"Authorization": f"Bearer {demo2_token}"}
        response = requests.get(f"{BASE_URL}/api/contacts", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        contacts = response.json()
        print(f"Demo-2 contacts count: {len(contacts)}")
        
        # Verify ALL contacts belong to demo-2
        for contact in contacts:
            assert contact.get("companyId") == "demo-2", \
                f"RLS VIOLATION: Contact {contact.get('id')} has companyId={contact.get('companyId')}, expected demo-2"
        
        print(f"✓ Demo-2 RLS isolation verified: {len(contacts)} contacts, all with companyId=demo-2")

    def test_cross_tenant_delete_attack(self, demo1_token, demo2_token):
        """
        CRITICAL SECURITY TEST: Demo-1 attempts to delete a Demo-2 contact.
        RLS should silently filter - DELETE returns 204 but resource still exists for demo-2.
        """
        headers_demo1 = {"Authorization": f"Bearer {demo1_token}"}
        headers_demo2 = {"Authorization": f"Bearer {demo2_token}"}
        
        # Get demo-2 contacts first
        resp = requests.get(f"{BASE_URL}/api/contacts", headers=headers_demo2)
        assert resp.status_code == 200
        demo2_contacts = resp.json()
        
        if len(demo2_contacts) == 0:
            pytest.skip("No demo-2 contacts to test cross-tenant delete")
        
        target_contact_id = demo2_contacts[0]["id"]
        initial_count = len(demo2_contacts)
        print(f"Demo-2 initial contact count: {initial_count}, target ID: {target_contact_id}")
        
        # Demo-1 attempts to delete demo-2's contact
        delete_resp = requests.delete(f"{BASE_URL}/api/contacts/{target_contact_id}", headers=headers_demo1)
        # Should return 204 (RLS silently filters, no rows affected)
        assert delete_resp.status_code == 204, f"Expected 204, got {delete_resp.status_code}"
        
        # Verify demo-2's contact STILL EXISTS
        resp_after = requests.get(f"{BASE_URL}/api/contacts", headers=headers_demo2)
        assert resp_after.status_code == 200
        demo2_contacts_after = resp_after.json()
        
        # Count should be unchanged
        assert len(demo2_contacts_after) == initial_count, \
            f"RLS BREACH: Demo-2 contact count changed from {initial_count} to {len(demo2_contacts_after)}"
        
        # Target contact should still exist
        contact_ids_after = [c["id"] for c in demo2_contacts_after]
        assert target_contact_id in contact_ids_after, \
            f"RLS BREACH: Contact {target_contact_id} was deleted by cross-tenant attack!"
        
        print(f"✓ Cross-tenant delete attack blocked: Demo-2 still has {len(demo2_contacts_after)} contacts")

    def test_spoofing_companyId_on_create(self, demo1_token, demo2_token):
        """
        SECURITY TEST: Demo-1 tries to create a contact with companyId=demo-2.
        The API should force req.user.companyId, so contact appears in demo-1 only.
        """
        headers_demo1 = {"Authorization": f"Bearer {demo1_token}"}
        headers_demo2 = {"Authorization": f"Bearer {demo2_token}"}
        
        # Demo-1 creates contact with spoofed companyId
        spoofed_contact = {
            "id": f"TEST_spoofed_{int(__import__('time').time())}",
            "name": "TEST Spoofed Contact",
            "email": "spoofed@test.com",
            "phone": "123456789",
            "company": "Spoofed Corp",
            "companyId": "demo-2",  # SPOOFING ATTEMPT
            "role": "Test",
            "status": "active"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/contacts", json=spoofed_contact, headers=headers_demo1)
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
        
        # Verify contact appears in demo-1's list
        demo1_contacts = requests.get(f"{BASE_URL}/api/contacts", headers=headers_demo1).json()
        demo1_ids = [c["id"] for c in demo1_contacts]
        assert spoofed_contact["id"] in demo1_ids, "Spoofed contact should appear in demo-1's list"
        
        # Verify contact does NOT appear in demo-2's list
        demo2_contacts = requests.get(f"{BASE_URL}/api/contacts", headers=headers_demo2).json()
        demo2_ids = [c["id"] for c in demo2_contacts]
        assert spoofed_contact["id"] not in demo2_ids, \
            f"SECURITY BREACH: Spoofed contact appeared in demo-2's list!"
        
        # Cleanup: delete the test contact
        requests.delete(f"{BASE_URL}/api/contacts/{spoofed_contact['id']}", headers=headers_demo1)
        
        print("✓ CompanyId spoofing attack blocked: Contact created in demo-1 only")


class TestEventsIsolation:
    """Events endpoint RLS tests"""

    @pytest.fixture
    def demo1_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return resp.json()["token"]

    def test_demo1_events_isolation(self, demo1_token):
        """Demo-1 should only see events with companyId=demo-1"""
        headers = {"Authorization": f"Bearer {demo1_token}"}
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        events = response.json()
        print(f"Demo-1 events count: {len(events)}")
        
        # Verify ALL events belong to demo-1
        for event in events:
            assert event.get("companyId") == "demo-1", \
                f"RLS VIOLATION: Event {event.get('id')} has companyId={event.get('companyId')}, expected demo-1"
        
        print(f"✓ Demo-1 events RLS isolation verified: {len(events)} events")

    def test_create_event_with_correct_companyId(self, demo1_token):
        """POST /api/events should create event with user's companyId"""
        headers = {"Authorization": f"Bearer {demo1_token}"}
        
        event_data = {
            "id": f"TEST_event_{int(__import__('time').time())}",
            "title": "TEST Event",
            "description": "Test event for RLS verification",
            "startDate": "2026-02-01T10:00:00Z",
            "endDate": "2026-02-01T11:00:00Z",
            "category": "meeting",
            "isPrivate": False
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
        
        # Verify event appears in demo-1's list
        events = requests.get(f"{BASE_URL}/api/events", headers=headers).json()
        event_ids = [e["id"] for e in events]
        assert event_data["id"] in event_ids, "Created event should appear in demo-1's events"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_data['id']}", headers=headers)
        
        print("✓ Event created with correct companyId (demo-1)")


class TestAdminEndpoints:
    """Super admin endpoint tests"""

    @pytest.fixture
    def super_admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert resp.status_code == 200
        return resp.json()["token"]

    @pytest.fixture
    def demo1_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return resp.json()["token"]

    def test_admin_stats(self, super_admin_token):
        """GET /api/admin/stats should return company and user counts"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "realCompanies" in data
        assert "demoCompanies" in data
        assert "totalUsers" in data
        assert "realUsers" in data
        assert "demoUsers" in data
        
        print(f"✓ Admin stats: {data['realCompanies']} real companies, {data['demoCompanies']} demo companies, {data['totalUsers']} total users")

    def test_admin_companies_by_type(self, super_admin_token):
        """GET /api/admin/companies/by-type should return grouped companies"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/companies/by-type", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "real" in data, "Response should have 'real' key"
        assert "demo" in data, "Response should have 'demo' key"
        assert isinstance(data["real"], list)
        assert isinstance(data["demo"], list)
        
        print(f"✓ Companies by type: {len(data['real'])} real, {len(data['demo'])} demo")

    def test_admin_companies_by_type_forbidden_for_demo_user(self, demo1_token):
        """GET /api/admin/companies/by-type with demo user token should return 403"""
        headers = {"Authorization": f"Bearer {demo1_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/companies/by-type", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Admin endpoint correctly forbidden for demo user (403)")


class TestUnauthorizedAccess:
    """Tests for unauthorized access attempts"""

    def test_contacts_without_token(self):
        """GET /api/contacts without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/contacts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/contacts without token correctly rejected with 401")

    def test_events_without_token(self):
        """GET /api/events without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/events without token correctly rejected with 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
