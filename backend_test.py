import requests
import sys
from datetime import datetime
import json

class NoShowGoneAPITester:
    def __init__(self, base_url="https://appointment-armor.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.business_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.results.append({"test": name, "status": "PASS", "details": f"Status {response.status_code}"})
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.results.append({"test": name, "status": "FAIL", "details": f"Expected {expected_status}, got {response.status_code}"})

            try:
                response_json = response.json()
                return success, response_json
            except:
                return success, {"raw_response": response.text}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.results.append({"test": name, "status": "ERROR", "details": str(e)})
            return False, {}

    def test_health_check(self):
        """Test API health"""
        return self.run_test("Health Check", "GET", "", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@noshow.com", "password": "admin123456"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_business_login(self):
        """Test business owner login"""
        success, response = self.run_test(
            "Business Owner Login",
            "POST",
            "auth/login",
            200,
            data={"email": "demo@bellanapoli.com", "password": "demo123456"}
        )
        if success and 'token' in response:
            self.business_token = response['token']
            return True
        return False

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        if not self.admin_token:
            print("❌ Skipping admin dashboard - no admin token")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "admin/dashboard",
            200,
            headers=headers
        )
        
        if success:
            required_fields = ['total_businesses', 'total_appointments', 'no_show_rate', 'mrr']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in admin stats: {field}")
                    return False
            print(f"   Admin stats: {response.get('total_businesses')} businesses, {response.get('mrr')}€ MRR")
        return success

    def test_admin_businesses_list(self):
        """Test admin businesses list"""
        if not self.admin_token:
            print("❌ Skipping admin businesses - no admin token")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Admin Businesses List",
            "GET",
            "admin/businesses",
            200,
            headers=headers
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} businesses")
        return success

    def test_business_stats(self):
        """Test business stats endpoint"""
        if not self.business_token:
            print("❌ Skipping business stats - no business token")
            return False
            
        headers = {'Authorization': f'Bearer {self.business_token}'}
        success, response = self.run_test(
            "Business Stats",
            "GET",
            "stats/business",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Business stats: {response.get('total')} total appointments, {response.get('no_show_rate')}% no-show rate")
        return success

    def test_get_appointments(self):
        """Test get appointments endpoint"""
        if not self.business_token:
            print("❌ Skipping appointments - no business token")
            return False
            
        headers = {'Authorization': f'Bearer {self.business_token}'}
        success, response = self.run_test(
            "Get Appointments",
            "GET",
            "appointments",
            200,
            headers=headers
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} appointments")
            return len(response) > 0
        return success

    def test_create_appointment(self):
        """Test create appointment"""
        if not self.business_token:
            print("❌ Skipping create appointment - no business token")
            return False
            
        headers = {'Authorization': f'Bearer {self.business_token}'}
        test_appt = {
            "client_name": "Test Client",
            "client_phone": "+33699999999",
            "client_email": "test@example.com",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "15:00",
            "duration_minutes": 60,
            "service": "Test Service"
        }
        
        success, response = self.run_test(
            "Create Appointment",
            "POST",
            "appointments",
            200,
            data=test_appt,
            headers=headers
        )
        
        if success and 'id' in response:
            print(f"   Created appointment ID: {response['id']}")
            return response['id']
        return None

    def test_get_business_info(self):
        """Test get business info"""
        if not self.business_token:
            print("❌ Skipping business info - no business token")
            return False
            
        headers = {'Authorization': f'Bearer {self.business_token}'}
        success, response = self.run_test(
            "Get Business Info",
            "GET",
            "businesses/me",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Business: {response.get('name')}")
        return success

    def test_confirmation_endpoint(self):
        """Test public confirmation endpoint with mock token"""
        # Using a mock token since we need a real confirmation token from the DB
        mock_token = "test123456789"
        success, response = self.run_test(
            "Confirmation Token (Mock)",
            "GET",
            f"confirm/{mock_token}",
            404  # Expecting 404 for invalid token
        )
        return success

def main():
    print("🚀 Starting NoShowGone API Tests...")
    print(f"Testing against: https://appointment-armor.preview.emergentagent.com")
    
    tester = NoShowGoneAPITester()
    
    # Basic health check
    if not tester.test_health_check()[0]:
        print("❌ API health check failed, stopping tests")
        return 1

    # Test authentication
    admin_login_success = tester.test_admin_login()
    business_login_success = tester.test_business_login()
    
    if not admin_login_success:
        print("❌ Admin login failed")
    
    if not business_login_success:
        print("❌ Business login failed")
        return 1

    # Test admin endpoints (if admin login worked)
    if admin_login_success:
        tester.test_admin_dashboard()
        tester.test_admin_businesses_list()

    # Test business endpoints (if business login worked)
    if business_login_success:
        tester.test_business_stats()
        tester.test_get_appointments()
        tester.test_get_business_info()
        appointment_id = tester.test_create_appointment()

    # Test public endpoints
    tester.test_confirmation_endpoint()

    # Print final results
    print(f"\n📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "summary": f"{tester.tests_passed}/{tester.tests_run} tests passed",
            "success_rate": round(tester.tests_passed / tester.tests_run * 100, 1) if tester.tests_run > 0 else 0,
            "results": tester.results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if tester.tests_passed >= tester.tests_run * 0.8 else 1

if __name__ == "__main__":
    sys.exit(main())