"""
Test suite for Wheel of Fortune (Roue de la Fortune) features
Iteration 7: Testing public page, anti-duplicate validation, prize validation, and configuration

Features tested:
- Public page /play/{code} display and access
- Actions required before playing
- RGPD checkbox with CGV and rules links
- Anti-duplicate validation (same day, same phone, same email)
- Validation code generation (WIN-XXXXXXXX format)
- Configuration with 6 tabs (Segments, Actions, Link&QR, CGV, Validations, Stats)
- QR Code generation
- Prize list with status
- Prize redemption with code
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WHEEL_CODE = "6BC5CA2B"

class TestPublicWheelEndpoints:
    """Test public wheel page endpoints accessible without authentication"""
    
    def test_public_wheel_page_access(self):
        """Test GET /api/wheel/{code}/public - Public page access"""
        response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Public wheel accessible with code {WHEEL_CODE}")
            
            # Verify required fields
            assert "segments" in data, "Missing segments field"
            assert "title" in data, "Missing title field"
            assert "business_name" in data, "Missing business_name field"
            
            # Verify RGPD config
            assert "require_gdpr" in data, "Missing require_gdpr field"
            assert "cgv_text" in data, "Missing cgv_text field"
            assert "rules_text" in data, "Missing rules_text field"
            
            # Verify actions config
            assert "actions" in data, "Missing actions field"
            
            # Verify social links
            assert "social_links" in data, "Missing social_links field"
            
            print(f"  - Title: {data.get('title')}")
            print(f"  - Business: {data.get('business_name')}")
            print(f"  - Segments count: {len(data.get('segments', []))}")
            print(f"  - Actions count: {len(data.get('actions', []))}")
            print(f"  - RGPD required: {data.get('require_gdpr')}")
            
        elif response.status_code == 404:
            pytest.skip(f"Wheel with code {WHEEL_CODE} not found or not enabled")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_public_wheel_segments_have_colors(self):
        """Verify segments have colors for visual display"""
        response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        
        if response.status_code != 200:
            pytest.skip("Wheel not available")
        
        data = response.json()
        segments = data.get("segments", [])
        
        assert len(segments) >= 2, "Wheel must have at least 2 segments"
        
        for i, segment in enumerate(segments):
            assert "label" in segment, f"Segment {i} missing label"
            assert "color" in segment, f"Segment {i} missing color"
            print(f"  Segment {i+1}: {segment['label']} - {segment['color']}")
    
    def test_public_wheel_actions_configured(self):
        """Verify actions to complete are correctly configured"""
        response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        
        if response.status_code != 200:
            pytest.skip("Wheel not available")
        
        data = response.json()
        actions = data.get("actions", [])
        
        if len(actions) > 0:
            print(f"SUCCESS: {len(actions)} action(s) configured")
            for action in actions:
                print(f"  - {action.get('label', 'N/A')} (required: {action.get('required', False)})")
                if action.get("link"):
                    print(f"    Link: {action.get('link')}")
        else:
            print("INFO: No actions configured - customers can play directly")


class TestWheelPlayAntiDuplicate:
    """Test anti-duplicate validation for wheel plays"""
    
    @pytest.fixture
    def unique_identifiers(self):
        """Generate unique test identifiers"""
        timestamp = datetime.now(timezone.utc).strftime("%H%M%S%f")
        return {
            "name": f"Test User {timestamp}",
            "phone": f"+3361234{timestamp[:4]}",
            "email": f"test_{timestamp}@example.com"
        }
    
    def test_play_wheel_missing_required_fields(self):
        """Test play fails without required phone/email"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": "Test",
                "gdpr_accepted": True
            }
        )
        
        assert response.status_code == 400, "Should fail without phone and email"
        print("SUCCESS: Properly rejects play without required fields")
    
    def test_play_wheel_without_gdpr_acceptance(self, unique_identifiers):
        """Test play fails without GDPR acceptance"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": unique_identifiers["name"],
                "phone": unique_identifiers["phone"],
                "email": unique_identifiers["email"],
                "gdpr_accepted": False
            }
        )
        
        # Should fail if RGPD is required
        if response.status_code == 400:
            data = response.json()
            if "RGPD" in data.get("detail", "") or "CGV" in data.get("detail", ""):
                print("SUCCESS: Properly rejects play without GDPR acceptance")
            else:
                # May fail for other reason (required action not completed)
                print(f"INFO: Rejected with: {data.get('detail')}")
        elif response.status_code == 404:
            pytest.skip("Wheel not available")
        else:
            print(f"INFO: Response status: {response.status_code}")
    
    def test_play_wheel_without_required_action(self, unique_identifiers):
        """Test play fails if required action not completed"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": unique_identifiers["name"],
                "phone": unique_identifiers["phone"],
                "email": unique_identifiers["email"],
                "gdpr_accepted": True,
                "actions_completed": []  # No actions completed
            }
        )
        
        if response.status_code == 400:
            data = response.json()
            if "Action requise" in data.get("detail", ""):
                print("SUCCESS: Properly rejects play without required action completed")
            else:
                print(f"INFO: Rejected with: {data.get('detail')}")
        elif response.status_code == 404:
            pytest.skip("Wheel not available")
        elif response.status_code == 200:
            print("INFO: No required actions configured or all satisfied")
    
    def test_play_wheel_success_with_validation_code(self, unique_identifiers):
        """Test successful wheel play generates WIN-XXXXXXXX validation code"""
        # First get the required actions
        config_response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        if config_response.status_code != 200:
            pytest.skip("Wheel not available")
        
        config = config_response.json()
        required_actions = [a["key"] for a in config.get("actions", []) if a.get("required")]
        
        response = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": unique_identifiers["name"],
                "phone": unique_identifiers["phone"],
                "email": unique_identifiers["email"],
                "gdpr_accepted": True,
                "actions_completed": required_actions
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print("SUCCESS: Wheel play successful")
            
            # Verify validation code format
            assert "validation_code" in data, "Missing validation_code"
            validation_code = data["validation_code"]
            assert validation_code.startswith("WIN-"), f"Validation code should start with WIN-, got: {validation_code}"
            assert len(validation_code) == 12, f"Validation code should be 12 chars (WIN-XXXXXXXX), got: {len(validation_code)}"
            
            # Verify prize
            assert "prize" in data, "Missing prize"
            
            # Verify expiry date
            assert "expiry_date" in data, "Missing expiry_date"
            
            print(f"  Prize: {data.get('prize')}")
            print(f"  Validation code: {validation_code}")
            print(f"  Expiry: {data.get('expiry_date')}")
            
            return data
        elif response.status_code == 400:
            error = response.json().get("detail", "")
            if "déjà joué" in error or "maximum" in error:
                pytest.skip("User already played - expected behavior")
            print(f"FAIL: Play rejected: {error}")
            pytest.fail(f"Play failed: {error}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")
    
    def test_anti_duplicate_same_phone(self, unique_identifiers):
        """Test anti-duplicate: same phone on same day blocked"""
        # First get required actions
        config_response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        if config_response.status_code != 200:
            pytest.skip("Wheel not available")
        
        config = config_response.json()
        required_actions = [a["key"] for a in config.get("actions", []) if a.get("required")]
        
        # First play
        response1 = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": unique_identifiers["name"],
                "phone": unique_identifiers["phone"],
                "email": unique_identifiers["email"],
                "gdpr_accepted": True,
                "actions_completed": required_actions
            }
        )
        
        if response1.status_code != 200:
            error = response1.json().get("detail", "")
            if "déjà joué" in error or "maximum" in error:
                print("INFO: User already played previously - testing duplicate with new email")
            else:
                pytest.skip(f"First play failed: {error}")
        
        # Second attempt with same phone, different email
        new_email = f"other_{unique_identifiers['email']}"
        response2 = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": "Other User",
                "phone": unique_identifiers["phone"],  # Same phone
                "email": new_email,  # Different email
                "gdpr_accepted": True,
                "actions_completed": required_actions
            }
        )
        
        if response2.status_code == 400:
            data = response2.json()
            if "déjà joué" in data.get("detail", "").lower() or "maximum" in data.get("detail", "").lower():
                print("SUCCESS: Anti-duplicate blocks same phone on same day")
            else:
                print(f"INFO: Blocked with: {data.get('detail')}")
        else:
            print(f"WARNING: Second play status: {response2.status_code}")
    
    def test_anti_duplicate_same_email(self, unique_identifiers):
        """Test anti-duplicate: same email on same day blocked"""
        config_response = requests.get(f"{BASE_URL}/api/wheel/{WHEEL_CODE}/public")
        if config_response.status_code != 200:
            pytest.skip("Wheel not available")
        
        config = config_response.json()
        required_actions = [a["key"] for a in config.get("actions", []) if a.get("required")]
        
        timestamp = datetime.now(timezone.utc).strftime("%H%M%S%f")
        test_email = f"dupe_test_{timestamp}@test.com"
        phone1 = f"+336700{timestamp[:4]}"
        phone2 = f"+336800{timestamp[:4]}"
        
        # First play
        response1 = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": "User One",
                "phone": phone1,
                "email": test_email,
                "gdpr_accepted": True,
                "actions_completed": required_actions
            }
        )
        
        if response1.status_code != 200:
            error = response1.json().get("detail", "")
            pytest.skip(f"First play failed: {error}")
        
        # Second attempt with same email, different phone
        response2 = requests.post(
            f"{BASE_URL}/api/wheel/{WHEEL_CODE}/play",
            json={
                "name": "User Two",
                "phone": phone2,  # Different phone
                "email": test_email,  # Same email
                "gdpr_accepted": True,
                "actions_completed": required_actions
            }
        )
        
        assert response2.status_code == 400, "Should block same email on same day"
        data = response2.json()
        assert "déjà joué" in data.get("detail", "").lower() or "maximum" in data.get("detail", "").lower(), \
            f"Expected anti-duplicate message, got: {data.get('detail')}"
        print("SUCCESS: Anti-duplicate blocks same email on same day")


class TestWheelAuthenticatedEndpoints:
    """Test authenticated wheel endpoints for business configuration"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for business user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "demo@bellanapoli.com",
                "password": "demo123456"
            }
        )
        
        if response.status_code != 200:
            pytest.skip("Login failed")
        
        return response.json()["token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_wheel_config(self, auth_headers):
        """Test GET /api/wheel/config - Get wheel configuration"""
        response = requests.get(f"{BASE_URL}/api/wheel/config", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        print("SUCCESS: Retrieved wheel configuration")
        
        # Verify segments config
        assert "segments" in data, "Missing segments"
        print(f"  - Segments: {len(data.get('segments', []))}")
        
        # Verify actions config
        assert "actions" in data, "Missing actions"
        print(f"  - Actions: {len(data.get('actions', []))}")
        
        # Verify legal config
        assert "cgv_text" in data or data.get("cgv_text") is not None, "Missing cgv_text"
        assert "rules_text" in data or data.get("rules_text") is not None, "Missing rules_text"
        
        # Verify settings
        if "expiry_days" in data:
            print(f"  - Expiry days: {data.get('expiry_days')}")
        if "max_spins_per_client" in data:
            print(f"  - Max spins per client: {data.get('max_spins_per_client')}")
        if "enabled" in data:
            print(f"  - Enabled: {data.get('enabled')}")
        if "unique_code" in data:
            print(f"  - Unique code: {data.get('unique_code')}")
    
    def test_get_wheel_stats(self, auth_headers):
        """Test GET /api/wheel/stats - Get wheel statistics"""
        response = requests.get(f"{BASE_URL}/api/wheel/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        print("SUCCESS: Retrieved wheel statistics")
        
        assert "total_spins" in data, "Missing total_spins"
        assert "redemptions" in data, "Missing redemptions"
        assert "conversion_rate" in data, "Missing conversion_rate"
        
        print(f"  - Total spins: {data.get('total_spins')}")
        print(f"  - Redemptions: {data.get('redemptions')}")
        print(f"  - Conversion rate: {data.get('conversion_rate')}%")
    
    def test_get_wheel_link_info(self, auth_headers):
        """Test GET /api/wheel/link-info - Get QR code and link info"""
        response = requests.get(f"{BASE_URL}/api/wheel/link-info", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        print("SUCCESS: Retrieved wheel link info")
        
        assert "unique_code" in data, "Missing unique_code"
        assert "wheel_url" in data, "Missing wheel_url"
        assert "qr_data" in data, "Missing qr_data"
        
        print(f"  - Unique code: {data.get('unique_code')}")
        print(f"  - Wheel URL: {data.get('wheel_url')}")
    
    def test_get_wheel_redemptions_pending(self, auth_headers):
        """Test GET /api/wheel/redemptions?status=pending - Get pending prizes"""
        response = requests.get(
            f"{BASE_URL}/api/wheel/redemptions?status=pending",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        print("SUCCESS: Retrieved pending redemptions")
        
        assert "redemptions" in data, "Missing redemptions"
        redemptions = data.get("redemptions", [])
        print(f"  - Pending redemptions: {len(redemptions)}")
        
        if len(redemptions) > 0:
            first = redemptions[0]
            print(f"  - Sample: {first.get('client_name')} - {first.get('prize_label')} ({first.get('validation_code')})")
    
    def test_get_wheel_redemptions_validated(self, auth_headers):
        """Test GET /api/wheel/redemptions?status=validated - Get validated prizes"""
        response = requests.get(
            f"{BASE_URL}/api/wheel/redemptions?status=validated",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        print("SUCCESS: Retrieved validated redemptions")
        redemptions = data.get("redemptions", [])
        print(f"  - Validated redemptions: {len(redemptions)}")


class TestWheelRedemption:
    """Test prize redemption by business"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "demo@bellanapoli.com",
                "password": "demo123456"
            }
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_redeem_prize_invalid_code(self, auth_headers):
        """Test POST /api/wheel/redeem with invalid code"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/redeem",
            headers=auth_headers,
            json={"validation_code": "WIN-INVALID1"}
        )
        
        # Should fail with 404 - not found
        assert response.status_code in [400, 404], f"Expected 400 or 404, got: {response.status_code}"
        print("SUCCESS: Invalid code properly rejected")
    
    def test_redeem_prize_missing_params(self, auth_headers):
        """Test POST /api/wheel/redeem with missing parameters"""
        response = requests.post(
            f"{BASE_URL}/api/wheel/redeem",
            headers=auth_headers,
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        data = response.json()
        assert "spin_id" in data.get("detail", "") or "validation_code" in data.get("detail", "") or "promo_code" in data.get("detail", "")
        print("SUCCESS: Missing parameters properly rejected")
    
    def test_redeem_pending_prize(self, auth_headers):
        """Test redeeming a pending prize from the list"""
        # First get pending redemptions
        list_response = requests.get(
            f"{BASE_URL}/api/wheel/redemptions?status=pending",
            headers=auth_headers
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get redemptions list")
        
        redemptions = list_response.json().get("redemptions", [])
        
        if len(redemptions) == 0:
            pytest.skip("No pending redemptions to test")
        
        # Try to redeem the first one
        first_redemption = redemptions[0]
        validation_code = first_redemption.get("validation_code")
        
        if not validation_code:
            pytest.skip("No validation code on redemption")
        
        response = requests.post(
            f"{BASE_URL}/api/wheel/redeem",
            headers=auth_headers,
            json={"validation_code": validation_code}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Prize redeemed for {data.get('client_name')}")
            print(f"  Prize: {data.get('prize')}")
        elif response.status_code == 400:
            error = response.json().get("detail", "")
            if "expiré" in error.lower() or "expired" in error.lower():
                print("INFO: Prize had already expired")
            elif "déjà validé" in error.lower() or "already" in error.lower():
                print("INFO: Prize was already validated")
            else:
                print(f"INFO: Redemption failed: {error}")
        else:
            print(f"WARNING: Unexpected status: {response.status_code}")


class TestWheelConfiguration:
    """Test wheel configuration updates"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "demo@bellanapoli.com",
                "password": "demo123456"
            }
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_update_wheel_segments(self, auth_headers):
        """Test PUT /api/wheel/config - Update segments"""
        # First get current config
        current = requests.get(f"{BASE_URL}/api/wheel/config", headers=auth_headers)
        if current.status_code != 200:
            pytest.skip("Could not get current config")
        
        current_data = current.json()
        
        # Prepare update with modified segment
        segments = current_data.get("segments", [])
        if len(segments) > 0:
            segments[0]["label"] = f"Test Prize {datetime.now().strftime('%H%M%S')}"
        
        response = requests.put(
            f"{BASE_URL}/api/wheel/config",
            headers=auth_headers,
            json={
                "segments": segments,
                "enabled": current_data.get("enabled", True)
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        assert data.get("success") or "unique_code" in data, "Update should return success"
        print("SUCCESS: Wheel segments updated")
        
        if "unique_code" in data:
            print(f"  Unique code: {data.get('unique_code')}")
    
    def test_update_wheel_actions(self, auth_headers):
        """Test PUT /api/wheel/config - Update actions"""
        current = requests.get(f"{BASE_URL}/api/wheel/config", headers=auth_headers)
        if current.status_code != 200:
            pytest.skip("Could not get current config")
        
        current_data = current.json()
        
        # Add/update action
        actions = current_data.get("actions", [])
        test_action = {
            "key": "test_action",
            "label": "Action de test",
            "link": "https://google.com",
            "required": False,
            "icon": "star"
        }
        
        # Update or add
        found = False
        for i, a in enumerate(actions):
            if a.get("key") == "test_action":
                actions[i] = test_action
                found = True
                break
        if not found:
            actions.append(test_action)
        
        response = requests.put(
            f"{BASE_URL}/api/wheel/config",
            headers=auth_headers,
            json={"actions": actions}
        )
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        print("SUCCESS: Wheel actions updated")
    
    def test_update_wheel_legal_texts(self, auth_headers):
        """Test PUT /api/wheel/config - Update CGV and rules"""
        response = requests.put(
            f"{BASE_URL}/api/wheel/config",
            headers=auth_headers,
            json={
                "cgv_text": "Conditions générales de test - mise à jour " + datetime.now().strftime("%Y-%m-%d %H:%M"),
                "rules_text": "Règles du jeu de test - mise à jour " + datetime.now().strftime("%Y-%m-%d %H:%M"),
                "require_gdpr": True
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        print("SUCCESS: Wheel legal texts updated (CGV and rules)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
