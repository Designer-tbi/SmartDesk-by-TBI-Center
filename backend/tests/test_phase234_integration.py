"""
Phase 2, 3, 4 Integration Tests for SmartDesk ERP
- Phase 2: Cross-module UI links (CRM contact detail, HR employee detail)
- Phase 3: WebSocket RESOURCE_CHANGED broadcasts on mutations
- Phase 4: Extended /api/stats endpoint with dashboard widgets data
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://login-troubleshoot-18.preview.emergentagent.com').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        """Login and get auth cookies"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["companyId"] == "demo-1"
        # Cookies are automatically stored in session
        return session.cookies
    
    def test_login_success(self, session, auth_cookies):
        """Test login returns correct user data"""
        # Already tested in fixture, just verify cookies exist
        assert auth_cookies is not None
        print("✓ Login successful with admin@smartdesk.cg")


class TestPhase4Stats:
    """Phase 4: Extended /api/stats endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_stats_endpoint_returns_phase4_fields(self, auth_session):
        """GET /api/stats returns new Phase 4 fields"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Original fields
        assert "contacts" in data, "Missing contacts count"
        assert "revenue" in data, "Missing revenue"
        assert "orders" in data, "Missing orders count"
        assert "products" in data, "Missing products count"
        assert "monthlyData" in data, "Missing monthlyData"
        assert "categoryData" in data, "Missing categoryData"
        assert "activities" in data, "Missing activities"
        
        # Phase 4 new fields
        assert "outstanding" in data, "Missing outstanding invoices data"
        assert "topClients" in data, "Missing topClients array"
        assert "upcomingLeaves" in data, "Missing upcomingLeaves array"
        assert "expiringContracts" in data, "Missing expiringContracts array"
        assert "lowStock" in data, "Missing lowStock array"
        assert "pendingLeaves" in data, "Missing pendingLeaves count"
        
        print("✓ Stats endpoint returns all Phase 4 fields")
    
    def test_outstanding_invoices_structure(self, auth_session):
        """Verify outstanding invoices data structure"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        outstanding = data.get("outstanding", {})
        assert "count" in outstanding, "Missing outstanding.count"
        assert "total" in outstanding, "Missing outstanding.total"
        assert "overdueCount" in outstanding, "Missing outstanding.overdueCount"
        assert "overdueTotal" in outstanding, "Missing outstanding.overdueTotal"
        
        # Verify types
        assert isinstance(outstanding["count"], int), "outstanding.count should be int"
        assert isinstance(outstanding["total"], (int, float)), "outstanding.total should be numeric"
        assert isinstance(outstanding["overdueCount"], int), "outstanding.overdueCount should be int"
        assert isinstance(outstanding["overdueTotal"], (int, float)), "outstanding.overdueTotal should be numeric"
        
        print(f"✓ Outstanding invoices: {outstanding['count']} total, {outstanding['overdueCount']} overdue")
    
    def test_top_clients_structure(self, auth_session):
        """Verify topClients array structure"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        top_clients = data.get("topClients", [])
        assert isinstance(top_clients, list), "topClients should be array"
        assert len(top_clients) <= 5, "topClients should have max 5 entries"
        
        if len(top_clients) > 0:
            client = top_clients[0]
            assert "id" in client, "Missing client.id"
            assert "name" in client, "Missing client.name"
            assert "revenue" in client, "Missing client.revenue"
            assert "invoices" in client, "Missing client.invoices"
            print(f"✓ Top client: {client['name']} with {client['revenue']} revenue")
        else:
            print("✓ topClients array is empty (no paid invoices)")
    
    def test_upcoming_leaves_structure(self, auth_session):
        """Verify upcomingLeaves array structure"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        upcoming_leaves = data.get("upcomingLeaves", [])
        assert isinstance(upcoming_leaves, list), "upcomingLeaves should be array"
        
        if len(upcoming_leaves) > 0:
            leave = upcoming_leaves[0]
            assert "id" in leave, "Missing leave.id"
            assert "employeeId" in leave, "Missing leave.employeeId"
            assert "type" in leave, "Missing leave.type"
            assert "startDate" in leave, "Missing leave.startDate"
            assert "endDate" in leave, "Missing leave.endDate"
            print(f"✓ Upcoming leave: {leave.get('employeeName', leave['employeeId'])} - {leave['type']}")
        else:
            print("✓ upcomingLeaves array is empty (no approved leaves in 14 days)")
    
    def test_expiring_contracts_structure(self, auth_session):
        """Verify expiringContracts array structure"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        expiring = data.get("expiringContracts", [])
        assert isinstance(expiring, list), "expiringContracts should be array"
        
        if len(expiring) > 0:
            contract = expiring[0]
            assert "id" in contract, "Missing contract.id"
            assert "type" in contract, "Missing contract.type"
            assert "endDate" in contract, "Missing contract.endDate"
            assert "employeeId" in contract, "Missing contract.employeeId"
            print(f"✓ Expiring contract: {contract.get('employeeName', contract['employeeId'])} - ends {contract['endDate']}")
        else:
            print("✓ expiringContracts array is empty (no contracts expiring in 30 days)")
    
    def test_low_stock_structure(self, auth_session):
        """Verify lowStock array structure"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        low_stock = data.get("lowStock", [])
        assert isinstance(low_stock, list), "lowStock should be array"
        
        if len(low_stock) > 0:
            product = low_stock[0]
            assert "id" in product, "Missing product.id"
            assert "name" in product, "Missing product.name"
            assert "stock" in product, "Missing product.stock"
            print(f"✓ Low stock product: {product['name']} - stock: {product['stock']}")
        else:
            print("✓ lowStock array is empty (all products above threshold)")
    
    def test_pending_leaves_count(self, auth_session):
        """Verify pendingLeaves is an integer count"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        pending = data.get("pendingLeaves")
        assert isinstance(pending, int), "pendingLeaves should be integer"
        print(f"✓ Pending leave requests: {pending}")
    
    def test_monthly_data_has_12_entries(self, auth_session):
        """Verify monthlyData has 12 entries (was 6)"""
        response = auth_session.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        
        monthly_data = data.get("monthlyData", [])
        assert len(monthly_data) == 12, f"monthlyData should have 12 entries, got {len(monthly_data)}"
        
        # Verify structure
        if len(monthly_data) > 0:
            entry = monthly_data[0]
            assert "name" in entry, "Missing month name"
            assert "sales" in entry, "Missing sales"
            assert "expenses" in entry, "Missing expenses"
        
        print(f"✓ monthlyData has {len(monthly_data)} entries (12-month trend)")


class TestPhase3ResourceBroadcast:
    """Phase 3: WebSocket RESOURCE_CHANGED broadcast tests
    
    Note: We can't directly test WebSocket broadcasts from pytest,
    but we can verify the middleware is registered and mutations succeed.
    """
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_contact_post_triggers_broadcast(self, auth_session):
        """POST /api/contacts should succeed (broadcast fires on success)"""
        contact_id = f"TEST-LIVE-CONTACT-{int(time.time())}"
        contact_data = {
            "id": contact_id,
            "name": "TEST_LIVE_Contact_Phase3",
            "email": "test.phase3@example.com",
            "phone": "+242 06 123 4567",
            "company": "Test Company Phase3",
            "status": "Active"
        }
        response = auth_session.post(f"{BASE_URL}/api/contacts", json=contact_data)
        assert response.status_code == 201, f"Create contact failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ POST /api/contacts succeeded - broadcast should fire for 'contacts' resource")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
    
    def test_invoice_post_triggers_broadcast(self, auth_session):
        """POST /api/invoices should succeed (broadcast fires on success)"""
        # First get a contact
        contacts_res = auth_session.get(f"{BASE_URL}/api/contacts")
        contacts = contacts_res.json() if contacts_res.ok else []
        contact_id = contacts[0]["id"] if contacts else None
        
        if not contact_id:
            pytest.skip("No contacts available for invoice test")
        
        invoice_data = {
            "id": f"TEST-LIVE-{int(time.time())}",
            "type": "Invoice",
            "contactId": contact_id,
            "date": "2025-01-15",
            "dueDate": "2025-01-30",
            "items": [{"name": "Test Item", "quantity": 1, "price": 1000, "tvaRate": 0.18}],
            "status": "Draft",
            "totalHT": 1000,
            "tvaTotal": 180,
            "total": 1180
        }
        response = auth_session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code == 201, f"Create invoice failed: {response.text}"
        data = response.json()
        invoice_id = data.get("id")
        print(f"✓ POST /api/invoices succeeded - broadcast should fire for 'invoices' resource")
        
        # Cleanup
        if invoice_id:
            auth_session.delete(f"{BASE_URL}/api/invoices/{invoice_id}")
    
    def test_product_put_triggers_broadcast(self, auth_session):
        """PUT /api/products/:id should succeed (broadcast fires on success)"""
        # Get existing products
        products_res = auth_session.get(f"{BASE_URL}/api/products")
        products = products_res.json() if products_res.ok else []
        
        if not products:
            pytest.skip("No products available for update test")
        
        product = products[0]
        original_name = product["name"]
        
        # Update product
        product["name"] = f"{original_name} - Updated"
        response = auth_session.put(f"{BASE_URL}/api/products/{product['id']}", json=product)
        assert response.status_code == 200, f"Update product failed: {response.text}"
        print(f"✓ PUT /api/products succeeded - broadcast should fire for 'products' resource")
        
        # Restore original name
        product["name"] = original_name
        auth_session.put(f"{BASE_URL}/api/products/{product['id']}", json=product)
    
    def test_employee_post_triggers_broadcast(self, auth_session):
        """POST /api/employees should succeed (broadcast fires on success)"""
        employee_id = f"TEST-LIVE-EMP-{int(time.time())}"
        employee_data = {
            "id": employee_id,
            "name": "TEST_LIVE_Employee_Phase3",
            "email": f"test.phase3.{int(time.time())}@example.com",
            "phone": "+242 06 999 8888",
            "role": "Developer",
            "department": "IT",
            "salary": 500000,
            "joinDate": "2025-01-15",
            "contractType": "CDI",
            "status": "Active"
        }
        response = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert response.status_code == 201, f"Create employee failed: {response.text}"
        data = response.json()
        print(f"✓ POST /api/employees succeeded - broadcast should fire for 'employees' resource")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")
    
    def test_leave_request_post_triggers_broadcast(self, auth_session):
        """POST /api/employees/leaves should succeed (broadcast fires on success)"""
        # Get an employee
        employees_res = auth_session.get(f"{BASE_URL}/api/employees")
        employees = employees_res.json() if employees_res.ok else []
        
        if not employees:
            pytest.skip("No employees available for leave test")
        
        employee_id = employees[0]["id"]
        leave_id = f"TEST-LIVE-LEAVE-{int(time.time())}"
        leave_data = {
            "id": leave_id,
            "employeeId": employee_id,
            "type": "Congé annuel",
            "startDate": "2025-02-01",
            "endDate": "2025-02-05",
            "status": "Pending",
            "reason": "Test leave request Phase 3"
        }
        response = auth_session.post(f"{BASE_URL}/api/employees/leaves", json=leave_data)
        assert response.status_code == 201, f"Create leave failed: {response.text}"
        print(f"✓ POST /api/employees/leaves succeeded - broadcast should fire for 'leaves' resource")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/leaves/{leave_id}")
    
    def test_project_post_triggers_broadcast(self, auth_session):
        """POST /api/projects should succeed (broadcast fires on success)"""
        project_id = f"TEST-LIVE-PROJ-{int(time.time())}"
        project_data = {
            "id": project_id,
            "name": "TEST_LIVE_Project_Phase3",
            "status": "Planning",
            "budget": 1000000,
            "deadline": "2025-06-30"
        }
        response = auth_session.post(f"{BASE_URL}/api/projects", json=project_data)
        assert response.status_code == 201, f"Create project failed: {response.text}"
        print(f"✓ POST /api/projects succeeded - broadcast should fire for 'projects' resource")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_journal_entry_post_triggers_broadcast(self, auth_session):
        """POST /api/journal-entries should succeed (broadcast fires on success)"""
        entry_id = f"TEST-LIVE-JE-{int(time.time())}"
        entry_data = {
            "id": entry_id,
            "date": "2025-01-15",
            "description": "TEST_LIVE Journal Entry Phase 3",
            "entries": [
                {"accountCode": "521", "accountName": "Banque", "debit": 10000, "credit": 0},
                {"accountCode": "701", "accountName": "Ventes", "debit": 0, "credit": 10000}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/journal-entries", json=entry_data)
        assert response.status_code == 201, f"Create journal entry failed: {response.text}"
        print(f"✓ POST /api/journal-entries succeeded - broadcast should fire for 'journalEntries' resource")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/journal-entries/{entry_id}")


class TestPhase2CRMContactDetail:
    """Phase 2: CRM Contact Detail Modal tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200
        return s
    
    def test_contacts_endpoint_works(self, auth_session):
        """GET /api/contacts returns contacts list"""
        response = auth_session.get(f"{BASE_URL}/api/contacts")
        assert response.status_code == 200
        contacts = response.json()
        assert isinstance(contacts, list)
        print(f"✓ GET /api/contacts returns {len(contacts)} contacts")
    
    def test_invoices_endpoint_for_contact_filtering(self, auth_session):
        """GET /api/invoices returns invoices that can be filtered by contactId"""
        response = auth_session.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        
        # Check that invoices have contactId field
        if len(invoices) > 0:
            assert "contactId" in invoices[0], "Invoice should have contactId field"
            assert "type" in invoices[0], "Invoice should have type field (Quote/Invoice)"
        
        print(f"✓ GET /api/invoices returns {len(invoices)} invoices with contactId field")
    
    def test_projects_endpoint_for_contact_filtering(self, auth_session):
        """GET /api/projects returns projects that can be filtered by clientId"""
        response = auth_session.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        projects = response.json()
        assert isinstance(projects, list)
        
        # Check that projects have clientId field
        if len(projects) > 0:
            # clientId may be optional
            assert "status" in projects[0], "Project should have status field"
        
        print(f"✓ GET /api/projects returns {len(projects)} projects")


class TestPhase2HREmployeeDetail:
    """Phase 2: HR Employee Detail Modal tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200
        return s
    
    def test_employees_endpoint_works(self, auth_session):
        """GET /api/employees returns employees list"""
        response = auth_session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        
        if len(employees) > 0:
            emp = employees[0]
            # Verify employee has required fields for detail modal
            assert "id" in emp
            assert "name" in emp
            assert "email" in emp
        
        print(f"✓ GET /api/employees returns {len(employees)} employees")
    
    def test_contracts_endpoint_works(self, auth_session):
        """GET /api/employees/contracts returns contracts list"""
        response = auth_session.get(f"{BASE_URL}/api/employees/contracts")
        assert response.status_code == 200
        contracts = response.json()
        assert isinstance(contracts, list)
        
        if len(contracts) > 0:
            contract = contracts[0]
            assert "employeeId" in contract, "Contract should have employeeId"
            assert "type" in contract, "Contract should have type"
            assert "status" in contract, "Contract should have status"
        
        print(f"✓ GET /api/employees/contracts returns {len(contracts)} contracts")
    
    def test_payslips_endpoint_works(self, auth_session):
        """GET /api/employees/payslips returns payslips list"""
        response = auth_session.get(f"{BASE_URL}/api/employees/payslips")
        assert response.status_code == 200
        payslips = response.json()
        assert isinstance(payslips, list)
        
        if len(payslips) > 0:
            payslip = payslips[0]
            assert "employeeId" in payslip, "Payslip should have employeeId"
            assert "month" in payslip, "Payslip should have month"
            assert "year" in payslip, "Payslip should have year"
        
        print(f"✓ GET /api/employees/payslips returns {len(payslips)} payslips")
    
    def test_leaves_endpoint_works(self, auth_session):
        """GET /api/employees/leaves returns leave requests list"""
        response = auth_session.get(f"{BASE_URL}/api/employees/leaves")
        assert response.status_code == 200
        leaves = response.json()
        assert isinstance(leaves, list)
        
        if len(leaves) > 0:
            leave = leaves[0]
            assert "employeeId" in leave, "Leave should have employeeId"
            assert "type" in leave, "Leave should have type"
            assert "status" in leave, "Leave should have status"
        
        print(f"✓ GET /api/employees/leaves returns {len(leaves)} leave requests")
    
    def test_tasks_endpoint_works(self, auth_session):
        """GET /api/employees/tasks returns tasks list"""
        response = auth_session.get(f"{BASE_URL}/api/employees/tasks")
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        
        if len(tasks) > 0:
            task = tasks[0]
            assert "employeeId" in task, "Task should have employeeId"
            assert "title" in task, "Task should have title"
            assert "status" in task, "Task should have status"
        
        print(f"✓ GET /api/employees/tasks returns {len(tasks)} tasks")


class TestRegressionPhase1Automations:
    """Regression: Phase 1 automations still work"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartdesk.cg",
            "password": "admin"
        })
        assert response.status_code == 200
        return s
    
    def test_employee_creation_auto_contract(self, auth_session):
        """POST /api/employees should auto-create CDI contract"""
        employee_id = f"TEST-LIVE-AUTOCONTRACT-{int(time.time())}"
        employee_data = {
            "id": employee_id,
            "name": "TEST_LIVE_AutoContract",
            "email": f"test.autocontract.{int(time.time())}@example.com",
            "phone": "+242 06 111 2222",
            "role": "Tester",
            "department": "QA",
            "salary": 400000,
            "joinDate": "2025-01-15",
            "contractType": "CDI",
            "status": "Active"
        }
        response = auth_session.post(f"{BASE_URL}/api/employees", json=employee_data)
        assert response.status_code == 201, f"Create employee failed: {response.text}"
        data = response.json()
        
        # Check auto-contract was created
        assert "autoContractId" in data, "autoContractId should be returned"
        print(f"✓ Employee auto-contract created: {data.get('autoContractId')}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/employees/{employee_id}")
    
    def test_public_signature_endpoints_exist(self, auth_session):
        """Public signature endpoints should exist"""
        # These are public endpoints, no auth needed
        s = requests.Session()
        
        # Test with a fake ID - should return 404 not 500
        response = s.get(f"{BASE_URL}/api/public/quotes/fake-id")
        assert response.status_code in [404, 400], f"Public quote endpoint should return 404/400 for fake ID, got {response.status_code}"
        
        response = s.get(f"{BASE_URL}/api/public/contracts/fake-id")
        assert response.status_code in [404, 400], f"Public contract endpoint should return 404/400 for fake ID, got {response.status_code}"
        
        print("✓ Public signature endpoints exist and respond correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
