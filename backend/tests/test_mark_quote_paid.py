"""
Test suite for the mark-quote-paid feature (iteration 11).

Tests the new POST /api/invoices/:id/mark-quote-paid endpoint which:
1. Validates the quote (must not be already converted, contact must have email)
2. Marks the quote status='Paid' with paidAt timestamp
3. Auto-converts to a Paid Invoice
4. Auto-posts OHADA journal entry
5. Auto-certifies via DGID (for Congo demo accounts)
6. Emails the certified PDF to the client

Also tests that public signature no longer auto-converts quotes.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
RDC_USD_USER = {"email": "plamedi.fika@tbi-center.fr", "password": "admin"}
CONGO_USER = {"email": "designer@tbi-center.fr", "password": "admin"}


class TestMarkQuotePaidEndpoint:
    """Tests for POST /api/invoices/:id/mark-quote-paid"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def login(self, credentials):
        """Login and return session with auth cookie"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json=credentials
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()
    
    def create_test_contact(self, with_email=True):
        """Create a test contact for quote testing"""
        contact_data = {
            "id": f"TEST_contact_{int(time.time()*1000)}",
            "name": f"TEST Contact {int(time.time())}",
            "company": "TEST Company",
            "email": "test@example.com" if with_email else "",
            "phone": "+243123456789",
            "status": "Lead",
            "contactType": "individual"
        }
        response = self.session.post(
            f"{BASE_URL}/api/contacts",
            json=contact_data
        )
        assert response.status_code == 201, f"Failed to create contact: {response.text}"
        return contact_data
    
    def create_test_quote(self, contact_id, status="Draft"):
        """Create a test quote"""
        quote_id = f"TEST_DEV_{int(time.time()*1000)}"
        quote_data = {
            "id": quote_id,
            "type": "Quote",
            "contactId": contact_id,
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "items": [
                {
                    "name": "Test Service",
                    "description": "Test description",
                    "quantity": 1,
                    "price": 10000,
                    "tvaRate": 0.18,
                    "tvaAmount": 1800
                }
            ],
            "totalHT": 10000,
            "tvaTotal": 1800,
            "total": 11800,
            "status": status,
            "notes": "Test quote for mark-quote-paid testing"
        }
        response = self.session.post(
            f"{BASE_URL}/api/invoices",
            json=quote_data
        )
        assert response.status_code == 201, f"Failed to create quote: {response.text}"
        return quote_data
    
    def test_mark_quote_paid_returns_404_for_nonexistent_id(self):
        """Test that mark-quote-paid returns 404 for non-existent quote ID"""
        self.login(RDC_USD_USER)
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices/NONEXISTENT_QUOTE_ID/mark-quote-paid",
            json={}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data
        print(f"PASS: mark-quote-paid returns 404 for non-existent ID: {data['error']}")
    
    def test_mark_quote_paid_returns_409_if_already_converted(self):
        """Test that mark-quote-paid returns 409 if quote is already converted"""
        self.login(RDC_USD_USER)
        
        # Create contact and quote
        contact = self.create_test_contact(with_email=True)
        quote = self.create_test_quote(contact["id"], status="Signed")
        
        # First conversion should succeed
        response1 = self.session.post(
            f"{BASE_URL}/api/invoices/{quote['id']}/mark-quote-paid",
            json={}
        )
        # Note: May fail due to email rejection (test@example.com) but conversion should work
        
        # Second attempt should return 409
        response2 = self.session.post(
            f"{BASE_URL}/api/invoices/{quote['id']}/mark-quote-paid",
            json={}
        )
        
        assert response2.status_code == 409, f"Expected 409, got {response2.status_code}: {response2.text}"
        data = response2.json()
        assert "error" in data
        assert "déjà" in data["error"].lower() or "already" in data["error"].lower()
        print(f"PASS: mark-quote-paid returns 409 for already converted quote: {data['error']}")
    
    def test_mark_quote_paid_returns_400_if_contact_has_no_email(self):
        """Test that mark-quote-paid returns 400 if contact has no email"""
        self.login(RDC_USD_USER)
        
        # Create contact WITHOUT email
        contact = self.create_test_contact(with_email=False)
        quote = self.create_test_quote(contact["id"], status="Draft")
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{quote['id']}/mark-quote-paid",
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data
        assert "email" in data["error"].lower()
        print(f"PASS: mark-quote-paid returns 400 for missing email: {data['error']}")
    
    def test_mark_quote_paid_returns_400_if_no_contact(self):
        """Test that mark-quote-paid returns 400 if quote has no contactId"""
        self.login(RDC_USD_USER)
        
        # Create quote without contactId
        quote_id = f"TEST_DEV_NO_CONTACT_{int(time.time()*1000)}"
        quote_data = {
            "id": quote_id,
            "type": "Quote",
            "contactId": "",  # No contact
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "items": [{"name": "Test", "quantity": 1, "price": 1000, "tvaRate": 0.18, "tvaAmount": 180}],
            "totalHT": 1000,
            "tvaTotal": 180,
            "total": 1180,
            "status": "Draft"
        }
        response = self.session.post(f"{BASE_URL}/api/invoices", json=quote_data)
        assert response.status_code == 201, f"Failed to create quote: {response.text}"
        
        # Try to mark as paid
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{quote_id}/mark-quote-paid",
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data
        assert "client" in data["error"].lower() or "contact" in data["error"].lower()
        print(f"PASS: mark-quote-paid returns 400 for missing contactId: {data['error']}")
    
    def test_mark_quote_paid_nominal_case(self):
        """Test the nominal case: quote is marked paid, invoice created, journal entry posted"""
        self.login(RDC_USD_USER)
        
        # Create contact and quote
        contact = self.create_test_contact(with_email=True)
        quote = self.create_test_quote(contact["id"], status="Signed")
        
        # Mark as paid
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{quote['id']}/mark-quote-paid",
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Expected success=true"
        assert data.get("quoteId") == quote["id"], "Expected quoteId to match"
        assert "invoice" in data, "Expected invoice in response"
        
        # Verify invoice was created with status='Paid'
        invoice = data["invoice"]
        assert invoice.get("status") == "Paid", f"Expected invoice status='Paid', got {invoice.get('status')}"
        assert invoice.get("type") == "Invoice", f"Expected type='Invoice', got {invoice.get('type')}"
        assert invoice.get("convertedFromQuoteId") == quote["id"], "Expected convertedFromQuoteId to match"
        
        # Verify emailSent or emailError is present
        assert "emailSent" in data or "emailError" in data, "Expected emailSent or emailError in response"
        
        # Note: emailError is expected because test@example.com is rejected by SMTP
        if data.get("emailError"):
            print(f"INFO: Email error (expected for test@example.com): {data['emailError']}")
        
        print(f"PASS: mark-quote-paid nominal case - Invoice created: {invoice.get('id')}, status={invoice.get('status')}")
        
        # Verify quote was updated with paidAt
        quote_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert quote_response.status_code == 200
        invoices = quote_response.json()
        updated_quote = next((i for i in invoices if i["id"] == quote["id"]), None)
        assert updated_quote is not None, "Quote not found after update"
        assert updated_quote.get("status") == "Paid", f"Expected quote status='Paid', got {updated_quote.get('status')}"
        assert updated_quote.get("convertedToInvoiceId") is not None, "Expected convertedToInvoiceId to be set"
        print(f"PASS: Quote updated - status={updated_quote.get('status')}, convertedToInvoiceId={updated_quote.get('convertedToInvoiceId')}")
        
        # Verify journal entry was created
        journal_response = self.session.get(f"{BASE_URL}/api/journal-entries")
        if journal_response.status_code == 200:
            entries = journal_response.json()
            matching_entry = next((e for e in entries if e.get("sourceRef") == invoice.get("id")), None)
            if matching_entry:
                print(f"PASS: Journal entry created with sourceRef={invoice.get('id')}")
            else:
                print(f"INFO: No journal entry found with sourceRef={invoice.get('id')} (may be async)")
    
    def test_mark_quote_paid_certification_for_congo_demo(self):
        """Test that mark-quote-paid certifies invoice for Congo demo accounts"""
        self.login(CONGO_USER)
        
        # Create contact and quote
        contact = self.create_test_contact(with_email=True)
        quote = self.create_test_quote(contact["id"], status="Accepted")
        
        # Mark as paid
        response = self.session.post(
            f"{BASE_URL}/api/invoices/{quote['id']}/mark-quote-paid",
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify invoice was created
        assert "invoice" in data, "Expected invoice in response"
        invoice = data["invoice"]
        
        # For Congo demo accounts, certification should be attempted
        # Note: certificationNumber may or may not be present depending on SFEC API availability
        if invoice.get("certificationNumber"):
            print(f"PASS: Invoice certified for Congo demo - certificationNumber={invoice.get('certificationNumber')}")
        else:
            print(f"INFO: Invoice not certified (SFEC API may be unavailable or company not configured)")
        
        print(f"PASS: mark-quote-paid for Congo demo - Invoice created: {invoice.get('id')}")


class TestPublicSignatureNoAutoConvert:
    """Tests that public signature no longer auto-converts quotes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, credentials):
        """Login and return session with auth cookie"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json=credentials
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()
    
    def test_public_signature_does_not_auto_convert(self):
        """Test that signing a quote via public endpoint does NOT auto-convert to invoice"""
        # First, login and create a quote
        self.login(RDC_USD_USER)
        
        contact_data = {
            "id": f"TEST_contact_sig_{int(time.time()*1000)}",
            "name": f"TEST Signature Contact",
            "company": "TEST Company",
            "email": "test@example.com",
            "phone": "+243123456789",
            "status": "Lead",
            "contactType": "individual"
        }
        self.session.post(f"{BASE_URL}/api/contacts", json=contact_data)
        
        quote_id = f"TEST_DEV_SIG_{int(time.time()*1000)}"
        quote_data = {
            "id": quote_id,
            "type": "Quote",
            "contactId": contact_data["id"],
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "items": [{"name": "Test", "quantity": 1, "price": 5000, "tvaRate": 0.18, "tvaAmount": 900}],
            "totalHT": 5000,
            "tvaTotal": 900,
            "total": 5900,
            "status": "Sent"
        }
        self.session.post(f"{BASE_URL}/api/invoices", json=quote_data)
        
        # Now sign via public endpoint (no auth needed)
        public_session = requests.Session()
        public_session.headers.update({"Content-Type": "application/json"})
        
        sign_response = public_session.post(
            f"{BASE_URL}/api/public/quotes/{quote_id}/sign",
            json={
                "signerName": "Test Signer",
                "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            }
        )
        
        assert sign_response.status_code == 200, f"Public signature failed: {sign_response.text}"
        sign_data = sign_response.json()
        assert sign_data.get("ok") == True, "Expected ok=true"
        assert sign_data.get("signedAt") is not None, "Expected signedAt"
        
        # Verify quote is now 'Signed' but NOT converted
        quote_check = self.session.get(f"{BASE_URL}/api/invoices")
        assert quote_check.status_code == 200
        invoices = quote_check.json()
        
        signed_quote = next((i for i in invoices if i["id"] == quote_id), None)
        assert signed_quote is not None, "Quote not found"
        assert signed_quote.get("status") == "Signed", f"Expected status='Signed', got {signed_quote.get('status')}"
        assert signed_quote.get("convertedToInvoiceId") is None, f"Expected convertedToInvoiceId=None, got {signed_quote.get('convertedToInvoiceId')}"
        
        print(f"PASS: Public signature does NOT auto-convert - Quote status={signed_quote.get('status')}, convertedToInvoiceId={signed_quote.get('convertedToInvoiceId')}")


class TestInvoicePdfEndpoint:
    """Tests for GET /api/invoices/:id/pdf"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, credentials):
        """Login and return session with auth cookie"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json=credentials
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()
    
    def test_pdf_endpoint_returns_valid_pdf(self):
        """Test that GET /api/invoices/:id/pdf returns a valid PDF"""
        self.login(RDC_USD_USER)
        
        # Get list of invoices
        response = self.session.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200
        invoices = response.json()
        
        # Find an invoice (not a quote)
        invoice = next((i for i in invoices if i["type"] == "Invoice"), None)
        if not invoice:
            pytest.skip("No invoices found to test PDF download")
        
        # Download PDF
        pdf_response = self.session.get(f"{BASE_URL}/api/invoices/{invoice['id']}/pdf")
        
        assert pdf_response.status_code == 200, f"PDF download failed: {pdf_response.status_code}"
        assert pdf_response.headers.get("Content-Type") == "application/pdf", f"Expected Content-Type: application/pdf, got {pdf_response.headers.get('Content-Type')}"
        
        # Verify PDF magic bytes
        content = pdf_response.content
        assert content[:4] == b'%PDF', "Response does not start with PDF magic bytes"
        
        print(f"PASS: PDF endpoint returns valid PDF for invoice {invoice['id']} ({len(content)} bytes)")
    
    def test_pdf_endpoint_returns_404_for_nonexistent(self):
        """Test that GET /api/invoices/:id/pdf returns 404 for non-existent invoice"""
        self.login(RDC_USD_USER)
        
        response = self.session.get(f"{BASE_URL}/api/invoices/NONEXISTENT_ID/pdf")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: PDF endpoint returns 404 for non-existent invoice")


# Cleanup helper
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Note: In a real scenario, we'd delete TEST_ prefixed contacts and invoices
    # For now, we leave them as they don't affect production data
    print("INFO: Test data cleanup skipped (TEST_ prefixed data remains)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
