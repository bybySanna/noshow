"""
NoShowGone - Credits & Wheel of Fortune API Tests
Tests for:
- Credits dashboard, check, purchase, checkout
- Wheel of Fortune configuration, stats, spin
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://appointment-app-demo.preview.emergentagent.com').rstrip('/')

# Test credentials
BUSINESS_EMAIL = "demo@bellanapoli.com"
BUSINESS_PASSWORD = "demo123456"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": BUSINESS_EMAIL,
        "password": BUSINESS_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("token")
    assert token, "No token received"
    return token


@pytest.fixture
def auth_headers(auth_token):
    """Auth headers for authenticated requests"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestCreditsAPIs:
    """Test Credits Dashboard and Management APIs"""
    
    def test_get_credits_dashboard(self, auth_headers):
        """Test GET /api/credits/dashboard"""
        response = requests.get(f"{BASE_URL}/api/credits/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Validate structure
        assert "credits" in data, "Missing 'credits' in response"
        assert "packs_available" in data, "Missing 'packs_available' in response"
        
        # Validate credits object contains sms, email, whatsapp
        credits = data["credits"]
        for credit_type in ["sms", "email", "whatsapp"]:
            assert credit_type in credits, f"Missing {credit_type} in credits"
            credit_data = credits[credit_type]
            # Validate credit fields
            assert "can_send" in credit_data
            assert "remaining" in credit_data or "unlimited" in credit_data
        
        print(f"✅ Credits dashboard response: {data['credits']}")
    
    def test_check_sms_credits(self, auth_headers):
        """Test GET /api/credits/check/sms"""
        response = requests.get(f"{BASE_URL}/api/credits/check/sms", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "can_send" in data, "Missing 'can_send' in response"
        print(f"✅ SMS credits check: {data}")
    
    def test_check_email_credits(self, auth_headers):
        """Test GET /api/credits/check/email"""
        response = requests.get(f"{BASE_URL}/api/credits/check/email", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "can_send" in data, "Missing 'can_send' in response"
        print(f"✅ Email credits check: {data}")
    
    def test_check_whatsapp_credits(self, auth_headers):
        """Test GET /api/credits/check/whatsapp"""
        response = requests.get(f"{BASE_URL}/api/credits/check/whatsapp", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "can_send" in data, "Missing 'can_send' in response"
        print(f"✅ WhatsApp credits check: {data}")
    
    def test_get_credit_packs(self, auth_headers):
        """Test GET /api/credits/packs"""
        response = requests.get(f"{BASE_URL}/api/credits/packs", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should contain pricing for sms, email, whatsapp
        for credit_type in ["sms", "email", "whatsapp"]:
            assert credit_type in data, f"Missing {credit_type} in packs"
            assert "packs" in data[credit_type], f"Missing packs for {credit_type}"
            assert "unit_price_cents" in data[credit_type], f"Missing unit_price_cents for {credit_type}"
        
        print(f"✅ Credit packs available: SMS={len(data['sms']['packs'])}, Email={len(data['email']['packs'])}, WhatsApp={len(data['whatsapp']['packs'])}")
    
    def test_credits_checkout_create(self, auth_headers):
        """Test POST /api/credits/checkout - Creates Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/credits/checkout",
            headers=auth_headers,
            json={
                "credit_type": "sms",
                "pack_key": "pack_50",
                "origin_url": "https://appointment-app-demo.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should return checkout_url or session_id
        assert "checkout_url" in data or "session_id" in data, f"Missing checkout data: {data}"
        print(f"✅ Checkout session created: {data}")
    
    def test_credits_history(self, auth_headers):
        """Test GET /api/credits/history"""
        response = requests.get(f"{BASE_URL}/api/credits/history", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should return usage_logs and purchases
        assert "usage_logs" in data, "Missing 'usage_logs' in response"
        assert "purchases" in data, "Missing 'purchases' in response"
        print(f"✅ Credits history: {len(data['usage_logs'])} logs, {len(data['purchases'])} purchases")
    
    def test_purchase_credits_simulation(self, auth_headers):
        """Test POST /api/credits/purchase - Simulation mode (no payment)"""
        response = requests.post(
            f"{BASE_URL}/api/credits/purchase",
            headers=auth_headers,
            json={
                "credit_type": "email",
                "pack_key": "pack_100"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Purchase failed: {data}"
        print(f"✅ Credits purchased (simulation): {data}")
    
    def test_pay_as_you_go_settings(self, auth_headers):
        """Test PUT /api/credits/pay-as-you-go"""
        # Enable pay-as-you-go
        response = requests.put(
            f"{BASE_URL}/api/credits/pay-as-you-go",
            headers=auth_headers,
            json={
                "credit_types": ["sms", "email"],
                "auto_reload_threshold": 10
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Pay-as-you-go update failed: {data}"
        print(f"✅ Pay-as-you-go settings updated: {data}")


class TestWheelOfFortuneAPIs:
    """Test Wheel of Fortune Configuration and Spin APIs"""
    
    def test_get_wheel_config(self, auth_headers):
        """Test GET /api/wheel/config"""
        response = requests.get(f"{BASE_URL}/api/wheel/config", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Validate structure
        assert "segments" in data, "Missing 'segments' in response"
        assert isinstance(data["segments"], list), "Segments should be a list"
        assert len(data["segments"]) >= 2, "Should have at least 2 segments"
        
        # Validate segment structure
        if data["segments"]:
            segment = data["segments"][0]
            assert "label" in segment, "Missing 'label' in segment"
            assert "probability" in segment, "Missing 'probability' in segment"
        
        print(f"✅ Wheel config: {len(data['segments'])} segments, enabled={data.get('enabled')}")
    
    def test_update_wheel_config(self, auth_headers):
        """Test PUT /api/wheel/config"""
        config = {
            "enabled": True,
            "title": "Test Wheel",
            "subtitle": "Test your luck!",
            "segments": [
                {"label": "-10%", "probability": 30, "color": "#10B981", "promo_code": "TEST10"},
                {"label": "-20%", "probability": 15, "color": "#3B82F6", "promo_code": "TEST20"},
                {"label": "Gift", "probability": 10, "color": "#F59E0B", "promo_code": "GIFT"},
                {"label": "-5%", "probability": 45, "color": "#8B5CF6", "promo_code": "TEST5"}
            ],
            "tasks_required": ["google_review"],
            "expiry_days": 30,
            "max_spins_per_client": 1
        }
        
        response = requests.put(
            f"{BASE_URL}/api/wheel/config",
            headers=auth_headers,
            json=config
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Config update failed: {data}"
        print(f"✅ Wheel config updated successfully")
    
    def test_get_wheel_stats(self, auth_headers):
        """Test GET /api/wheel/stats"""
        response = requests.get(f"{BASE_URL}/api/wheel/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Validate stats structure
        assert "total_spins" in data, "Missing 'total_spins' in response"
        assert "redemptions" in data, "Missing 'redemptions' in response"
        assert "conversion_rate" in data, "Missing 'conversion_rate' in response"
        
        print(f"✅ Wheel stats: {data['total_spins']} spins, {data['redemptions']} redemptions, {data['conversion_rate']}% conversion")
    
    def test_get_public_wheel(self, auth_headers):
        """Test GET /api/wheel/{business_id}/public"""
        # First get business info to get ID
        response = requests.get(f"{BASE_URL}/api/businesses/me", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get business: {response.text}"
        
        business_id = response.json().get("id")
        assert business_id, "No business ID found"
        
        # Get public wheel config
        response = requests.get(f"{BASE_URL}/api/wheel/{business_id}/public")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "segments" in data, "Missing 'segments' in public wheel"
        assert "business_name" in data, "Missing 'business_name' in public wheel"
        
        print(f"✅ Public wheel config for '{data.get('business_name')}': {len(data['segments'])} segments")
    
    def test_spin_wheel(self, auth_headers):
        """Test POST /api/wheel/{business_id}/spin"""
        # First get business info to get ID
        response = requests.get(f"{BASE_URL}/api/businesses/me", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get business: {response.text}"
        
        business_id = response.json().get("id")
        assert business_id, "No business ID found"
        
        # Spin the wheel
        test_phone = f"+33699999{int(time.time()) % 10000:04d}"
        response = requests.post(
            f"{BASE_URL}/api/wheel/{business_id}/spin",
            json={
                "client_phone": test_phone,
                "task_completed": "google_review"
            }
        )
        
        # Allow both success and "max spins reached" error
        if response.status_code == 200:
            data = response.json()
            assert "prize" in data or "label" in data, f"Missing prize info: {data}"
            print(f"✅ Wheel spin result: {data}")
        elif response.status_code == 400:
            # Max spins reached or already spun
            print(f"⚠️ Wheel spin limited (expected behavior): {response.json()}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")


class TestNavigationLinks:
    """Test that Credits and Wheel pages are accessible"""
    
    def test_credits_page_accessible(self, auth_headers):
        """Verify credits endpoints work for page loading"""
        # Credits dashboard
        response = requests.get(f"{BASE_URL}/api/credits/dashboard", headers=auth_headers)
        assert response.status_code == 200, "Credits dashboard API not accessible"
        
        # Credits history
        response = requests.get(f"{BASE_URL}/api/credits/history", headers=auth_headers)
        assert response.status_code == 200, "Credits history API not accessible"
        
        print("✅ Credits page APIs accessible")
    
    def test_wheel_page_accessible(self, auth_headers):
        """Verify wheel endpoints work for page loading"""
        # Wheel config
        response = requests.get(f"{BASE_URL}/api/wheel/config", headers=auth_headers)
        assert response.status_code == 200, "Wheel config API not accessible"
        
        # Wheel stats
        response = requests.get(f"{BASE_URL}/api/wheel/stats", headers=auth_headers)
        assert response.status_code == 200, "Wheel stats API not accessible"
        
        print("✅ Wheel page APIs accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
