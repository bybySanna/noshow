"""
Iteration 4 API Tests - NoShowGone
Tests for new features:
- Client Ratings System
- Thank You Messages System  
- Internal Chat System (Admin <-> Business)
- Business Notifications
- Enhanced ML Scoring with Ratings
- Admin Insights
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

# Reusable test data
TEST_PHONE = "+33699999999"
TEST_APPOINTMENT_ID = None
TEST_TEMPLATE_ID = None
TEST_MESSAGE_ID = None
TEST_NOTIFICATION_ID = None

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_admin_login(self):
        """Test admin login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "super_admin"
        print(f"✅ Admin login successful")
    
    def test_business_login(self):
        """Test business owner login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_EMAIL,
            "password": BUSINESS_PASSWORD
        })
        assert response.status_code == 200, f"Business login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "business_owner"
        assert data["user"]["business_id"] is not None
        print(f"✅ Business login successful, business_id: {data['user']['business_id']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def business_token():
    """Get business token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": BUSINESS_EMAIL,
        "password": BUSINESS_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return {"token": data["token"], "business_id": data["user"]["business_id"]}
    pytest.skip("Business authentication failed")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def business_headers(business_token):
    return {"Authorization": f"Bearer {business_token['token']}", "Content-Type": "application/json"}


class TestClientRatings:
    """Client Ratings API Tests"""
    
    def test_get_unrated_appointments(self, business_headers):
        """GET /api/clients/unrated-appointments - List unrated completed appointments"""
        response = requests.get(f"{BASE_URL}/api/clients/unrated-appointments", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get unrated appointments: {len(data)} found")
    
    def test_rate_client_on_appointment(self, business_headers):
        """POST /api/appointments/{id}/rate-client - Rate a client"""
        # First get completed appointments
        response = requests.get(f"{BASE_URL}/api/appointments?status=completed", headers=business_headers)
        if response.status_code == 200 and len(response.json()) > 0:
            appt = response.json()[0]
            appt_id = appt["id"]
            
            # Rate the client
            rating_data = {
                "punctuality": 4,
                "politeness": 5,
                "reliability": 4,
                "overall": 4,
                "comment": "TEST_Rating - Excellent client"
            }
            rate_response = requests.post(
                f"{BASE_URL}/api/appointments/{appt_id}/rate-client",
                headers=business_headers,
                json=rating_data
            )
            assert rate_response.status_code == 200, f"Rating failed: {rate_response.text}"
            data = rate_response.json()
            assert data["punctuality"] == 4
            assert data["overall"] == 4
            print(f"✅ Rated client for appointment {appt_id}")
        else:
            # Create a completed appointment first
            create_response = requests.post(f"{BASE_URL}/api/appointments", headers=business_headers, json={
                "client_name": "TEST_Rating Client",
                "client_phone": TEST_PHONE,
                "client_email": "testrating@test.com",
                "date": "2025-01-01",
                "time": "14:00",
                "service": "Test Service"
            })
            if create_response.status_code == 200:
                appt_id = create_response.json()["id"]
                # Mark as completed
                requests.put(f"{BASE_URL}/api/appointments/{appt_id}", headers=business_headers, json={"status": "completed"})
                # Rate it
                rate_response = requests.post(
                    f"{BASE_URL}/api/appointments/{appt_id}/rate-client",
                    headers=business_headers,
                    json={"punctuality": 5, "politeness": 5, "reliability": 5, "overall": 5}
                )
                assert rate_response.status_code == 200
                print(f"✅ Created and rated test appointment")
            else:
                pytest.skip("Could not create test appointment")
    
    def test_get_client_ratings_history(self, business_headers):
        """GET /api/clients/{phone}/ratings - Get ratings history for a client"""
        # Use a known phone from demo data
        test_phone = "+33611111111"  # Marie Dupont from seed data
        response = requests.get(f"{BASE_URL}/api/clients/{test_phone}/ratings", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "ratings" in data
        assert "averages" in data
        assert "total_ratings" in data
        print(f"✅ Get client ratings: {data['total_ratings']} ratings, avg overall: {data['averages']['overall']}")


class TestEnhancedMLScoring:
    """Enhanced ML Scoring with Ratings API Tests"""
    
    def test_enhanced_risk_score(self, business_headers):
        """GET /api/ml/enhanced-risk-score/{phone} - ML score with client ratings"""
        test_phone = "+33611111111"
        response = requests.get(f"{BASE_URL}/api/ml/enhanced-risk-score/{test_phone}", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "risk_score" in data
        assert "risk_level" in data
        assert "factors" in data
        assert "stats" in data
        assert "ratings_summary" in data
        assert "recommendations" in data
        print(f"✅ Enhanced ML score for {test_phone}: {data['risk_score']} ({data['risk_level']})")
    
    def test_enhanced_risk_score_unknown_client(self, business_headers):
        """Test risk score for unknown client"""
        unknown_phone = "+33699990000"
        response = requests.get(f"{BASE_URL}/api/ml/enhanced-risk-score/{unknown_phone}", headers=business_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "unknown" or data["has_history"] == False
        print(f"✅ Enhanced ML score for unknown client: handled correctly")


class TestThankYouMessages:
    """Thank You Messages API Tests"""
    
    def test_get_thankyou_templates(self, business_headers):
        """GET /api/thankyou/templates - List thank you templates"""
        global TEST_TEMPLATE_ID
        response = requests.get(f"{BASE_URL}/api/thankyou/templates", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least default templates
        # Check template structure
        if len(data) > 0:
            template = data[0]
            assert "id" in template
            assert "name" in template
            assert "message" in template
            TEST_TEMPLATE_ID = template["id"]
        print(f"✅ Get thank you templates: {len(data)} found")
    
    def test_create_thankyou_template(self, business_headers):
        """POST /api/thankyou/templates - Create new template"""
        template_data = {
            "name": "TEST_Custom Thank You",
            "message": "Merci {{client_name}} ! Test message from automated tests.",
            "include_link": True,
            "link_text": "Book Again",
            "link_url": "https://test.example.com/book"
        }
        response = requests.post(f"{BASE_URL}/api/thankyou/templates", headers=business_headers, json=template_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["include_link"] == True
        print(f"✅ Created thank you template: {data['id']}")
        return data["id"]
    
    def test_update_thankyou_template(self, business_headers):
        """PUT /api/thankyou/templates/{id} - Update template"""
        # First create a template to update
        create_response = requests.post(f"{BASE_URL}/api/thankyou/templates", headers=business_headers, json={
            "name": "TEST_Update Template",
            "message": "Original message"
        })
        if create_response.status_code == 200:
            template_id = create_response.json()["id"]
            update_response = requests.put(
                f"{BASE_URL}/api/thankyou/templates/{template_id}",
                headers=business_headers,
                json={"name": "TEST_Updated Template", "message": "Updated message"}
            )
            assert update_response.status_code == 200
            data = update_response.json()
            assert data["name"] == "TEST_Updated Template"
            print(f"✅ Updated thank you template: {template_id}")
    
    def test_delete_thankyou_template(self, business_headers):
        """DELETE /api/thankyou/templates/{id} - Delete template"""
        # Create a template to delete
        create_response = requests.post(f"{BASE_URL}/api/thankyou/templates", headers=business_headers, json={
            "name": "TEST_Delete Template",
            "message": "To be deleted"
        })
        if create_response.status_code == 200:
            template_id = create_response.json()["id"]
            delete_response = requests.delete(
                f"{BASE_URL}/api/thankyou/templates/{template_id}",
                headers=business_headers
            )
            assert delete_response.status_code == 200
            data = delete_response.json()
            assert data["deleted"] == True
            print(f"✅ Deleted thank you template: {template_id}")
    
    def test_bulk_send_thankyou(self, business_headers):
        """POST /api/thankyou/bulk-send - Bulk send thank you messages"""
        # Get a template
        templates_response = requests.get(f"{BASE_URL}/api/thankyou/templates", headers=business_headers)
        if templates_response.status_code == 200 and len(templates_response.json()) > 0:
            template_id = templates_response.json()[0]["id"]
            
            # Get completed appointments without thankyou
            appts_response = requests.get(f"{BASE_URL}/api/appointments?status=completed", headers=business_headers)
            appt_ids = [a["id"] for a in appts_response.json() if not a.get("thankyou_sent")][:3]
            
            if appt_ids:
                bulk_response = requests.post(f"{BASE_URL}/api/thankyou/bulk-send", headers=business_headers, json={
                    "template_id": template_id,
                    "appointment_ids": appt_ids
                })
                assert bulk_response.status_code == 200
                data = bulk_response.json()
                assert "sent" in data
                assert data.get("simulation_mode") == True
                print(f"✅ Bulk sent thank you: {data['sent']} messages (simulation)")
            else:
                print(f"⚠️ No eligible appointments for bulk send")
        else:
            pytest.skip("No templates available")
    
    def test_get_thankyou_history(self, business_headers):
        """GET /api/thankyou/history - Get sent messages history"""
        response = requests.get(f"{BASE_URL}/api/thankyou/history", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Thank you history: {len(data)} messages")


class TestInternalChatAdmin:
    """Internal Chat System - Admin Side Tests"""
    
    def test_get_admin_conversations(self, admin_headers):
        """GET /api/admin/conversations - List all admin conversations"""
        response = requests.get(f"{BASE_URL}/api/admin/conversations", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin conversations: {len(data)} found")
    
    def test_send_message_to_business(self, admin_headers, business_token):
        """POST /api/admin/conversations/{business_id} - Send message to business"""
        global TEST_MESSAGE_ID
        business_id = business_token["business_id"]
        message_data = {"message": "TEST_Admin message - Hello from support!"}
        
        response = requests.post(
            f"{BASE_URL}/api/admin/conversations/{business_id}",
            headers=admin_headers,
            json=message_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["sender_role"] == "admin"
        assert data["message"] == message_data["message"]
        TEST_MESSAGE_ID = data["id"]
        print(f"✅ Admin sent message to business: {data['id']}")
    
    def test_get_conversation_with_business(self, admin_headers, business_token):
        """GET /api/admin/conversations/{business_id} - Get conversation"""
        business_id = business_token["business_id"]
        response = requests.get(
            f"{BASE_URL}/api/admin/conversations/{business_id}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "messages" in data
        assert "business_name" in data
        print(f"✅ Get admin conversation: {len(data['messages'])} messages with {data['business_name']}")
    
    def test_send_group_message(self, admin_headers, business_token):
        """POST /api/admin/conversations/group - Send message to multiple businesses"""
        business_id = business_token["business_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/conversations/group",
            headers=admin_headers,
            json={
                "business_ids": [business_id],
                "message": "TEST_Group message - Important announcement!"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["sent"] >= 1
        print(f"✅ Admin sent group message to {data['sent']} businesses")
    
    def test_delete_admin_message(self, admin_headers, business_token):
        """DELETE /api/admin/conversations/{business_id}/messages/{message_id} - Delete message"""
        business_id = business_token["business_id"]
        
        # Send a message to delete
        send_response = requests.post(
            f"{BASE_URL}/api/admin/conversations/{business_id}",
            headers=admin_headers,
            json={"message": "TEST_To be deleted"}
        )
        if send_response.status_code == 200:
            msg_id = send_response.json()["id"]
            delete_response = requests.delete(
                f"{BASE_URL}/api/admin/conversations/{business_id}/messages/{msg_id}",
                headers=admin_headers
            )
            assert delete_response.status_code == 200
            data = delete_response.json()
            assert data["deleted"] == True
            print(f"✅ Deleted admin message: {msg_id}")


class TestInternalChatBusiness:
    """Internal Chat System - Business Side Tests"""
    
    def test_get_business_messages(self, business_headers):
        """GET /api/business/messages - Get messages for business"""
        response = requests.get(f"{BASE_URL}/api/business/messages", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Business messages: {len(data)} found")
    
    def test_send_business_message(self, business_headers):
        """POST /api/business/messages - Reply to support"""
        response = requests.post(
            f"{BASE_URL}/api/business/messages",
            headers=business_headers,
            json={"message": "TEST_Business reply - Thank you for your help!"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["sender_role"] == "business"
        print(f"✅ Business sent message to support: {data['id']}")
    
    def test_get_unread_message_count(self, business_headers):
        """GET /api/business/messages/unread-count - Get unread count"""
        response = requests.get(f"{BASE_URL}/api/business/messages/unread-count", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "count" in data
        print(f"✅ Business unread messages: {data['count']}")


class TestBusinessNotifications:
    """Business Notifications API Tests"""
    
    def test_get_business_notifications(self, business_headers):
        """GET /api/business/notifications - Get notifications"""
        global TEST_NOTIFICATION_ID
        response = requests.get(f"{BASE_URL}/api/business/notifications", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            TEST_NOTIFICATION_ID = data[0]["id"]
        print(f"✅ Business notifications: {len(data)} found")
    
    def test_mark_notification_read(self, business_headers):
        """PUT /api/business/notifications/{id}/read - Mark as read"""
        # First get a notification
        notifs_response = requests.get(f"{BASE_URL}/api/business/notifications", headers=business_headers)
        if notifs_response.status_code == 200 and len(notifs_response.json()) > 0:
            notif_id = notifs_response.json()[0]["id"]
            response = requests.put(
                f"{BASE_URL}/api/business/notifications/{notif_id}/read",
                headers=business_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            print(f"✅ Marked notification as read: {notif_id}")
        else:
            print(f"⚠️ No notifications to mark as read")
    
    def test_delete_notification(self, business_headers):
        """DELETE /api/business/notifications/{id} - Delete notification"""
        # Get notifications
        notifs_response = requests.get(f"{BASE_URL}/api/business/notifications", headers=business_headers)
        if notifs_response.status_code == 200 and len(notifs_response.json()) > 0:
            notif_id = notifs_response.json()[0]["id"]
            response = requests.delete(
                f"{BASE_URL}/api/business/notifications/{notif_id}",
                headers=business_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["deleted"] == True
            print(f"✅ Deleted notification: {notif_id}")
        else:
            print(f"⚠️ No notifications to delete")
    
    def test_mark_all_notifications_read(self, business_headers):
        """PUT /api/business/notifications/read-all - Mark all as read"""
        response = requests.put(f"{BASE_URL}/api/business/notifications/read-all", headers=business_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"✅ Marked all notifications as read")


class TestAdminInsights:
    """Admin Insights API Tests"""
    
    def test_get_admin_insights(self, admin_headers):
        """GET /api/admin/insights - Get pertinent admin insights"""
        response = requests.get(f"{BASE_URL}/api/admin/insights", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "at_risk_businesses" in data
        assert "top_performers" in data
        assert "expiring_trials" in data
        assert "unread_support_messages" in data
        assert "today_appointments_all" in data
        assert "generated_at" in data
        
        print(f"✅ Admin insights retrieved:")
        print(f"   - At risk businesses: {len(data['at_risk_businesses'])}")
        print(f"   - Top performers: {len(data['top_performers'])}")
        print(f"   - Expiring trials: {len(data['expiring_trials'])}")
        print(f"   - Unread messages: {data['unread_support_messages']}")
        print(f"   - Today appointments: {data['today_appointments_all']}")
    
    def test_search_businesses(self, admin_headers):
        """GET /api/admin/business-search - Search businesses by name"""
        response = requests.get(f"{BASE_URL}/api/admin/business-search?q=bella", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0]
            assert "id" in data[0]
        print(f"✅ Business search 'bella': {len(data)} results")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_templates(self, business_headers):
        """Remove TEST_ prefixed templates"""
        templates_response = requests.get(f"{BASE_URL}/api/thankyou/templates", headers=business_headers)
        if templates_response.status_code == 200:
            for template in templates_response.json():
                if template.get("name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/thankyou/templates/{template['id']}",
                        headers=business_headers
                    )
        print(f"✅ Cleaned up test templates")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
