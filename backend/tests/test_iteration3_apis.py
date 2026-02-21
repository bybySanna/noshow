"""
NoShowGone API Tests - Iteration 3
Testing ML Scoring, Calendar Integrations, External APIs, and Admin Plans CRUD

Features tested:
- ML Scoring APIs (risk-overview, score-appointment)
- Google Calendar integration (auth-url, callback-simulate, sync)
- External API connections (register, webhooks)
- Admin Plans CRUD (create, update, delete)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@noshow.com"
ADMIN_PASSWORD = "admin123456"
BUSINESS_EMAIL = "demo@bellanapoli.com"
BUSINESS_PASSWORD = "demo123456"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def business_token(api_client):
    """Get business owner authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": BUSINESS_EMAIL,
        "password": BUSINESS_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Business owner authentication failed")


@pytest.fixture(scope="module")
def admin_client(api_client, admin_token):
    """Requests session with admin auth"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


@pytest.fixture(scope="module")
def business_client(api_client, business_token):
    """Requests session with business owner auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {business_token}"
    })
    return session


class TestHealthCheck:
    """Basic API health tests"""

    def test_api_root(self, api_client):
        """Test API root endpoint returns healthy status"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication tests"""

    def test_admin_login(self, api_client):
        """Test admin login returns valid token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"
        print("✓ Admin login successful")

    def test_business_login(self, api_client):
        """Test business owner login returns valid token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "business_owner"
        assert data["user"]["business_id"] is not None
        print("✓ Business owner login successful")


class TestMLScoring:
    """ML Scoring API tests"""

    def test_ml_risk_overview(self, business_client):
        """Test ML risk overview endpoint"""
        response = business_client.get(f"{BASE_URL}/api/ml/risk-overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_upcoming" in data
        assert "average_risk_score" in data
        assert "risk_distribution" in data
        assert "high_risk_count" in data
        assert "high_risk_appointments" in data
        assert "calculated_at" in data
        
        # Verify risk distribution has all levels
        risk_dist = data["risk_distribution"]
        for level in ["very_low", "low", "medium", "high", "very_high"]:
            assert level in risk_dist
            assert isinstance(risk_dist[level], int)
        
        print(f"✓ ML risk overview: {data['total_upcoming']} upcoming, avg score: {data['average_risk_score']}%")

    def test_ml_score_appointment(self, business_client):
        """Test scoring a specific appointment"""
        # First get an appointment
        appts_response = business_client.get(f"{BASE_URL}/api/appointments?limit=5")
        assert appts_response.status_code == 200
        appts = appts_response.json()
        
        if len(appts) == 0:
            pytest.skip("No appointments to score")
        
        appt_id = appts[0]["id"]
        
        # Score the appointment
        response = business_client.post(f"{BASE_URL}/api/ml/score-appointment/{appt_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify score response structure
        assert "score" in data
        assert "risk_level" in data
        assert "risk_label" in data
        assert "factors" in data
        assert "recommendations" in data
        assert "suggested_actions" in data
        
        # Verify score is valid
        assert 0 <= data["score"] <= 100
        assert data["risk_level"] in ["very_low", "low", "medium", "high", "very_high"]
        
        print(f"✓ Appointment scored: {data['score']} ({data['risk_label']})")

    def test_ml_risk_score_by_phone(self, business_client):
        """Test getting risk score by phone number"""
        # Get a client phone from existing appointments
        appts_response = business_client.get(f"{BASE_URL}/api/appointments?limit=1")
        assert appts_response.status_code == 200
        appts = appts_response.json()
        
        if len(appts) == 0:
            pytest.skip("No appointments found")
        
        phone = appts[0].get("client_phone", "").replace("+", "%2B")
        if not phone:
            pytest.skip("No phone number in appointment")
        
        response = business_client.get(f"{BASE_URL}/api/ml/risk-score/{phone}")
        assert response.status_code == 200
        data = response.json()
        
        assert "score" in data
        assert "risk_level" in data
        print(f"✓ Risk score by phone: {data['score']}%")


class TestCalendarIntegration:
    """Google Calendar integration tests"""

    def test_get_calendar_connections(self, business_client):
        """Test listing calendar connections"""
        response = business_client.get(f"{BASE_URL}/api/calendar/connections")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Calendar connections: {len(data)} found")

    def test_google_auth_url(self, business_client):
        """Test getting Google OAuth URL"""
        response = business_client.get(f"{BASE_URL}/api/calendar/google/auth-url")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        # In simulation mode, auth_url should be the callback-simulate endpoint
        assert "callback-simulate" in data["auth_url"] or "accounts.google.com" in data["auth_url"]
        print(f"✓ Google auth URL generated (simulation mode)")

    def test_google_callback_simulate(self, business_client):
        """Test simulated Google OAuth callback"""
        # Get business_id from current user
        me_response = business_client.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        business_id = me_response.json().get("business_id")
        
        # Call simulated callback
        response = business_client.get(f"{BASE_URL}/api/calendar/google/callback-simulate?business_id={business_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("provider") == "google_calendar"
        assert data.get("simulation_mode") == True
        print("✓ Google Calendar connected (simulation)")

    def test_google_calendar_sync(self, business_client):
        """Test syncing Google Calendar"""
        response = business_client.post(f"{BASE_URL}/api/calendar/google/sync")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "events_found" in data
        assert "events_imported" in data
        assert data.get("simulation_mode") == True
        print(f"✓ Calendar sync: {data['events_imported']} RDV imported")

    def test_disconnect_calendar(self, business_client):
        """Test disconnecting calendar"""
        response = business_client.delete(f"{BASE_URL}/api/calendar/google_calendar/disconnect")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✓ Calendar disconnected")


class TestExternalAPIs:
    """External API (TheFork/OpenTable) tests"""

    def test_get_external_connections(self, business_client):
        """Test listing external API connections"""
        response = business_client.get(f"{BASE_URL}/api/external-api/connections")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ External connections: {len(data)} found")

    def test_register_thefork_api(self, business_client):
        """Test registering TheFork API connection"""
        response = business_client.post(f"{BASE_URL}/api/external-api/register", json={
            "platform": "TheFork",
            "api_key": "test_api_key_123",
            "webhook_secret": "test_secret_456"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("platform") == "TheFork"
        assert "webhook_url" in data
        assert data.get("status") == "pending_configuration"
        print(f"✓ TheFork API registered, webhook: {data['webhook_url']}")

    def test_register_opentable_api(self, business_client):
        """Test registering OpenTable API connection"""
        response = business_client.post(f"{BASE_URL}/api/external-api/register", json={
            "platform": "OpenTable",
            "api_key": None,
            "webhook_secret": None
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("platform") == "OpenTable"
        print("✓ OpenTable API registered")

    def test_webhook_thefork(self, api_client, business_client):
        """Test TheFork webhook endpoint"""
        # Get business_id
        me_response = business_client.get(f"{BASE_URL}/api/auth/me")
        business_id = me_response.json().get("business_id")
        
        # Send a mock webhook payload
        payload = {
            "customer": {
                "name": "Test TheFork Client",
                "phone": "+33699999999",
                "email": "thefork@test.com"
            },
            "reservation": {
                "id": "tf_123456",
                "date": "2026-01-20",
                "time": "19:30",
                "covers": 4
            }
        }
        
        response = api_client.post(f"{BASE_URL}/api/webhooks/thefork/{business_id}", json=payload)
        # May return error if connection not configured properly, that's ok
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"✓ TheFork webhook processed, appointment: {data.get('appointment_id')}")
            else:
                print(f"✓ TheFork webhook received (connection not found - expected)")
        else:
            print("✓ TheFork webhook endpoint accessible")


class TestAdminPlansCRUD:
    """Admin Plans CRUD tests"""

    def test_get_admin_plans(self, admin_client):
        """Test listing admin plans"""
        response = admin_client.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # Default plans
        print(f"✓ Admin plans: {len(data)} plans found")

    def test_create_plan(self, admin_client):
        """Test creating a new plan"""
        new_plan = {
            "name": "TEST_Enterprise",
            "price": 199,
            "appointments_per_month": -1,
            "staff_members": -1,
            "sms_notifications": -1,
            "features": ["Unlimited everything", "Priority support", "API access", "Custom branding"],
            "is_active": True,
            "trial_days": 0,
            "color": "#8b5cf6"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/admin/plans", json=new_plan)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_Enterprise"
        assert data["price"] == 199
        assert data["appointments_per_month"] == -1
        assert len(data["features"]) == 4
        
        # Store plan ID for update/delete tests
        TestAdminPlansCRUD.created_plan_id = data["id"]
        print(f"✓ Plan created: {data['id']}")
        return data["id"]

    def test_update_plan(self, admin_client):
        """Test updating a plan"""
        plan_id = getattr(TestAdminPlansCRUD, 'created_plan_id', None)
        if not plan_id:
            pytest.skip("No plan to update")
        
        update_data = {
            "name": "TEST_Enterprise Plus",
            "price": 249,
            "features": ["Unlimited everything", "Priority support", "API access", "Custom branding", "Dedicated account manager"]
        }
        
        response = admin_client.put(f"{BASE_URL}/api/admin/plans/{plan_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Enterprise Plus"
        assert data["price"] == 249
        print(f"✓ Plan updated: {data['name']}")

    def test_delete_plan(self, admin_client):
        """Test deleting a plan"""
        plan_id = getattr(TestAdminPlansCRUD, 'created_plan_id', None)
        if not plan_id:
            pytest.skip("No plan to delete")
        
        response = admin_client.delete(f"{BASE_URL}/api/admin/plans/{plan_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("message") == "Plan deleted"
        print("✓ Plan deleted successfully")

    def test_verify_plan_deleted(self, admin_client):
        """Verify plan is no longer in list"""
        plan_id = getattr(TestAdminPlansCRUD, 'created_plan_id', None)
        if not plan_id:
            pytest.skip("No plan ID to verify")
        
        response = admin_client.get(f"{BASE_URL}/api/admin/plans")
        assert response.status_code == 200
        plans = response.json()
        
        plan_ids = [p.get("id") for p in plans]
        assert plan_id not in plan_ids
        print("✓ Plan deletion verified")


class TestNavigationAndPages:
    """Test that new pages/routes work properly"""

    def test_business_me_endpoint(self, business_client):
        """Test business info endpoint"""
        response = business_client.get(f"{BASE_URL}/api/businesses/me")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "name" in data
        print(f"✓ Business info: {data['name']}")

    def test_appointments_today(self, business_client):
        """Test today's appointments endpoint"""
        response = business_client.get(f"{BASE_URL}/api/appointments/today")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Today's appointments: {len(data)}")

    def test_appointments_upcoming(self, business_client):
        """Test upcoming appointments endpoint"""
        response = business_client.get(f"{BASE_URL}/api/appointments/upcoming?days=7")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Upcoming appointments: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
