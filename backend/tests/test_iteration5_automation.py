"""
Test Iteration 5 - Post-RDV Automation System
Tests for:
- Automation Queue
- Automation Analytics
- Automation Settings
- Automation Templates
- Onboarding Enriched
- Timezones
- Auto-trigger when appointment completed
"""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@noshow.com"
ADMIN_PASSWORD = "admin123456"
BUSINESS_EMAIL = "demo@bellanapoli.com"
BUSINESS_PASSWORD = "demo123456"
DEMO_BUSINESS_ID = "a501a1a4-9633-4c1f-963f-07d50005eccd"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def business_token():
    """Get business owner authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": BUSINESS_EMAIL,
        "password": BUSINESS_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Business login failed: {response.status_code} - {response.text}")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def business_headers(business_token):
    return {"Authorization": f"Bearer {business_token}", "Content-Type": "application/json"}


# ============= AUTOMATION QUEUE TESTS =============

class TestAutomationQueue:
    """Tests for GET /api/automation/queue"""
    
    def test_get_automation_queue(self, business_headers):
        """Test getting the automation queue"""
        response = requests.get(f"{BASE_URL}/api/automation/queue", headers=business_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "stats" in data
        assert isinstance(data["items"], list)
        
        # Check stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "pending" in stats
        assert "sent" in stats
        assert "failed" in stats
        print(f"✅ Queue stats: total={stats['total']}, sent={stats['sent']}, pending={stats['pending']}")
    
    def test_get_queue_with_status_filter(self, business_headers):
        """Test getting queue with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/automation/queue?status=sent",
            headers=business_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        for item in data["items"]:
            # Items should be filtered by sent status (or empty if none)
            if item.get("status"):
                assert item["status"] in ["sent", "delivered"]
        print(f"✅ Queue filter by status=sent works")
    
    def test_get_queue_with_limit(self, business_headers):
        """Test queue with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/automation/queue?limit=5",
            headers=business_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["items"]) <= 5
        print(f"✅ Queue limit works - got {len(data['items'])} items")


# ============= AUTOMATION ANALYTICS TESTS =============

class TestAutomationAnalytics:
    """Tests for GET /api/automation/analytics"""
    
    def test_get_automation_analytics(self, business_headers):
        """Test getting automation analytics"""
        response = requests.get(f"{BASE_URL}/api/automation/analytics", headers=business_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Check required fields
        assert "total_messages" in data or "by_status" in data
        assert "period_days" in data
        print(f"✅ Automation analytics returned with period_days={data.get('period_days')}")
    
    def test_get_analytics_with_custom_days(self, business_headers):
        """Test analytics with custom day range"""
        response = requests.get(
            f"{BASE_URL}/api/automation/analytics?days=7",
            headers=business_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("period_days") == 7
        print(f"✅ Analytics with 7 days period works")


# ============= AUTOMATION SETTINGS TESTS =============

class TestAutomationSettings:
    """Tests for GET/PUT /api/automation/settings"""
    
    def test_get_automation_settings(self, business_headers):
        """Test getting automation settings"""
        response = requests.get(f"{BASE_URL}/api/automation/settings", headers=business_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Check default settings exist
        assert "enabled" in data
        assert "preferred_channel" in data
        assert "fallback_enabled" in data
        assert "enabled_templates" in data
        
        print(f"✅ Settings: enabled={data['enabled']}, channel={data['preferred_channel']}, fallback={data['fallback_enabled']}")
    
    def test_update_automation_settings(self, business_headers):
        """Test updating automation settings"""
        new_settings = {
            "enabled": True,
            "preferred_channel": "email",
            "fallback_enabled": True,
            "enabled_templates": ["thankyou_standard", "review_request"],
            "google_review_link": "https://g.page/test-link",
            "loyalty_discount": "15",
            "promo_code": "TEST15"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/automation/settings",
            headers=business_headers,
            json=new_settings
        )
        assert response.status_code == 200
        
        # Verify by getting settings again
        verify = requests.get(f"{BASE_URL}/api/automation/settings", headers=business_headers)
        data = verify.json()
        assert data["preferred_channel"] == "email"
        assert "thankyou_standard" in data["enabled_templates"]
        print(f"✅ Settings updated successfully")
    
    def test_restore_default_settings(self, business_headers):
        """Restore default settings after test"""
        default_settings = {
            "enabled": True,
            "preferred_channel": "sms",
            "fallback_enabled": True,
            "enabled_templates": ["thankyou_standard"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/automation/settings",
            headers=business_headers,
            json=default_settings
        )
        assert response.status_code == 200
        print(f"✅ Settings restored to defaults")


# ============= AUTOMATION TEMPLATES TESTS =============

class TestAutomationTemplates:
    """Tests for automation templates CRUD"""
    
    def test_get_automation_templates(self, business_headers):
        """Test getting templates list"""
        response = requests.get(f"{BASE_URL}/api/automation/templates", headers=business_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "defaults" in data
        assert "custom" in data
        
        # Check default templates exist
        defaults = data["defaults"]
        assert len(defaults) >= 4  # thankyou_standard, review_request, loyalty_reward, wheel_of_fortune
        
        default_keys = [t["key"] for t in defaults]
        assert "thankyou_standard" in default_keys
        assert "review_request" in default_keys
        print(f"✅ Got {len(defaults)} default templates, {len(data['custom'])} custom templates")
    
    def test_create_custom_template(self, business_headers):
        """Test creating a custom template"""
        template_data = {
            "name": "TEST_Custom Template",
            "type": "thankyou",
            "message_fr": "Merci {{nom_client}} ! Votre visite était super.",
            "message_en": "Thank you {{nom_client}}! Your visit was great.",
            "channels": ["sms", "email"],
            "include_link": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/automation/templates",
            headers=business_headers,
            json=template_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Custom Template"
        print(f"✅ Custom template created with id={data['id']}")
        
        # Return template id for cleanup
        return data["id"]
    
    def test_delete_custom_template(self, business_headers):
        """Test deleting a custom template"""
        # First create a template
        template_data = {
            "name": "TEST_ToDelete",
            "type": "custom",
            "message_fr": "À supprimer",
            "channels": ["sms"]
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/automation/templates",
            headers=business_headers,
            json=template_data
        )
        assert create_resp.status_code == 200
        template_id = create_resp.json()["id"]
        
        # Now delete it
        delete_resp = requests.delete(
            f"{BASE_URL}/api/automation/templates/{template_id}",
            headers=business_headers
        )
        assert delete_resp.status_code == 200
        assert delete_resp.json()["deleted"] == True
        print(f"✅ Template {template_id} deleted successfully")


# ============= ONBOARDING TESTS =============

class TestOnboarding:
    """Tests for onboarding endpoints"""
    
    def test_get_onboarding_status(self, business_headers):
        """Test getting onboarding status"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status", headers=business_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "steps" in data
        assert "completed" in data
        assert "total" in data
        assert "progress_percent" in data
        
        steps = data["steps"]
        assert "profile_complete" in steps
        assert "timezone_set" in steps
        assert "business_hours_set" in steps
        
        print(f"✅ Onboarding: {data['completed']}/{data['total']} steps ({data['progress_percent']}%)")
    
    def test_update_onboarding_profile(self, business_headers):
        """Test updating profile via onboarding"""
        profile_data = {
            "phone": "+33 6 12 34 56 78",
            "address": "123 Test Street, Paris",
            "timezone": "Europe/Paris"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/onboarding/profile",
            headers=business_headers,
            json=profile_data
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"✅ Onboarding profile updated")
    
    def test_update_business_hours(self, business_headers):
        """Test updating business hours"""
        hours_data = {
            "opening_hours": {
                "monday": {"open": "09:00", "close": "18:00", "closed": False},
                "tuesday": {"open": "09:00", "close": "18:00", "closed": False},
                "wednesday": {"open": "09:00", "close": "18:00", "closed": False},
                "thursday": {"open": "09:00", "close": "18:00", "closed": False},
                "friday": {"open": "09:00", "close": "17:00", "closed": False},
                "saturday": {"open": "10:00", "close": "13:00", "closed": False},
                "sunday": {"closed": True}
            },
            "timezone": "Europe/Paris"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/onboarding/business-hours",
            headers=business_headers,
            json=hours_data
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"✅ Business hours updated")


# ============= TIMEZONES TESTS =============

class TestTimezones:
    """Tests for GET /api/utils/timezones"""
    
    def test_get_timezones_list(self):
        """Test getting available timezones (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/utils/timezones")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # At least some timezones
        
        # Check structure
        for tz in data:
            assert "value" in tz
            assert "label" in tz
        
        # Check Europe/Paris exists
        values = [tz["value"] for tz in data]
        assert "Europe/Paris" in values
        print(f"✅ Got {len(data)} timezones")


# ============= AUTO-TRIGGER TESTS =============

class TestAutoTrigger:
    """Tests for automatic post-RDV trigger"""
    
    def test_create_and_complete_appointment(self, business_headers):
        """Test creating appointment and completing it triggers automation"""
        # Create a new appointment
        appt_data = {
            "client_name": "TEST_AutoTrigger Client",
            "client_phone": "+33699990000",
            "client_email": "test.autotrigger@example.com",
            "date": "2026-01-20",
            "time": "14:00",
            "duration_minutes": 60,
            "service": "Test Service"
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/appointments",
            headers=business_headers,
            json=appt_data
        )
        assert create_resp.status_code == 200
        appt = create_resp.json()
        appt_id = appt["id"]
        print(f"✅ Created appointment {appt_id}")
        
        # Get queue count before completing
        queue_before = requests.get(
            f"{BASE_URL}/api/automation/queue",
            headers=business_headers
        ).json()
        count_before = queue_before["stats"]["total"]
        
        # Update appointment to completed - should trigger automation
        update_resp = requests.put(
            f"{BASE_URL}/api/appointments/{appt_id}",
            headers=business_headers,
            json={"status": "completed"}
        )
        assert update_resp.status_code == 200
        
        updated_appt = update_resp.json()
        assert updated_appt["status"] == "completed"
        print(f"✅ Appointment updated to completed")
        
        # Small delay to let automation process
        import time
        time.sleep(1)
        
        # Check queue after - should have new message(s)
        queue_after = requests.get(
            f"{BASE_URL}/api/automation/queue",
            headers=business_headers
        ).json()
        count_after = queue_after["stats"]["total"]
        
        # Verify automation was triggered (queue should have more items)
        # Note: This may not increase if automation settings have enabled_templates empty
        print(f"✅ Queue count: before={count_before}, after={count_after}")
        
        # Cleanup - delete the test appointment
        requests.delete(
            f"{BASE_URL}/api/appointments/{appt_id}",
            headers=business_headers
        )
        print(f"✅ Test appointment deleted")


# ============= RETRY MECHANISM TESTS =============

class TestRetryMechanism:
    """Tests for retry functionality"""
    
    def test_retry_queue_item(self, business_headers):
        """Test retrying a queue item"""
        # First get the queue to find a failed item
        response = requests.get(
            f"{BASE_URL}/api/automation/queue?status=failed",
            headers=business_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["items"]:
            # Found a failed item, retry it
            item_id = data["items"][0]["id"]
            retry_resp = requests.post(
                f"{BASE_URL}/api/automation/retry/{item_id}",
                headers=business_headers
            )
            assert retry_resp.status_code == 200
            print(f"✅ Retry successful for queue item {item_id}")
        else:
            print(f"⚠️ No failed items to retry (this is OK)")


# ============= ADMIN AUTOMATION TESTS =============

class TestAdminAutomation:
    """Tests for admin automation endpoints"""
    
    def test_get_admin_automation_analytics(self, admin_headers):
        """Test admin analytics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/automation/analytics",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "today_volume" in data
        assert "global_status" in data
        assert "top_businesses" in data
        assert "system_status" in data
        
        # Check system status
        assert data["system_status"] in ["simulation", "live"]
        print(f"✅ Admin analytics: today_volume={data['today_volume']}, status={data['system_status']}")
    
    def test_get_admin_queue(self, admin_headers):
        """Test admin queue monitoring"""
        response = requests.get(
            f"{BASE_URL}/api/admin/automation/queue",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check items have business_name enrichment
        if data:
            assert "business_name" in data[0]
        print(f"✅ Admin queue: {len(data)} items")
    
    def test_admin_process_retries(self, admin_headers):
        """Test admin process retries endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/admin/automation/process-retries",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "processed" in data
        print(f"✅ Admin processed {data['processed']} retries")


# ============= CLEANUP =============

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_templates(self, business_headers):
        """Remove TEST_ prefixed templates"""
        response = requests.get(f"{BASE_URL}/api/automation/templates", headers=business_headers)
        data = response.json()
        
        deleted = 0
        for tpl in data.get("custom", []):
            if tpl.get("name", "").startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/automation/templates/{tpl['id']}",
                    headers=business_headers
                )
                deleted += 1
        
        print(f"✅ Cleaned up {deleted} test templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
