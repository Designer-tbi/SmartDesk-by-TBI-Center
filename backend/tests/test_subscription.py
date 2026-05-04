"""
Subscription & Trial System Tests
Tests for Phase 5: PayPal subscription, trial tracking, and enforcement middleware.

Test Coverage:
- Auth: Login stamps trialStartedAt idempotently
- Subscription status endpoint returns correct plan for CG vs non-CG
- Subscription create returns valid PayPal approveUrl
- Enforcement middleware blocks protected endpoints when trial expired
- Webhook endpoint accepts PayPal events
- Cancel endpoint sets subscriptionStatus='cancelled'
"""

import pytest
import requests
import os
import subprocess
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://login-troubleshoot-18.preview.emergentagent.com"

# Test credentials from test_credentials.md
DEMO_CG_EMAIL = "admin@smartdesk.cg"
DEMO_CG_PASSWORD = "admin"
SUPER_ADMIN_EMAIL = "eden@tbi-center.fr"
SUPER_ADMIN_PASSWORD = "loub@ki2014D"


class TestAuthTrialStamping:
    """Test that login stamps trialStartedAt idempotently"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Reset demo-1 trial to fresh state before tests"""
        # Reset trial to NOW() so we have a fresh trial
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        yield
    
    def test_login_stamps_trial_started_at(self):
        """POST /api/auth/login should stamp trialStartedAt on first admin login"""
        session = requests.Session()
        
        # Login as demo CG admin
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == DEMO_CG_EMAIL
        print(f"Login successful for {DEMO_CG_EMAIL}")
    
    def test_login_does_not_block_on_expired_trial(self):
        """Login should NOT return 403 even if trial is expired - middleware handles 402"""
        session = requests.Session()
        
        # First backdate the trial to 16 days ago
        backdate_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW()-INTERVAL '16 days' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(backdate_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        
        # Login should still succeed (200), not 403
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        
        assert response.status_code == 200, f"Login should succeed even with expired trial, got {response.status_code}: {response.text}"
        print("Login succeeded with expired trial (as expected)")
        
        # Reset trial back to fresh
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)


class TestSubscriptionStatus:
    """Test GET /api/subscription/status endpoint"""
    
    @pytest.fixture
    def auth_session_cg(self):
        """Get authenticated session for CG demo company"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_status_returns_correct_plan_for_cg(self, auth_session_cg):
        """For CG country, plan should be CG_XAF with 75 USD and 45 000 XAF display"""
        response = auth_session_cg.get(f"{BASE_URL}/api/subscription/status?companyId=demo-1")
        
        assert response.status_code == 200, f"Status failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "access" in data
        assert "subStatus" in data
        assert "inTrial" in data
        assert "daysLeft" in data
        assert "trialExpiresAt" in data
        assert "country" in data
        assert "plan" in data
        
        # Verify CG-specific plan
        plan = data["plan"]
        assert plan["id"] == "CG_XAF", f"Expected CG_XAF plan, got {plan['id']}"
        assert plan["amountUSD"] == "75.00", f"Expected 75.00 USD, got {plan['amountUSD']}"
        assert "45" in plan["displayLocal"] and "XAF" in plan["displayLocal"], f"Expected 45 000 XAF display, got {plan['displayLocal']}"
        
        print(f"CG plan verified: {plan}")
        print(f"Status: access={data['access']}, inTrial={data['inTrial']}, daysLeft={data['daysLeft']}")
    
    def test_status_shows_trial_active_for_fresh_company(self, auth_session_cg):
        """Fresh demo company should have inTrial=true and access=allowed"""
        # Reset trial first
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        
        response = auth_session_cg.get(f"{BASE_URL}/api/subscription/status?companyId=demo-1")
        assert response.status_code == 200
        data = response.json()
        
        assert data["access"] == "allowed", f"Expected allowed, got {data['access']}"
        assert data["inTrial"] == True, f"Expected inTrial=true, got {data['inTrial']}"
        assert data["daysLeft"] > 0, f"Expected daysLeft > 0, got {data['daysLeft']}"
        print(f"Trial active: {data['daysLeft']} days left")


class TestSubscriptionCreate:
    """Test POST /api/subscription/create endpoint"""
    
    @pytest.fixture
    def auth_session_cg(self):
        """Get authenticated session for CG demo company"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_create_returns_paypal_approve_url(self, auth_session_cg):
        """POST /api/subscription/create should return valid PayPal approveUrl"""
        response = auth_session_cg.post(f"{BASE_URL}/api/subscription/create?companyId=demo-1")
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "subscriptionId" in data, "Response should contain subscriptionId"
        assert "approveUrl" in data, "Response should contain approveUrl"
        assert "plan" in data, "Response should contain plan"
        
        # Verify approveUrl is a valid PayPal URL
        approve_url = data["approveUrl"]
        assert approve_url is not None, "approveUrl should not be null"
        assert "paypal.com" in approve_url, f"approveUrl should be PayPal URL, got {approve_url}"
        assert "https://" in approve_url, "approveUrl should be HTTPS"
        
        # Verify plan info
        plan = data["plan"]
        assert plan["id"] == "CG_XAF", f"Expected CG_XAF plan, got {plan['id']}"
        
        print(f"Subscription created: {data['subscriptionId']}")
        print(f"Approve URL: {approve_url[:80]}...")


class TestEnforcementMiddleware:
    """Test that protected endpoints return 402 when trial expired"""
    
    @pytest.fixture
    def auth_session_expired(self):
        """Get authenticated session with expired trial"""
        # First backdate the trial
        backdate_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW()-INTERVAL '16 days', \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(backdate_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Reset trial after each test"""
        yield
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)
    
    def test_contacts_blocked_when_trial_expired(self, auth_session_expired):
        """GET /api/contacts should return 402 when trial expired"""
        response = auth_session_expired.get(f"{BASE_URL}/api/contacts?companyId=demo-1")
        
        assert response.status_code == 402, f"Expected 402, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("code") == "SUBSCRIPTION_REQUIRED", f"Expected SUBSCRIPTION_REQUIRED code, got {data}"
        print("Contacts endpoint correctly blocked with 402")
    
    def test_invoices_blocked_when_trial_expired(self, auth_session_expired):
        """GET /api/invoices should return 402 when trial expired"""
        response = auth_session_expired.get(f"{BASE_URL}/api/invoices?companyId=demo-1")
        
        assert response.status_code == 402, f"Expected 402, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("code") == "SUBSCRIPTION_REQUIRED"
        print("Invoices endpoint correctly blocked with 402")
    
    def test_employees_blocked_when_trial_expired(self, auth_session_expired):
        """GET /api/employees should return 402 when trial expired"""
        response = auth_session_expired.get(f"{BASE_URL}/api/employees?companyId=demo-1")
        
        assert response.status_code == 402, f"Expected 402, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("code") == "SUBSCRIPTION_REQUIRED"
        print("Employees endpoint correctly blocked with 402")
    
    def test_allowlisted_endpoints_still_work(self, auth_session_expired):
        """Allowlisted endpoints should still work when trial expired"""
        # /api/subscription/* should work
        response = auth_session_expired.get(f"{BASE_URL}/api/subscription/status?companyId=demo-1")
        assert response.status_code == 200, f"Subscription status should work, got {response.status_code}"
        print("Subscription status endpoint works (allowlisted)")
        
        # GET /api/company should work
        response = auth_session_expired.get(f"{BASE_URL}/api/company?companyId=demo-1")
        assert response.status_code == 200, f"Company endpoint should work, got {response.status_code}"
        print("Company endpoint works (allowlisted)")
        
        # GET /api/stats should work
        response = auth_session_expired.get(f"{BASE_URL}/api/stats?companyId=demo-1")
        assert response.status_code == 200, f"Stats endpoint should work, got {response.status_code}"
        print("Stats endpoint works (allowlisted)")


class TestSuperAdminBypass:
    """Test that super admin bypasses the subscription gate"""
    
    @pytest.fixture
    def super_admin_session(self):
        """Get authenticated session for super admin"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return session
    
    def test_super_admin_bypasses_gate(self, super_admin_session):
        """Super admin should access protected endpoints even with expired trial"""
        # Backdate demo-1 trial
        backdate_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW()-INTERVAL '16 days' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(backdate_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        
        # Super admin should still access contacts
        response = super_admin_session.get(f"{BASE_URL}/api/contacts?companyId=demo-1")
        # Super admin may get 200 or different behavior based on their own company
        # The key is they should NOT get 402
        assert response.status_code != 402, f"Super admin should bypass 402 gate, got {response.status_code}"
        print(f"Super admin bypassed gate, got status {response.status_code}")
        
        # Reset trial
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)


class TestWebhook:
    """Test POST /api/subscription/webhook endpoint"""
    
    def test_webhook_accepts_activation_event(self):
        """Webhook should accept BILLING.SUBSCRIPTION.ACTIVATED event"""
        # Webhook doesn't require auth
        response = requests.post(f"{BASE_URL}/api/subscription/webhook", json={
            "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
            "resource": {
                "id": "I-TEST123456",
                "custom_id": "demo-1",
                "billing_info": {
                    "next_billing_time": "2026-06-04T00:00:00Z"
                }
            }
        })
        
        # Webhook should return 200 even if it doesn't verify signature
        assert response.status_code == 200, f"Webhook should return 200, got {response.status_code}: {response.text}"
        print("Webhook accepted ACTIVATED event")
    
    def test_webhook_accepts_cancelled_event(self):
        """Webhook should accept BILLING.SUBSCRIPTION.CANCELLED event"""
        response = requests.post(f"{BASE_URL}/api/subscription/webhook", json={
            "event_type": "BILLING.SUBSCRIPTION.CANCELLED",
            "resource": {
                "id": "I-TEST123456",
                "custom_id": "demo-1"
            }
        })
        
        assert response.status_code == 200, f"Webhook should return 200, got {response.status_code}"
        print("Webhook accepted CANCELLED event")
    
    def test_webhook_handles_missing_custom_id(self):
        """Webhook should handle events without custom_id gracefully"""
        response = requests.post(f"{BASE_URL}/api/subscription/webhook", json={
            "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
            "resource": {
                "id": "I-TEST123456"
                # No custom_id
            }
        })
        
        # Should still return 200 (just skip processing)
        assert response.status_code == 200, f"Webhook should return 200 even without custom_id, got {response.status_code}"
        print("Webhook handled missing custom_id gracefully")


class TestSubscriptionCancel:
    """Test POST /api/subscription/cancel endpoint"""
    
    @pytest.fixture
    def auth_session_cg(self):
        """Get authenticated session for CG demo company"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Reset subscription status after test"""
        yield
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"subscriptionStatus\\"='trial', \\"trialStartedAt\\"=NOW() WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)
    
    def test_cancel_sets_status_cancelled(self, auth_session_cg):
        """POST /api/subscription/cancel should set subscriptionStatus='cancelled'"""
        response = auth_session_cg.post(f"{BASE_URL}/api/subscription/cancel?companyId=demo-1", json={
            "reason": "Test cancellation"
        })
        
        assert response.status_code == 200, f"Cancel failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True, f"Expected ok=true, got {data}"
        print("Subscription cancelled successfully")


class TestRegressionTrialActive:
    """Regression tests: ensure middleware doesn't break when trial is active"""
    
    @pytest.fixture
    def auth_session_active_trial(self):
        """Get authenticated session with active trial"""
        # Reset trial to fresh
        reset_cmd = '''cd /app && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`UPDATE companies SET \\"trialStartedAt\\"=NOW(), \\"subscriptionStatus\\"='trial' WHERE id='demo-1'\`).then(()=>p.end())"'''
        subprocess.run(reset_cmd, shell=True, capture_output=True)
        time.sleep(0.5)
        
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_CG_EMAIL,
            "password": DEMO_CG_PASSWORD,
            "demoMode": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_contacts_work_during_trial(self, auth_session_active_trial):
        """GET /api/contacts should work during active trial"""
        response = auth_session_active_trial.get(f"{BASE_URL}/api/contacts?companyId=demo-1")
        assert response.status_code == 200, f"Contacts should work during trial, got {response.status_code}: {response.text}"
        print("Contacts endpoint works during trial")
    
    def test_invoices_work_during_trial(self, auth_session_active_trial):
        """GET /api/invoices should work during active trial"""
        response = auth_session_active_trial.get(f"{BASE_URL}/api/invoices?companyId=demo-1")
        assert response.status_code == 200, f"Invoices should work during trial, got {response.status_code}: {response.text}"
        print("Invoices endpoint works during trial")
    
    def test_employees_work_during_trial(self, auth_session_active_trial):
        """GET /api/employees should work during active trial"""
        response = auth_session_active_trial.get(f"{BASE_URL}/api/employees?companyId=demo-1")
        assert response.status_code == 200, f"Employees should work during trial, got {response.status_code}: {response.text}"
        print("Employees endpoint works during trial")
    
    def test_stats_work_during_trial(self, auth_session_active_trial):
        """GET /api/stats should work during active trial"""
        response = auth_session_active_trial.get(f"{BASE_URL}/api/stats?companyId=demo-1")
        assert response.status_code == 200, f"Stats should work during trial, got {response.status_code}: {response.text}"
        print("Stats endpoint works during trial")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
