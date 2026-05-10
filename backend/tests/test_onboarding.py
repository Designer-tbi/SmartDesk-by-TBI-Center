"""
Backend tests for Onboarding Wizard and Company Settings
Tests the new extended company profile fields and SFEC key handling
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

class TestOnboardingEndpoint:
    """Tests for POST /api/company/onboarding"""
    
    @pytest.fixture
    def rdc_session(self):
        """Login as RDC (CD) user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ariane.mbombo@tbi-center.fr",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    @pytest.fixture
    def congo_session(self):
        """Login as Congo (CG) user and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "designer@tbi-center.fr",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_rdc_onboarding_accepts_empty_sfec_key(self, rdc_session):
        """RDC (CD) onboarding should accept empty fiscalizationApiKey"""
        response = rdc_session.post(f"{BASE_URL}/api/company/onboarding", json={
            "country": "CD",
            "city": "Kinshasa",
            "currency": "CDF",
            "accountingStandard": "OHADA",
            "language": "fr",
            "name": "Test RDC Company",
            "address": "Test Address",
            "phone": "+243 99 123 4567",
            "email": "test@rdc.cd",
            "fiscalizationApiKey": ""  # Empty - should be accepted for RDC
        })
        
        assert response.status_code == 200, f"Onboarding failed: {response.text}"
        data = response.json()
        assert data.get("onboardingCompleted") == True
        assert data.get("country") == "CD"
    
    def test_congo_onboarding_accepts_empty_sfec_key(self, congo_session):
        """Congo (CG) onboarding should accept empty fiscalizationApiKey (optional)"""
        response = congo_session.post(f"{BASE_URL}/api/company/onboarding", json={
            "country": "CG",
            "city": "Brazzaville",
            "currency": "XAF",
            "accountingStandard": "OHADA",
            "language": "fr",
            "name": "Test Congo Company",
            "address": "Test Address",
            "phone": "+242 06 123 4567",
            "email": "test@congo.cg",
            "fiscalizationApiKey": ""  # Empty - should be accepted (optional)
        })
        
        assert response.status_code == 200, f"Onboarding failed: {response.text}"
        data = response.json()
        assert data.get("onboardingCompleted") == True
        assert data.get("country") == "CG"
    
    def test_congo_onboarding_rejects_short_sfec_key(self, congo_session):
        """Congo (CG) onboarding should reject SFEC key < 16 chars"""
        response = congo_session.post(f"{BASE_URL}/api/company/onboarding", json={
            "country": "CG",
            "city": "Brazzaville",
            "currency": "XAF",
            "accountingStandard": "OHADA",
            "language": "fr",
            "name": "Test Congo Company",
            "address": "Test Address",
            "phone": "+242 06 123 4567",
            "email": "test@congo.cg",
            "fiscalizationApiKey": "short_key"  # Too short - should be rejected
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "16" in data.get("error", ""), f"Error should mention 16 chars: {data}"
    
    def test_congo_onboarding_accepts_valid_sfec_key(self, congo_session):
        """Congo (CG) onboarding should accept valid SFEC key >= 16 chars"""
        response = congo_session.post(f"{BASE_URL}/api/company/onboarding", json={
            "country": "CG",
            "city": "Brazzaville",
            "currency": "XAF",
            "accountingStandard": "OHADA",
            "language": "fr",
            "name": "Test Congo Company",
            "address": "Test Address",
            "phone": "+242 06 123 4567",
            "email": "test@congo.cg",
            "fiscalizationApiKey": "valid_sfec_key_1234567890"  # Valid - 26 chars
        })
        
        assert response.status_code == 200, f"Onboarding failed: {response.text}"
        data = response.json()
        assert data.get("onboardingCompleted") == True
        assert data.get("hasFiscalizationKey") == True
    
    def test_onboarding_persists_new_fields(self, rdc_session):
        """Onboarding should persist all new extended fields"""
        response = rdc_session.post(f"{BASE_URL}/api/company/onboarding", json={
            "country": "CD",
            "city": "Kinshasa",
            "currency": "CDF",
            "accountingStandard": "OHADA",
            "language": "fr",
            "name": "Test Extended Fields Company",
            "legalForm": "SARL — Société à Responsabilité Limitée",
            "rccm": "CD/KIN/RCCM/24-B-01234",
            "idNat": "01-A1-N12345B",
            "capital": 1000000,
            "address": "Avenue de la Paix, Kinshasa",
            "phone": "+243 99 123 4567",
            "email": "test@extended.cd",
            "website": "https://extended.cd",
            "representativeName": "Jean Dupont",
            "representativeRole": "Gérant",
            "cnssEmployerRate": 13,
            "cnssEmployeeRate": 5,
            "fiscalizationApiKey": ""
        })
        
        assert response.status_code == 200, f"Onboarding failed: {response.text}"
        data = response.json()
        
        # Verify all new fields are persisted
        assert data.get("legalForm") == "SARL — Société à Responsabilité Limitée"
        assert data.get("capital") == 1000000
        assert data.get("representativeName") == "Jean Dupont"
        assert data.get("representativeRole") == "Gérant"
        assert data.get("cnssEmployerRate") == 13
        assert data.get("cnssEmployeeRate") == 5
        assert data.get("rccm") == "CD/KIN/RCCM/24-B-01234"
        assert data.get("idNat") == "01-A1-N12345B"


class TestCompanySettingsEndpoint:
    """Tests for PUT /api/company (Settings page)"""
    
    @pytest.fixture
    def onboarded_session(self):
        """Login as already onboarded RDC user"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "plamedi.fika@tbi-center.fr",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_settings_update_new_fields(self, onboarded_session):
        """Settings PUT should update all new extended fields"""
        # First get current company data
        get_response = onboarded_session.get(f"{BASE_URL}/api/company")
        assert get_response.status_code == 200
        current = get_response.json()
        
        # Update with new field values
        update_data = {
            **current,
            "legalForm": "SA — Société Anonyme",
            "capital": 5000000,
            "representativeName": "Updated Representative",
            "representativeRole": "Président",
            "cnssEmployerRate": 15,
            "cnssEmployeeRate": 6
        }
        
        response = onboarded_session.put(f"{BASE_URL}/api/company", json=update_data)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify persistence with GET
        verify_response = onboarded_session.get(f"{BASE_URL}/api/company")
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get("legalForm") == "SA — Société Anonyme"
        assert data.get("capital") == 5000000
        assert data.get("representativeName") == "Updated Representative"
        assert data.get("representativeRole") == "Président"
        assert data.get("cnssEmployerRate") == 15
        assert data.get("cnssEmployeeRate") == 6
    
    def test_settings_returns_has_fiscalization_key_flag(self, onboarded_session):
        """GET /api/company should return hasFiscalizationKey flag (not raw key)"""
        response = onboarded_session.get(f"{BASE_URL}/api/company")
        assert response.status_code == 200
        data = response.json()
        
        # Should have hasFiscalizationKey flag
        assert "hasFiscalizationKey" in data
        # Should NOT expose raw fiscalizationApiKey
        assert "fiscalizationApiKey" not in data


class TestLocalizationRegression:
    """Regression tests for RDC localization (from iteration_8)"""
    
    @pytest.fixture
    def rdc_usd_session(self):
        """Login as RDC USD user (already onboarded)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "plamedi.fika@tbi-center.fr",
            "password": "admin"
        })
        assert response.status_code == 200
        return session, response.json()
    
    def test_rdc_user_has_correct_country(self, rdc_usd_session):
        """RDC user should have country=CD"""
        session, login_data = rdc_usd_session
        user = login_data.get("user", {})
        assert user.get("country") == "CD", f"Expected CD, got {user.get('country')}"
    
    def test_rdc_user_has_correct_currency(self, rdc_usd_session):
        """RDC user should have currency=USD"""
        session, login_data = rdc_usd_session
        user = login_data.get("user", {})
        assert user.get("currency") == "USD", f"Expected USD, got {user.get('currency')}"
    
    def test_rdc_company_has_ohada_standard(self, rdc_usd_session):
        """RDC company should use OHADA accounting standard"""
        session, _ = rdc_usd_session
        response = session.get(f"{BASE_URL}/api/company")
        assert response.status_code == 200
        data = response.json()
        assert data.get("accountingStandard") == "OHADA"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
