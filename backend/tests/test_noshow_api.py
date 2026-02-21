"""
NoShowGone API Tests - Testing new endpoints for iteration 2
Testing: Calendar, Clients, Public Stats, Payments, Admin features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@noshow.com"
ADMIN_PASSWORD = "admin123456"
BUSINESS_EMAIL = "demo@bellanapoli.com"
BUSINESS_PASSWORD = "demo123456"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


class TestAuthEndpoints:
    """Authentication tests"""
    
    def test_admin_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"
        print("✓ Admin login successful")
    
    def test_business_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "business_owner"
        assert data["user"].get("business_id") is not None
        print("✓ Business owner login successful")
    
    def test_invalid_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")


class TestPublicStats:
    """Public stats endpoint for landing page"""
    
    def test_public_stats(self):
        response = requests.get(f"{BASE_URL}/api/public/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_appointments_managed" in data
        assert "money_saved_total" in data
        assert "businesses_count" in data
        assert "confirmation_rate" in data
        assert "no_show_reduction" in data
        assert isinstance(data["total_appointments_managed"], int)
        assert isinstance(data["confirmation_rate"], (int, float))
        print(f"✓ Public stats: {data['total_appointments_managed']} appts, {data['businesses_count']} businesses")


class TestCalendarEndpoint:
    """Calendar API tests"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_calendar_appointments(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/appointments/calendar", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        assert "by_date" in data
        assert "start_date" in data
        assert "end_date" in data
        assert isinstance(data["appointments"], list)
        assert isinstance(data["by_date"], dict)
        print(f"✓ Calendar: {len(data['appointments'])} appointments in range")
    
    def test_calendar_with_date_range(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(
            f"{BASE_URL}/api/appointments/calendar?start_date=2025-01-01&end_date=2025-12-31",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        print("✓ Calendar with date range works")


class TestClientsEndpoint:
    """Clients API tests"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_clients_list(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/clients", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            client = data[0]
            # Validate client structure
            assert "phone" in client
            assert "total_appointments" in client
            assert "reliability_score" in client
            assert "no_shows" in client
            assert isinstance(client["reliability_score"], (int, float))
            print(f"✓ Clients list: {len(data)} clients found")
            print(f"  First client: {client.get('name', 'N/A')} - Score: {client['reliability_score']}%")
        else:
            print("✓ Clients list endpoint works (0 clients)")
    
    def test_client_history(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        # First get clients to get a phone number
        clients_response = requests.get(f"{BASE_URL}/api/clients", headers=headers)
        clients = clients_response.json()
        
        if len(clients) > 0:
            phone = clients[0]["phone"]
            response = requests.get(f"{BASE_URL}/api/clients/{phone}/history", headers=headers)
            assert response.status_code == 200
            history = response.json()
            assert isinstance(history, list)
            print(f"✓ Client history: {len(history)} appointments for {phone}")
        else:
            pytest.skip("No clients to test history")


class TestPaymentsEndpoints:
    """Payment simulation endpoints"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_create_subscription(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.post(f"{BASE_URL}/api/payments/subscription", headers=headers, json={
            "plan": "pro"
        })
        assert response.status_code == 200
        data = response.json()
        assert "subscription_id" in data
        assert data.get("simulation_mode") == True
        assert data.get("plan") == "pro"
        print(f"✓ Subscription created (simulation): {data['subscription_id']}")
    
    def test_cancel_subscription(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.post(f"{BASE_URL}/api/payments/cancel-subscription", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("simulation_mode") == True
        print("✓ Subscription cancellation works (simulation)")
    
    def test_payment_stats(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/payments/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_deposits" in data
        assert "paid_deposits" in data
        assert "total_amount" in data
        assert data.get("simulation_mode") == True
        print(f"✓ Payment stats: {data['total_deposits']} deposits, {data['total_amount']}€ total")


class TestAdminSystemHealth:
    """Admin system health and broadcast"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_system_health(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/system-health", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "database" in data
        assert "api" in data
        assert "notifications" in data
        assert "payments" in data
        assert data["database"] == "healthy"
        assert data["api"] == "healthy"
        print(f"✓ System health: DB={data['database']}, API={data['api']}, Notifs={data['notifications']}")
    
    def test_admin_broadcast(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/broadcast", headers=headers, json={
            "message": "Test broadcast message",
            "subject": "Test Subject"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "sent_to" in data
        assert data.get("simulation_mode") == True
        print(f"✓ Admin broadcast: Sent to {data['sent_to']} businesses (simulation)")
    
    def test_admin_dashboard(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_businesses" in data
        assert "total_appointments" in data
        assert "mrr" in data
        assert "subscription_breakdown" in data
        print(f"✓ Admin dashboard: {data['total_businesses']} businesses, MRR={data['mrr']}€")


class TestNotificationStats:
    """Notification stats endpoint"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_notification_stats(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "sent" in data
        assert "success_rate" in data
        assert "by_channel" in data
        assert data.get("simulation_mode") == True
        print(f"✓ Notification stats: {data['sent']}/{data['total']} sent, {data['success_rate']}% success")


class TestBusinessStats:
    """Business stats endpoints"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_business_stats(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/business", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "confirmed" in data
        assert "no_show_rate" in data
        assert "today" in data
        assert "high_risk_clients" in data
        print(f"✓ Business stats: {data['total']} total, {data['no_show_rate']}% no-show rate")
    
    def test_weekly_stats(self, business_token):
        headers = {"Authorization": f"Bearer {business_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/business/weekly", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Weekly stats: {len(data)} weeks of data")


class TestClientConfirmationPage:
    """Test public confirmation page endpoints"""
    
    @pytest.fixture
    def business_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        return response.json()["token"]
    
    def test_invalid_confirmation_token(self):
        response = requests.get(f"{BASE_URL}/api/confirm/invalidtoken123")
        assert response.status_code == 404
        print("✓ Invalid confirmation token correctly rejected")
    
    def test_get_appointment_by_token(self, business_token):
        # First get an appointment with a confirmation token
        headers = {"Authorization": f"Bearer {business_token}"}
        appts_response = requests.get(f"{BASE_URL}/api/appointments?limit=1", headers=headers)
        appts = appts_response.json()
        
        if len(appts) > 0:
            conf_token = appts[0].get("confirmation_token")
            if conf_token:
                response = requests.get(f"{BASE_URL}/api/confirm/{conf_token}")
                if response.status_code == 200:
                    data = response.json()
                    assert "appointment" in data
                    assert "business" in data
                    print(f"✓ Confirmation page data: {data['appointment']['client_name']}")
                else:
                    print(f"⚠ Confirmation token check: status {response.status_code}")
            else:
                print("⚠ No confirmation token found on appointment")
        else:
            pytest.skip("No appointments to test")


class TestPlansEndpoint:
    """Plans endpoint tests"""
    
    def test_public_plans(self):
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # At least 4 plans
        
        plan_ids = [p["id"] for p in data]
        assert "free_trial" in plan_ids
        assert "solo" in plan_ids
        assert "pro" in plan_ids
        assert "business" in plan_ids
        print(f"✓ Plans endpoint: {len(data)} plans available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
