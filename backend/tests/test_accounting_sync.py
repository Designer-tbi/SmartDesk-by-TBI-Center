"""
Test Accounting Module Synchronization - Iteration 15

Tests:
1. POST /api/invoices with status='Paid' triggers AUTO journal entry via autoPostPaidInvoiceJournal
2. Journal entry contains 3 items: account 521 (Banques) debit=total, 701 (Ventes) credit=totalHT, 445 (TVA) credit=tvaTotal+centimes
3. Journal entry has sourceRef = invoice.id (traceability link)
4. Idempotence: calling 2x the same Paid case doesn't create 2 journal entries for the same invoice
5. PUT /api/invoices/:id with Draft→Paid transition continues to trigger auto-journal (regression)
6. Manual journal entry creation (POST /api/journal-entries) remains possible
"""

import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
TEST_EMAIL = "ariane.mbombo@tbi-center.fr"
TEST_PASSWORD = "admin"
COMPANY_ID = "demo-company-1777919795902"

# Contact for testing (mentioned in agent context)
TEST_CONTACT_ID = "contact-sync-test"


class TestAccountingSync:
    """Test accounting module synchronization with invoices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
        print(f"Logged in as {self.user.get('email')} (company: {self.user.get('companyId')})")
        
        yield
        
        # Cleanup: logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def get_journal_entries(self):
        """Fetch all journal entries"""
        response = self.session.get(f"{BASE_URL}/api/journal-entries")
        assert response.status_code == 200, f"Failed to fetch journal entries: {response.text}"
        return response.json()
    
    def get_invoices(self):
        """Fetch all invoices"""
        response = self.session.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200, f"Failed to fetch invoices: {response.text}"
        return response.json()
    
    def find_journal_entry_by_source_ref(self, source_ref):
        """Find journal entry by sourceRef (invoice id)"""
        entries = self.get_journal_entries()
        for entry in entries:
            if entry.get("sourceRef") == source_ref:
                return entry
        return None
    
    def test_01_post_invoice_paid_creates_auto_journal(self):
        """POST /api/invoices with status='Paid' triggers AUTO journal entry"""
        # Create a unique invoice ID
        invoice_id = f"INV-TEST-{int(time.time())}"
        
        # Create invoice with status='Paid'
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,  # No contact for simplicity
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "notes": "Test invoice for auto-journal",
            "items": [
                {
                    "name": "Test Product",
                    "description": "Test description",
                    "quantity": 2,
                    "price": 50000,  # 50,000 CDF
                    "tvaRate": 16,
                    "tvaAmount": 16000  # 16% of 100,000
                }
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/invoices",
            json=invoice_data
        )
        assert response.status_code == 201, f"Failed to create invoice: {response.text}"
        created_invoice = response.json()
        print(f"Created invoice: {created_invoice.get('id')}, status: {created_invoice.get('status')}")
        print(f"Invoice totals - totalHT: {created_invoice.get('totalHT')}, tvaTotal: {created_invoice.get('tvaTotal')}, total: {created_invoice.get('total')}")
        
        # Wait for async auto-journal to complete (fire-and-forget)
        time.sleep(2)
        
        # Check that journal entry was created with sourceRef = invoice.id
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is not None, f"No journal entry found with sourceRef={invoice_id}"
        
        print(f"Found journal entry: {journal_entry.get('id')}, sourceRef: {journal_entry.get('sourceRef')}")
        print(f"Journal entry items: {journal_entry.get('items')}")
        
        # Verify sourceRef matches invoice id
        assert journal_entry.get("sourceRef") == invoice_id, "Journal entry sourceRef doesn't match invoice id"
        
        # Store for next tests
        self.test_invoice_id = invoice_id
        self.test_journal_entry = journal_entry
        
        return invoice_id, journal_entry
    
    def test_02_journal_entry_has_correct_accounts(self):
        """Journal entry contains accounts 521 (Banques), 701 (Ventes), 445 (TVA)"""
        # Create a new invoice to test
        invoice_id = f"INV-ACCT-{int(time.time())}"
        
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "notes": "Test invoice for account verification",
            "items": [
                {
                    "name": "Service",
                    "quantity": 1,
                    "price": 100000,  # 100,000 CDF HT
                    "tvaRate": 16,
                    "tvaAmount": 16000  # 16,000 CDF TVA
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201, f"Failed to create invoice: {response.text}"
        created_invoice = response.json()
        
        # Wait for auto-journal
        time.sleep(2)
        
        # Find the journal entry
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is not None, f"No journal entry found for invoice {invoice_id}"
        
        items = journal_entry.get("items", [])
        print(f"Journal items: {items}")
        
        # Extract account IDs
        account_ids = [item.get("accountId") for item in items]
        print(f"Account IDs in journal: {account_ids}")
        
        # Verify accounts 521, 701, 445 are present
        assert "521" in account_ids, "Account 521 (Banques) not found in journal entry"
        assert "701" in account_ids, "Account 701 (Ventes) not found in journal entry"
        assert "445" in account_ids, "Account 445 (TVA) not found in journal entry"
        
        # Verify debit/credit structure
        for item in items:
            acc = item.get("accountId")
            debit = item.get("debit", 0)
            credit = item.get("credit", 0)
            print(f"  Account {acc}: debit={debit}, credit={credit}")
            
            if acc == "521":
                # Banques should be debited (total TTC)
                assert debit > 0, "Account 521 (Banques) should have debit > 0"
                assert credit == 0, "Account 521 (Banques) should have credit = 0"
            elif acc == "701":
                # Ventes should be credited (total HT)
                assert credit > 0, "Account 701 (Ventes) should have credit > 0"
                assert debit == 0, "Account 701 (Ventes) should have debit = 0"
            elif acc == "445":
                # TVA should be credited
                assert credit > 0, "Account 445 (TVA) should have credit > 0"
                assert debit == 0, "Account 445 (TVA) should have debit = 0"
        
        print("✓ All accounts verified: 521 (debit), 701 (credit), 445 (credit)")
    
    def test_03_journal_entry_amounts_match_invoice(self):
        """Journal entry amounts match invoice totals"""
        invoice_id = f"INV-AMT-{int(time.time())}"
        
        # Create invoice with known amounts
        total_ht = 200000  # 200,000 CDF
        tva_rate = 16
        tva_amount = int(total_ht * tva_rate / 100)  # 32,000 CDF
        
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "items": [
                {
                    "name": "Product A",
                    "quantity": 1,
                    "price": total_ht,
                    "tvaRate": tva_rate,
                    "tvaAmount": tva_amount
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201
        created_invoice = response.json()
        
        # POST response uses brutHT, stored invoice uses totalHT
        invoice_total_ht = float(created_invoice.get("totalHT") or created_invoice.get("brutHT") or 0)
        invoice_tva_total = float(created_invoice.get("tvaTotal", 0))
        invoice_total = float(created_invoice.get("total", 0))
        centimes = float(created_invoice.get("centimesAdditionnels", 0))
        
        print(f"Invoice: totalHT={invoice_total_ht}, tvaTotal={invoice_tva_total}, total={invoice_total}, centimes={centimes}")
        
        time.sleep(2)
        
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is not None
        
        items = journal_entry.get("items", [])
        
        # Find amounts by account
        debit_521 = 0
        credit_701 = 0
        credit_445 = 0
        
        for item in items:
            acc = item.get("accountId")
            if acc == "521":
                debit_521 = float(item.get("debit", 0))
            elif acc == "701":
                credit_701 = float(item.get("credit", 0))
            elif acc == "445":
                credit_445 = float(item.get("credit", 0))
        
        print(f"Journal: 521 debit={debit_521}, 701 credit={credit_701}, 445 credit={credit_445}")
        
        # Verify amounts
        # 521 (Banques) debit = total TTC
        assert abs(debit_521 - invoice_total) < 1, f"521 debit ({debit_521}) should equal invoice total ({invoice_total})"
        
        # 701 (Ventes) credit = total HT
        assert abs(credit_701 - invoice_total_ht) < 1, f"701 credit ({credit_701}) should equal totalHT ({invoice_total_ht})"
        
        # 445 (TVA) credit = tvaTotal + centimes
        expected_tva_credit = invoice_tva_total + centimes
        assert abs(credit_445 - expected_tva_credit) < 1, f"445 credit ({credit_445}) should equal tvaTotal+centimes ({expected_tva_credit})"
        
        # Verify balanced entry
        total_debit = sum(float(item.get("debit", 0)) for item in items)
        total_credit = sum(float(item.get("credit", 0)) for item in items)
        assert abs(total_debit - total_credit) < 1, f"Journal entry not balanced: debit={total_debit}, credit={total_credit}"
        
        print("✓ Journal entry amounts match invoice totals and entry is balanced")
    
    def test_04_idempotence_no_duplicate_journal(self):
        """Idempotence: calling 2x the same Paid case doesn't create 2 journal entries"""
        invoice_id = f"INV-IDEM-{int(time.time())}"
        
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "items": [
                {"name": "Item", "quantity": 1, "price": 50000, "tvaRate": 16, "tvaAmount": 8000}
            ]
        }
        
        # Create invoice (triggers auto-journal)
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201
        
        time.sleep(2)
        
        # Count journal entries with this sourceRef
        entries_before = [e for e in self.get_journal_entries() if e.get("sourceRef") == invoice_id]
        count_before = len(entries_before)
        print(f"Journal entries for {invoice_id} after first create: {count_before}")
        assert count_before == 1, f"Expected 1 journal entry, got {count_before}"
        
        # Try to update the invoice to Paid again (should not create another journal)
        update_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "items": [
                {"name": "Item", "quantity": 1, "price": 50000, "tvaRate": 16, "tvaAmount": 8000}
            ]
        }
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=update_data)
        assert response.status_code == 200
        
        time.sleep(2)
        
        # Count again
        entries_after = [e for e in self.get_journal_entries() if e.get("sourceRef") == invoice_id]
        count_after = len(entries_after)
        print(f"Journal entries for {invoice_id} after second update: {count_after}")
        
        assert count_after == 1, f"Idempotence failed: expected 1 journal entry, got {count_after}"
        print("✓ Idempotence verified: no duplicate journal entries created")
    
    def test_05_put_draft_to_paid_triggers_journal(self):
        """PUT /api/invoices/:id with Draft→Paid transition triggers auto-journal (regression)"""
        invoice_id = f"INV-DRAFT-{int(time.time())}"
        
        # Create invoice as Draft
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Draft",  # Start as Draft
            "items": [
                {"name": "Draft Item", "quantity": 1, "price": 75000, "tvaRate": 16, "tvaAmount": 12000}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201
        print(f"Created Draft invoice: {invoice_id}")
        
        time.sleep(1)
        
        # Verify no journal entry yet
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is None, "Journal entry should not exist for Draft invoice"
        print("✓ No journal entry for Draft invoice (correct)")
        
        # Update to Paid
        update_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",  # Transition to Paid
            "items": [
                {"name": "Draft Item", "quantity": 1, "price": 75000, "tvaRate": 16, "tvaAmount": 12000}
            ]
        }
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=update_data)
        assert response.status_code == 200
        print(f"Updated invoice to Paid")
        
        time.sleep(2)
        
        # Verify journal entry was created
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is not None, f"Journal entry should exist after Draft→Paid transition"
        print(f"✓ Journal entry created after Draft→Paid: {journal_entry.get('id')}")
        
        # Verify accounts
        items = journal_entry.get("items", [])
        account_ids = [item.get("accountId") for item in items]
        assert "521" in account_ids, "Account 521 missing"
        assert "701" in account_ids, "Account 701 missing"
        assert "445" in account_ids, "Account 445 missing"
        print("✓ Draft→Paid transition triggers auto-journal correctly (regression test passed)")
    
    def test_06_manual_journal_entry_creation(self):
        """Manual journal entry creation (POST /api/journal-entries) remains possible"""
        entry_id = f"je_manual_{int(time.time())}"
        
        journal_data = {
            "id": entry_id,
            "date": "2026-01-07",
            "description": "Manual test entry - Achat fournitures",
            "items": [
                {"accountId": "601", "debit": 50000, "credit": 0},  # Achats
                {"accountId": "521", "debit": 0, "credit": 50000}   # Banques
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/journal-entries", json=journal_data)
        assert response.status_code in [200, 201], f"Failed to create manual journal entry: {response.text}"
        
        created = response.json()
        print(f"Created manual journal entry: {created.get('id')}")
        
        # Verify it appears in the list
        entries = self.get_journal_entries()
        found = any(e.get("id") == entry_id for e in entries)
        assert found, f"Manual journal entry {entry_id} not found in list"
        
        print("✓ Manual journal entry creation works correctly")
    
    def test_07_journal_entry_has_source_ref(self):
        """Journal entry has sourceRef = invoice.id for traceability"""
        invoice_id = f"INV-REF-{int(time.time())}"
        
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": None,
            "date": "2026-01-07",
            "dueDate": "2026-02-07",
            "status": "Paid",
            "items": [
                {"name": "Ref Test", "quantity": 1, "price": 30000, "tvaRate": 16, "tvaAmount": 4800}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201
        
        time.sleep(2)
        
        journal_entry = self.find_journal_entry_by_source_ref(invoice_id)
        assert journal_entry is not None, "Journal entry not found"
        
        source_ref = journal_entry.get("sourceRef")
        assert source_ref == invoice_id, f"sourceRef ({source_ref}) should equal invoice id ({invoice_id})"
        
        print(f"✓ Journal entry sourceRef = {source_ref} matches invoice id")


class TestJournalEntryDisplay:
    """Test journal entry display in frontend (account codes)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_journal_entries_have_account_ids(self):
        """Journal entries have accountId field for display"""
        response = self.session.get(f"{BASE_URL}/api/journal-entries")
        assert response.status_code == 200
        
        entries = response.json()
        if len(entries) == 0:
            pytest.skip("No journal entries to test")
        
        # Check first entry with items
        for entry in entries:
            items = entry.get("items", [])
            if items:
                for item in items:
                    account_id = item.get("accountId")
                    assert account_id is not None, f"Item missing accountId: {item}"
                    # Account ID should be a string like "521", "701", "445"
                    assert isinstance(account_id, str), f"accountId should be string: {account_id}"
                    print(f"Entry {entry.get('id')}: accountId={account_id}")
                break
        
        print("✓ Journal entries have accountId field for display")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
