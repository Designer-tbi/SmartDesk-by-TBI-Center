"""
Test suite for External Partner API Provisioning (/api/external/companies)

This tests the new feature allowing external platforms to create SmartDesk
company accounts programmatically via a static API key.

Features tested:
- Authentication via X-API-Key header
- Required field validation (name, adminEmail, country, city)
- Email format validation
- Duplicate email detection (409)
- Successful company creation with minimum payload
- Successful company creation with full payload (all optional fields)
- Auto-created admin user with 16-char password
- Company attributes: origin='external', subscriptionStatus='active', onboardingCompleted=true
- Login with auto-created credentials
- Access to protected routes (not blocked by enforceSubscription)
- GET /api/external/companies listing
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')
EXTERNAL_API_KEY = os.environ.get('EXTERNAL_API_KEY', '6c9fcb634abe477d1e8643c51517f6e59ac7ebde1d1d05945c57e959c25ac998')


class TestExternalApiAuthentication:
    """Test API key authentication for external provisioning endpoint"""

    def test_post_without_api_key_returns_401(self):
        """POST /api/external/companies without API key should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={"name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data.get("error") == "Invalid or missing API key."

    def test_post_with_wrong_api_key_returns_401(self):
        """POST /api/external/companies with wrong API key should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={"name": "Test"},
            headers={
                "Content-Type": "application/json",
                "X-API-Key": "wrong-key-12345"
            }
        )
        assert response.status_code == 401
        data = response.json()
        assert data.get("error") == "Invalid or missing API key."

    def test_get_without_api_key_returns_401(self):
        """GET /api/external/companies without API key should return 401"""
        response = requests.get(f"{BASE_URL}/api/external/companies")
        assert response.status_code == 401
        data = response.json()
        assert data.get("error") == "Invalid or missing API key."

    def test_bearer_token_authentication_works(self):
        """API key can be passed as Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/external/companies",
            headers={"Authorization": f"Bearer {EXTERNAL_API_KEY}"}
        )
        assert response.status_code == 200


class TestExternalApiValidation:
    """Test input validation for company creation"""

    def test_empty_payload_returns_400_with_missing_fields(self):
        """Empty payload should return 400 with list of missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={},
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("error") == "Missing required fields"
        assert set(data.get("fields", [])) == {"name", "adminEmail", "country", "city"}

    def test_partial_payload_returns_400_with_remaining_fields(self):
        """Partial payload should return 400 with remaining missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={"name": "Test Corp", "country": "CG"},
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "adminEmail" in data.get("fields", [])
        assert "city" in data.get("fields", [])

    def test_invalid_email_returns_400(self):
        """Invalid adminEmail format should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "Test Corp",
                "adminEmail": "not-an-email",
                "country": "CG",
                "city": "Brazzaville"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "adminEmail is not a valid email" in data.get("error", "")

    def test_existing_email_returns_409(self):
        """adminEmail that already exists should return 409"""
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "Test Corp",
                "adminEmail": "eden@tbi-center.fr",  # Super admin email
                "country": "CG",
                "city": "Brazzaville"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        assert response.status_code == 409
        data = response.json()
        assert "already exists" in data.get("error", "").lower()


class TestExternalApiCompanyCreation:
    """Test successful company creation scenarios"""

    def test_minimum_payload_creates_company_with_correct_attributes(self):
        """Minimum valid payload should create company with correct defaults"""
        unique_email = f"test-min-{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "TEST Minimum Company",
                "adminEmail": unique_email,
                "country": "CG",
                "city": "Brazzaville"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify company attributes
        company = data.get("company", {})
        assert company.get("origin") == "external"
        assert company.get("subscriptionStatus") == "active"
        assert company.get("onboardingCompleted") == True
        assert company.get("type") == "real"
        assert company.get("country") == "CG"
        assert company.get("city") == "Brazzaville"
        assert company.get("currency") == "XAF"  # Inferred from CG
        assert company.get("accountingStandard") == "OHADA"
        
        # Verify admin user
        admin = data.get("admin", {})
        assert admin.get("email") == unique_email
        assert len(admin.get("password", "")) == 16
        assert "note" in admin

    def test_full_payload_persists_all_optional_fields(self):
        """Full payload with all optional fields should persist correctly"""
        unique_email = f"test-full-{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "TEST Full Company",
                "adminEmail": unique_email,
                "adminName": "Jean Dupont",
                "country": "CG",
                "city": "Pointe-Noire",
                "externalRef": "PARTNER-REF-12345",
                "currency": "XAF",
                "language": "fr",
                "taxId": "NIF-123456",
                "rccm": "RCCM-CG-BZV-2024-B12-00001",
                "idNat": "ID-NAT-123",
                "niu": "NIU-456",
                "legalForm": "SARL",
                "capital": 5000000,
                "address": "123 Avenue de la Paix",
                "phone": "+242 06 123 45 67",
                "email": "contact@fullcompany.cg",
                "website": "https://fullcompany.cg",
                "representativeName": "Jean Dupont",
                "representativeRole": "Gérant",
                "cnssEmployerRate": 22.5,
                "cnssEmployeeRate": 4.0
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        company = data.get("company", {})
        
        # Verify all optional fields are persisted
        assert company.get("externalRef") == "PARTNER-REF-12345"
        assert company.get("rccm") == "RCCM-CG-BZV-2024-B12-00001"
        assert company.get("legalForm") == "SARL"
        assert company.get("capital") == 5000000
        assert company.get("representativeName") == "Jean Dupont"
        assert company.get("representativeRole") == "Gérant"
        assert company.get("cnssEmployerRate") == 22.5
        assert company.get("cnssEmployeeRate") == 4.0
        assert company.get("taxId") == "NIF-123456"
        assert company.get("address") == "123 Avenue de la Paix"
        
        # Verify admin name is used
        admin = data.get("admin", {})
        assert admin.get("name") == "Jean Dupont"

    def test_cd_country_infers_cdf_currency(self):
        """Country=CD should infer currency=CDF"""
        unique_email = f"test-cd-{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "TEST CD Company",
                "adminEmail": unique_email,
                "country": "CD",
                "city": "Kinshasa"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        company = data.get("company", {})
        assert company.get("currency") == "CDF"
        assert company.get("accountingStandard") == "OHADA"


class TestExternalApiLoginAndAccess:
    """Test that auto-created admin can login and access protected routes"""

    @pytest.fixture
    def created_company(self):
        """Create a company and return credentials"""
        unique_email = f"test-login-{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": "TEST Login Company",
                "adminEmail": unique_email,
                "country": "CG",
                "city": "Brazzaville"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        return {
            "email": unique_email,
            "password": data["admin"]["password"],
            "company_id": data["company"]["id"]
        }

    def test_login_with_auto_created_credentials(self, created_company):
        """Should be able to login with auto-created admin credentials"""
        session = requests.Session()
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": created_company["email"],
                "password": created_company["password"]
            },
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("user", {}).get("email") == created_company["email"]
        assert data.get("user", {}).get("companyId") == created_company["company_id"]

    def test_external_company_can_access_protected_routes(self, created_company):
        """External company should NOT be blocked by enforceSubscription"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": created_company["email"],
                "password": created_company["password"]
            },
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        
        # Access protected routes
        contacts_response = session.get(f"{BASE_URL}/api/contacts")
        assert contacts_response.status_code == 200
        
        products_response = session.get(f"{BASE_URL}/api/products")
        assert products_response.status_code == 200


class TestExternalApiListing:
    """Test GET /api/external/companies endpoint"""

    def test_list_returns_only_external_companies(self):
        """GET should return only companies with origin='external'"""
        response = requests.get(
            f"{BASE_URL}/api/external/companies",
            headers={"X-API-Key": EXTERNAL_API_KEY}
        )
        
        assert response.status_code == 200
        companies = response.json()
        
        # All returned companies should have origin='external'
        for company in companies:
            assert company.get("origin") == "external"
            assert "id" in company
            assert "name" in company
            assert "subscriptionStatus" in company

    def test_list_includes_recently_created_company(self):
        """Recently created company should appear in the list"""
        unique_email = f"test-list-{int(time.time())}@example.com"
        unique_name = f"TEST List Company {int(time.time())}"
        
        # Create company
        create_response = requests.post(
            f"{BASE_URL}/api/external/companies",
            json={
                "name": unique_name,
                "adminEmail": unique_email,
                "country": "CG",
                "city": "Brazzaville"
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": EXTERNAL_API_KEY
            }
        )
        assert create_response.status_code == 201
        created_id = create_response.json()["company"]["id"]
        
        # List companies
        list_response = requests.get(
            f"{BASE_URL}/api/external/companies",
            headers={"X-API-Key": EXTERNAL_API_KEY}
        )
        assert list_response.status_code == 200
        
        companies = list_response.json()
        company_ids = [c["id"] for c in companies]
        assert created_id in company_ids


class TestSuperAdminVisibility:
    """Test that super admin can see external companies with origin badge"""

    @pytest.fixture
    def admin_session(self):
        """Login as super admin and return session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "eden@tbi-center.fr",
                "password": "loub@ki2014D"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        return session

    def test_admin_companies_endpoint_returns_origin_field(self, admin_session):
        """GET /api/admin/companies should include origin field"""
        response = admin_session.get(f"{BASE_URL}/api/admin/companies")
        assert response.status_code == 200
        
        companies = response.json()
        assert len(companies) > 0
        
        # Check that origin field is present
        for company in companies:
            assert "origin" in company

    def test_external_companies_visible_to_super_admin(self, admin_session):
        """Super admin should see external companies in the list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/companies")
        assert response.status_code == 200
        
        companies = response.json()
        external_companies = [c for c in companies if c.get("origin") == "external"]
        
        # Should have at least one external company (from our tests)
        assert len(external_companies) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
