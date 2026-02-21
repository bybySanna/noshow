#!/usr/bin/env python3

import requests
import json

def test_admin_endpoints():
    base_url = "https://no-show-reduction.preview.emergentagent.com"
    
    # Login as admin
    login_res = requests.post(f'{base_url}/api/auth/login', json={
        'email': 'admin@noshow.com', 
        'password': 'admin123456'
    })
    
    if login_res.status_code != 200:
        print("❌ Admin login failed")
        return False
        
    admin_token = login_res.json().get('token')
    headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}
    
    # Test specific admin endpoints
    endpoints = [
        ('admin/plans', 'Admin Plans'),
        ('admin/users', 'Admin Users'), 
        ('admin/activity', 'Admin Activity'),
        ('admin/stats', 'Admin Stats'),
        ('clients/risk-scores', 'Risk Scores')  # Business endpoint
    ]
    
    print('Testing Admin Endpoints:\n')
    results = []
    
    for endpoint, name in endpoints:
        try:
            # Use business token for business-specific endpoints
            test_headers = headers
            if 'clients/' in endpoint:
                # Login as business for client-related endpoints
                biz_login = requests.post(f'{base_url}/api/auth/login', json={
                    'email': 'demo@bellanapoli.com',
                    'password': 'demo123456'
                })
                if biz_login.status_code == 200:
                    biz_token = biz_login.json().get('token')
                    test_headers = {'Authorization': f'Bearer {biz_token}', 'Content-Type': 'application/json'}
            
            res = requests.get(f'{base_url}/api/{endpoint}', headers=test_headers, timeout=10)
            
            if res.status_code == 200:
                data = res.json()
                if endpoint == 'admin/plans':
                    print(f'✅ {name}: Found {len(data)} plans')
                    for plan in data[:3]:  # Show first 3
                        print(f'   - {plan.get("name")} ({plan.get("price")}€)')
                elif endpoint == 'admin/users':
                    print(f'✅ {name}: Found {len(data)} users')
                elif endpoint == 'admin/activity':
                    print(f'✅ {name}: Found {len(data)} recent activities')  
                elif endpoint == 'admin/stats':
                    print(f'✅ {name}: Stats loaded successfully')
                elif endpoint == 'clients/risk-scores':
                    print(f'✅ {name}: Found {len(data)} risk-scored clients')
                else:
                    print(f'✅ {name}: OK')
                results.append({'endpoint': endpoint, 'status': 'PASS'})
            else:
                print(f'❌ {name}: Failed with status {res.status_code}')
                results.append({'endpoint': endpoint, 'status': 'FAIL', 'code': res.status_code})
                
        except Exception as e:
            print(f'❌ {name}: Error - {e}')
            results.append({'endpoint': endpoint, 'status': 'ERROR', 'error': str(e)})
    
    # Save results
    with open('/app/admin_endpoints_test.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    passed = len([r for r in results if r.get('status') == 'PASS'])
    total = len(results)
    print(f'\n📊 Admin Endpoints Test: {passed}/{total} passed')
    
    return passed == total

if __name__ == '__main__':
    success = test_admin_endpoints()
    exit(0 if success else 1)