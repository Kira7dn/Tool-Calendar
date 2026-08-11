import os, json, datetime, urllib.request, base64, hmac, hashlib
def get_jwt(secret_key, payload):
    header = {'alg': 'HS256', 'typ': 'JWT'}
    def b64url(data):
        return base64.urlsafe_b64encode(data).replace(b'=', b'').decode('utf-8')
    header_enc = b64url(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_enc = b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    sig = b64url(hmac.new(secret_key.encode('utf-8'), f'{header_enc}.{payload_enc}'.encode('utf-8'), hashlib.sha256).digest())
    return f'{header_enc}.{payload_enc}.{sig}'

secret = ''
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('JWT_SECRET='):
            secret = line.strip().split('=', 1)[1]
            break

payload = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '1',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'admin',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin',
    'exp': int(datetime.datetime.now().timestamp()) + 3600,
    'iss': 'ToolCalendar',
    'aud': 'ToolCalendarUsers'
}
token = get_jwt(secret, payload)
req = urllib.request.Request('http://localhost:59607/api/chat/message', data=json.dumps({'message': 'tóm tắt công văn số 4206/SNV-TCCB&BC', 'documentId': None}).encode('utf-8'))
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'application/json')
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
