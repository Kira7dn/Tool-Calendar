import jwt
import requests
import json
import time

secret = "u2vtyhAz6TUnju6yQrDcKTAXRab4A4sRFi/w4hTzI1bqVZiZ6/AKRQSka4eCkWDJbIRCvNLynoDIkaTR14iueA=="

payload = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "1",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "admin",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Admin",
    "exp": int(time.time()) + 3600
}

token = jwt.encode(payload, secret, algorithm="HS256")
print("Generated Token:", token)

url = "https://congvan.vpdtcampha.vn/api/chat/message"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

data = {
    "message": "hôm nay bạn khỏe không"
}

start_time = time.time()
print("\n[REQUEST] Sending chat message...")
with requests.post(url, headers=headers, json=data, stream=True) as r:
    print(f"[HTTP STATUS] {r.status_code}")
    for chunk in r.iter_content(chunk_size=None):
        if chunk:
            elapsed = time.time() - start_time
            print(f"[{elapsed:.2f}s] {chunk.decode('utf-8', errors='replace')}", end='', flush=True)
print("\n[DONE]")
