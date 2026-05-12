#!/bin/bash
# Test: auth service returns JWT with organization_id for admin user
echo "=== Testing auth service ==="
curl -s -X POST "http://localhost:3002/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"admin123"}' | python3 -c "
import sys, json, base64
r = json.load(sys.stdin)
print('access_token present:', bool(r.get('access_token')))
print('user id:', r.get('user',{}).get('id',''))
print('user_metadata:', json.dumps(r.get('user',{}).get('user_metadata',{}), indent=2))

# Decode JWT payload
token = r.get('access_token','')
if token:
    parts = token.split('.')
    if len(parts) == 3:
        pad = parts[1] + '=='
        payload = json.loads(base64.urlsafe_b64decode(pad))
        print('JWT organization_id:', payload.get('organization_id','MISSING'))
        print('JWT sub:', payload.get('sub',''))
        print('JWT role:', payload.get('role',''))
"

echo ""
echo "=== Testing virtual_login via PostgREST ==="
curl -s -X POST "http://localhost:3001/rpc/virtual_login" \
  -H "Content-Type: application/json" \
  -d '{"p_name":"admin","p_password":"admin123"}' | python3 -c "
import sys, json
r = json.load(sys.stdin)
print('virtual_login result:', json.dumps(r, indent=2))
"
