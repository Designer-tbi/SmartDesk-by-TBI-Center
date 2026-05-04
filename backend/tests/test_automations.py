"""
SmartDesk Phase 1 Automation Tests
Tests cross-module automations:
1. Quote signed → auto draft invoice
2. Invoice paid → auto journal entry (OHADA)
3. Contract signed → auto draft payslip
4. New employee → auto draft CDI contract

All automations must be idempotent (no duplicates on repeat triggers).
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

# Test credentials
DEMO_1_ADMIN = {"email": "admin@smartdesk.cg", "password": "admin"}

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_AUTO_"


class TestSetup:
    """Setup and helper methods"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session for demo-1"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        # Session cookies are set automatically
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for demo-1"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return resp.cookies.get('token') or resp.json().get('token')


class TestEmployeeAutoContract:
    """Test: POST /api/employees → auto-creates draft CDI contract"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_create_employee_auto_contract(self, auth_session):
        """Creating a new employee should auto-create a draft contract"""
        timestamp = int(time.time())
        employee_id = f"{TEST_PREFIX}emp_{timestamp}"
        
        employee_data = {
            "id": employee_id,
            "name": f"Test Employee {timestamp}",
            "email": f"test{timestamp}@example.com",
            "phone": "0612345678",
            "role": "Développeur",
            "department": "IT",
            "status": "Active",
            "contractType": "CDI",
            "joinDate": "2026-01-15",
            "salary": 500000
        }
        
        # Create employee
        resp = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        print(f"Employee created: {data.get('id')}")
        
        # Verify autoContractId is returned
        assert "autoContractId" in data, "Response should include autoContractId"
        auto_contract_id = data["autoContractId"]
        assert auto_contract_id is not None, "autoContractId should not be null"
        print(f"✓ Auto contract created: {auto_contract_id}")
        
        # Verify contract exists with correct data
        contracts_resp = auth_session.get(f"{BASE_URL}/api/employees/contracts")
        assert contracts_resp.status_code == 200
        contracts = contracts_resp.json()
        
        auto_contract = next((c for c in contracts if c["id"] == auto_contract_id), None)
        assert auto_contract is not None, f"Auto contract {auto_contract_id} not found in contracts list"
        
        # Verify contract properties
        assert auto_contract["employeeId"] == employee_id, "Contract should be linked to employee"
        assert auto_contract["type"] == "CDI", "Contract type should match employee's contractType"
        assert auto_contract["status"] == "Draft", "Auto contract should be Draft status"
        assert auto_contract["salary"] == 500000, "Contract salary should match employee salary"
        assert auto_contract["startDate"] == "2026-01-15", "Contract startDate should match joinDate"
        
        print(f"✓ Contract verified: type={auto_contract['type']}, status={auto_contract['status']}, salary={auto_contract['salary']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")
        print(f"✓ Cleanup: deleted employee {employee_id}")
    
    def test_employee_auto_contract_idempotency(self, auth_session):
        """Creating employee that already has contract should NOT create duplicate"""
        timestamp = int(time.time())
        employee_id = f"{TEST_PREFIX}emp_idem_{timestamp}"
        
        employee_data = {
            "id": employee_id,
            "name": f"Test Idempotent {timestamp}",
            "email": f"idem{timestamp}@example.com",
            "phone": "0612345678",
            "role": "Manager",
            "department": "HR",
            "status": "Active",
            "contractType": "CDI",
            "joinDate": "2026-01-20",
            "salary": 600000
        }
        
        # Create employee first time
        resp1 = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert resp1.status_code == 201
        first_contract_id = resp1.json().get("autoContractId")
        print(f"First creation: autoContractId={first_contract_id}")
        
        # Get contracts count before
        contracts_before = auth_session.get(f"{BASE_URL}/api/employees/contracts").json()
        count_before = len([c for c in contracts_before if c["employeeId"] == employee_id])
        
        # Try to create same employee again (edge case - should fail or be idempotent)
        # Note: This tests the idempotency check in autoCreateDefaultContract
        # The employee POST itself may fail due to duplicate ID, which is expected
        resp2 = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        
        # Get contracts count after
        contracts_after = auth_session.get(f"{BASE_URL}/api/employees/contracts").json()
        count_after = len([c for c in contracts_after if c["employeeId"] == employee_id])
        
        # Should still have only 1 contract for this employee
        assert count_after == count_before, f"Idempotency violated: had {count_before} contracts, now have {count_after}"
        print(f"✓ Idempotency verified: still {count_after} contract(s) for employee")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")


class TestContractSignedAutoPayslip:
    """Test: PUT /api/employees/contracts/:id (status→Signed) → auto draft payslip"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return session
    
    def test_contract_signed_auto_payslip(self, auth_session):
        """Signing a contract should auto-create draft payslip for current month"""
        timestamp = int(time.time())
        employee_id = f"{TEST_PREFIX}emp_pay_{timestamp}"
        
        # Create employee (auto-creates draft contract)
        employee_data = {
            "id": employee_id,
            "name": f"Test Payslip {timestamp}",
            "email": f"payslip{timestamp}@example.com",
            "phone": "0612345678",
            "role": "Comptable",
            "department": "Finance",
            "status": "Active",
            "contractType": "CDI",
            "joinDate": "2026-01-01",
            "salary": 450000
        }
        
        emp_resp = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert emp_resp.status_code == 201
        contract_id = emp_resp.json().get("autoContractId")
        print(f"Employee created with contract: {contract_id}")
        
        # Get the contract
        contracts = auth_session.get(f"{BASE_URL}/api/employees/contracts").json()
        contract = next((c for c in contracts if c["id"] == contract_id), None)
        assert contract is not None
        assert contract["status"] == "Draft"
        
        # Update contract status to Signed
        contract["status"] = "Signed"
        contract["signedAt"] = "2026-01-15T10:00:00Z"
        
        put_resp = auth_session.put(f"{BASE_URL}/api/employees/contracts/{contract_id}", json=contract)
        assert put_resp.status_code == 200, f"Expected 200, got {put_resp.status_code}: {put_resp.text}"
        
        data = put_resp.json()
        print(f"Contract updated: status={data.get('status')}")
        
        # Verify autoPayslipId is returned
        assert "autoPayslipId" in data, "Response should include autoPayslipId"
        auto_payslip_id = data["autoPayslipId"]
        assert auto_payslip_id is not None, "autoPayslipId should not be null"
        print(f"✓ Auto payslip created: {auto_payslip_id}")
        
        # Verify payslip exists with correct data
        payslips = auth_session.get(f"{BASE_URL}/api/employees/payslips").json()
        auto_payslip = next((p for p in payslips if p["id"] == auto_payslip_id), None)
        assert auto_payslip is not None, f"Auto payslip {auto_payslip_id} not found"
        
        # Verify payslip properties
        assert auto_payslip["employeeId"] == employee_id
        assert auto_payslip["status"] == "Draft"
        assert auto_payslip["baseSalary"] == 450000
        
        # For Congo company: netSalary = base - CNSS(4%) - IRPP
        # CNSS = 450000 * 0.04 = 18000
        # Taxable = 450000 - 18000 = 432000
        # IRPP brackets: 0-54166 (0%), 54166-125000 (8%), 125000-291666 (15%), 291666-500000 (20%)
        # Expected IRPP ≈ 0 + (125000-54166)*0.08 + (291666-125000)*0.15 + (432000-291666)*0.20
        # = 5666.72 + 24999.9 + 28066.8 ≈ 58733
        # Net = 450000 - 18000 - 58733 = 373267
        
        print(f"✓ Payslip verified: baseSalary={auto_payslip['baseSalary']}, netSalary={auto_payslip['netSalary']}, deductions={auto_payslip['deductions']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")
    
    def test_contract_signed_payslip_idempotency(self, auth_session):
        """Signing contract twice for same month should NOT create duplicate payslip"""
        timestamp = int(time.time())
        employee_id = f"{TEST_PREFIX}emp_idem_pay_{timestamp}"
        
        # Create employee
        employee_data = {
            "id": employee_id,
            "name": f"Test Idem Payslip {timestamp}",
            "email": f"idempay{timestamp}@example.com",
            "phone": "0612345678",
            "role": "Analyste",
            "department": "Data",
            "status": "Active",
            "contractType": "CDI",
            "joinDate": "2026-01-01",
            "salary": 400000
        }
        
        emp_resp = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert emp_resp.status_code == 201
        contract_id = emp_resp.json().get("autoContractId")
        
        # Get contract
        contracts = auth_session.get(f"{BASE_URL}/api/employees/contracts").json()
        contract = next((c for c in contracts if c["id"] == contract_id), None)
        
        # Sign contract first time
        contract["status"] = "Signed"
        put_resp1 = auth_session.put(f"{BASE_URL}/api/employees/contracts/{contract_id}", json=contract)
        assert put_resp1.status_code == 200
        first_payslip_id = put_resp1.json().get("autoPayslipId")
        print(f"First sign: autoPayslipId={first_payslip_id}")
        
        # Count payslips for this employee
        payslips_before = auth_session.get(f"{BASE_URL}/api/employees/payslips").json()
        count_before = len([p for p in payslips_before if p["employeeId"] == employee_id])
        
        # Try to sign again (status already Signed, but trigger the PUT again)
        # Change to Active then back to Signed to trigger the automation again
        contract["status"] = "Active"
        auth_session.put(f"{BASE_URL}/api/employees/contracts/{contract_id}", json=contract)
        
        # Now sign again
        contract["status"] = "Signed"
        put_resp2 = auth_session.put(f"{BASE_URL}/api/employees/contracts/{contract_id}", json=contract)
        assert put_resp2.status_code == 200
        second_payslip_id = put_resp2.json().get("autoPayslipId")
        print(f"Second sign: autoPayslipId={second_payslip_id}")
        
        # Count payslips after
        payslips_after = auth_session.get(f"{BASE_URL}/api/employees/payslips").json()
        count_after = len([p for p in payslips_after if p["employeeId"] == employee_id])
        
        # Should still have only 1 payslip for this month
        assert count_after == count_before, f"Idempotency violated: had {count_before} payslips, now have {count_after}"
        assert second_payslip_id is None, "Second sign should return null autoPayslipId (already exists)"
        print(f"✓ Payslip idempotency verified: still {count_after} payslip(s)")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")


class TestInvoicePaidAutoJournal:
    """Test: PUT /api/invoices/:id (status→Paid) → auto journal entry (OHADA)"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return session
    
    def test_invoice_paid_auto_journal(self, auth_session):
        """Marking invoice as Paid should auto-create OHADA journal entry"""
        timestamp = int(time.time())
        invoice_id = f"{TEST_PREFIX}INV_{timestamp}"
        
        # Create a draft invoice
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": "ct_rec",  # Existing test contact
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "status": "Draft",
            "notes": "Test invoice for journal automation",
            "items": [
                {
                    "name": "Service Test",
                    "description": "Test service item",
                    "quantity": 1,
                    "price": 100000,
                    "tvaRate": 18,
                    "tvaAmount": 18000
                }
            ],
            "remise": 0,
            "remiseType": "amount",
            "rabais": 0,
            "rabaisType": "amount",
            "ristourne": 0,
            "ristourneType": "amount",
            "escompte": 0,
            "escompteType": "percent"
        }
        
        # Create invoice
        create_resp = auth_session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
        created_invoice = create_resp.json()
        print(f"Invoice created: {invoice_id}, total={created_invoice.get('total')}")
        
        # Get journal entries count before
        journal_before = auth_session.get(f"{BASE_URL}/api/journal-entries").json()
        count_before = len([j for j in journal_before if j.get("sourceRef") == invoice_id])
        
        # Update invoice status to Paid
        invoice_data["status"] = "Paid"
        invoice_data["totalHT"] = created_invoice.get("totalHT", created_invoice.get("brutHT", 100000))
        invoice_data["tvaTotal"] = created_invoice.get("tvaTotal", 18000)
        invoice_data["total"] = created_invoice.get("total", 118900)  # With CAC
        
        put_resp = auth_session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=invoice_data)
        assert put_resp.status_code == 200, f"Expected 200, got {put_resp.status_code}: {put_resp.text}"
        print(f"Invoice updated to Paid")
        
        # Verify journal entry was created
        journal_after = auth_session.get(f"{BASE_URL}/api/journal-entries").json()
        new_entries = [j for j in journal_after if j.get("sourceRef") == invoice_id]
        
        assert len(new_entries) == 1, f"Expected 1 journal entry for invoice, got {len(new_entries)}"
        journal_entry = new_entries[0]
        print(f"✓ Journal entry created: {journal_entry['id']}")
        
        # Verify journal entry has correct structure
        assert journal_entry["sourceRef"] == invoice_id
        assert "Encaissement facture" in journal_entry.get("description", "")
        
        # Get journal items
        # Note: journal_items may be included in the entry or need separate fetch
        print(f"✓ Journal entry verified: id={journal_entry['id']}, description={journal_entry.get('description', '')[:50]}...")
        
        # Cleanup - delete invoice (will cascade delete journal entry if FK exists)
        auth_session.delete(f"{BASE_URL}/api/invoices/{invoice_id}")
    
    def test_invoice_paid_journal_idempotency(self, auth_session):
        """Marking same invoice Paid twice should NOT create duplicate journal entry"""
        timestamp = int(time.time())
        invoice_id = f"{TEST_PREFIX}INV_IDEM_{timestamp}"
        
        # Create invoice
        invoice_data = {
            "id": invoice_id,
            "type": "Invoice",
            "contactId": "ct_rec",
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "status": "Draft",
            "items": [
                {"name": "Test Item", "quantity": 1, "price": 50000, "tvaRate": 18, "tvaAmount": 9000}
            ],
            "remise": 0, "remiseType": "amount",
            "rabais": 0, "rabaisType": "amount",
            "ristourne": 0, "ristourneType": "amount",
            "escompte": 0, "escompteType": "percent"
        }
        
        create_resp = auth_session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert create_resp.status_code == 201
        created = create_resp.json()
        
        # First: mark as Paid
        invoice_data["status"] = "Paid"
        invoice_data["totalHT"] = created.get("totalHT", created.get("brutHT", 50000))
        invoice_data["tvaTotal"] = created.get("tvaTotal", 9000)
        invoice_data["total"] = created.get("total", 59450)
        
        put_resp1 = auth_session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=invoice_data)
        assert put_resp1.status_code == 200
        
        # Count journal entries
        journal_after_first = auth_session.get(f"{BASE_URL}/api/journal-entries").json()
        count_first = len([j for j in journal_after_first if j.get("sourceRef") == invoice_id])
        print(f"After first Paid: {count_first} journal entries")
        
        # Second: mark as Paid again (already Paid, but trigger PUT)
        put_resp2 = auth_session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=invoice_data)
        assert put_resp2.status_code == 200
        
        # Count journal entries again
        journal_after_second = auth_session.get(f"{BASE_URL}/api/journal-entries").json()
        count_second = len([j for j in journal_after_second if j.get("sourceRef") == invoice_id])
        print(f"After second Paid: {count_second} journal entries")
        
        assert count_second == count_first, f"Idempotency violated: had {count_first}, now have {count_second}"
        print(f"✓ Journal idempotency verified: still {count_second} entry")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/invoices/{invoice_id}")


class TestQuoteSignedAutoInvoice:
    """Test: Quote signed → auto draft invoice"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return session
    
    def test_quote_signed_internal_auto_invoice(self, auth_session):
        """Signing a quote internally should auto-create draft invoice"""
        timestamp = int(time.time())
        quote_id = f"{TEST_PREFIX}DEV_{timestamp}"
        
        # Create a quote
        quote_data = {
            "id": quote_id,
            "type": "Quote",
            "contactId": "ct_rec",
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "status": "Draft",
            "notes": "Test quote for auto-invoice",
            "items": [
                {"name": "Consulting", "quantity": 10, "price": 25000, "tvaRate": 18, "tvaAmount": 45000}
            ],
            "remise": 0, "remiseType": "amount",
            "rabais": 0, "rabaisType": "amount",
            "ristourne": 0, "ristourneType": "amount",
            "escompte": 0, "escompteType": "percent"
        }
        
        create_resp = auth_session.post(f"{BASE_URL}/api/invoices", json=quote_data)
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
        print(f"Quote created: {quote_id}")
        
        # Get invoices count before
        invoices_before = auth_session.get(f"{BASE_URL}/api/invoices").json()
        invoice_count_before = len([i for i in invoices_before if i.get("convertedFromQuoteId") == quote_id])
        
        # Sign the quote (internal flow via PUT)
        quote_data["status"] = "Signed"
        quote_data["signedAt"] = "2026-01-16T10:00:00Z"
        quote_data["signatureLink"] = '{"signerName":"Test Signer","signatureDataUrl":"data:image/png;base64,test"}'
        
        put_resp = auth_session.put(f"{BASE_URL}/api/invoices/{quote_id}", json=quote_data)
        assert put_resp.status_code == 200, f"Expected 200, got {put_resp.status_code}: {put_resp.text}"
        print(f"Quote signed internally")
        
        # Verify auto invoice was created
        invoices_after = auth_session.get(f"{BASE_URL}/api/invoices").json()
        auto_invoices = [i for i in invoices_after if i.get("convertedFromQuoteId") == quote_id]
        
        assert len(auto_invoices) == 1, f"Expected 1 auto invoice, got {len(auto_invoices)}"
        auto_invoice = auto_invoices[0]
        print(f"✓ Auto invoice created: {auto_invoice['id']}")
        
        # Verify auto invoice properties
        assert auto_invoice["type"] == "Invoice"
        assert auto_invoice["status"] == "Draft"
        assert auto_invoice["convertedFromQuoteId"] == quote_id
        
        # Verify source quote is now Converted
        updated_quote = next((i for i in invoices_after if i["id"] == quote_id), None)
        assert updated_quote is not None
        assert updated_quote["status"] == "Converted", f"Quote status should be Converted, got {updated_quote['status']}"
        assert updated_quote.get("convertedToInvoiceId") == auto_invoice["id"]
        
        print(f"✓ Quote status: {updated_quote['status']}, convertedToInvoiceId: {updated_quote.get('convertedToInvoiceId')}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/invoices/{auto_invoice['id']}")
        auth_session.delete(f"{BASE_URL}/api/invoices/{quote_id}")
    
    def test_public_quote_sign_auto_invoice(self, auth_session):
        """Signing quote via public link should auto-create draft invoice"""
        timestamp = int(time.time())
        quote_id = f"{TEST_PREFIX}DEV_PUB_{timestamp}"
        
        # Create a quote
        quote_data = {
            "id": quote_id,
            "type": "Quote",
            "contactId": "ct_rec",
            "date": "2026-01-15",
            "dueDate": "2026-02-15",
            "status": "Sent",  # Must be Sent to be signable via public link
            "items": [
                {"name": "Service", "quantity": 5, "price": 20000, "tvaRate": 18, "tvaAmount": 18000}
            ],
            "remise": 0, "remiseType": "amount",
            "rabais": 0, "rabaisType": "amount",
            "ristourne": 0, "ristourneType": "amount",
            "escompte": 0, "escompteType": "percent"
        }
        
        create_resp = auth_session.post(f"{BASE_URL}/api/invoices", json=quote_data)
        assert create_resp.status_code == 201
        print(f"Quote created: {quote_id}")
        
        # Sign via public endpoint (no auth required)
        sign_data = {
            "signerName": "Client Test",
            "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
        
        sign_resp = requests.post(f"{BASE_URL}/api/public/quotes/{quote_id}/sign", json=sign_data)
        assert sign_resp.status_code == 200, f"Expected 200, got {sign_resp.status_code}: {sign_resp.text}"
        
        sign_result = sign_resp.json()
        print(f"Public sign result: {sign_result}")
        
        # Verify autoInvoiceId is returned
        assert "autoInvoiceId" in sign_result, "Response should include autoInvoiceId"
        auto_invoice_id = sign_result["autoInvoiceId"]
        assert auto_invoice_id is not None, "autoInvoiceId should not be null"
        print(f"✓ Auto invoice created via public sign: {auto_invoice_id}")
        
        # Verify invoice exists
        invoices = auth_session.get(f"{BASE_URL}/api/invoices").json()
        auto_invoice = next((i for i in invoices if i["id"] == auto_invoice_id), None)
        assert auto_invoice is not None
        assert auto_invoice["type"] == "Invoice"
        assert auto_invoice["status"] == "Draft"
        assert auto_invoice["convertedFromQuoteId"] == quote_id
        
        print(f"✓ Auto invoice verified: type={auto_invoice['type']}, status={auto_invoice['status']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/invoices/{auto_invoice_id}")
        auth_session.delete(f"{BASE_URL}/api/invoices/{quote_id}")


class TestPublicContractSignAutoPayslip:
    """Test: POST /api/public/contracts/:id/sign → auto draft payslip"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return session
    
    def test_public_contract_sign_auto_payslip(self, auth_session):
        """Signing contract via public link should auto-create draft payslip"""
        timestamp = int(time.time())
        employee_id = f"{TEST_PREFIX}emp_pub_{timestamp}"
        
        # Create employee (auto-creates draft contract)
        employee_data = {
            "id": employee_id,
            "name": f"Test Public Sign {timestamp}",
            "email": f"pubsign{timestamp}@example.com",
            "phone": "0612345678",
            "role": "Ingénieur",
            "department": "R&D",
            "status": "Active",
            "contractType": "CDI",
            "joinDate": "2026-01-01",
            "salary": 550000
        }
        
        emp_resp = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert emp_resp.status_code == 201
        contract_id = emp_resp.json().get("autoContractId")
        print(f"Employee created with contract: {contract_id}")
        
        # Update contract to Sent status (required for public signing)
        contracts = auth_session.get(f"{BASE_URL}/api/employees/contracts").json()
        contract = next((c for c in contracts if c["id"] == contract_id), None)
        contract["status"] = "Sent"
        auth_session.put(f"{BASE_URL}/api/employees/contracts/{contract_id}", json=contract)
        
        # Sign via public endpoint
        sign_data = {
            "signerName": "Employee Test",
            "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
        
        sign_resp = requests.post(f"{BASE_URL}/api/public/contracts/{contract_id}/sign", json=sign_data)
        assert sign_resp.status_code == 200, f"Expected 200, got {sign_resp.status_code}: {sign_resp.text}"
        
        sign_result = sign_resp.json()
        print(f"Public contract sign result: {sign_result}")
        
        # Verify autoPayslipId is returned
        assert "autoPayslipId" in sign_result, "Response should include autoPayslipId"
        auto_payslip_id = sign_result["autoPayslipId"]
        assert auto_payslip_id is not None, "autoPayslipId should not be null"
        print(f"✓ Auto payslip created via public sign: {auto_payslip_id}")
        
        # Verify payslip exists
        payslips = auth_session.get(f"{BASE_URL}/api/employees/payslips").json()
        auto_payslip = next((p for p in payslips if p["id"] == auto_payslip_id), None)
        assert auto_payslip is not None
        assert auto_payslip["employeeId"] == employee_id
        assert auto_payslip["status"] == "Draft"
        
        print(f"✓ Auto payslip verified: employeeId={auto_payslip['employeeId']}, status={auto_payslip['status']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_session(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=DEMO_1_ADMIN)
        assert resp.status_code == 200
        return session
    
    def test_cleanup_test_data(self, auth_session):
        """Clean up any remaining test data"""
        # Clean up test employees
        employees = auth_session.get(f"{BASE_URL}/api/employees").json()
        for emp in employees:
            if emp["id"].startswith(TEST_PREFIX):
                auth_session.delete(f"{BASE_URL}/api/employees/{emp['id']}")
                print(f"Cleaned up employee: {emp['id']}")
        
        # Clean up test invoices (but NOT the certified one)
        invoices = auth_session.get(f"{BASE_URL}/api/invoices").json()
        for inv in invoices:
            if inv["id"].startswith(TEST_PREFIX) and inv["id"] != "INV-AUTOTEST-1777897181":
                try:
                    auth_session.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
                    print(f"Cleaned up invoice: {inv['id']}")
                except:
                    pass  # May fail if certified
        
        print("✓ Cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
