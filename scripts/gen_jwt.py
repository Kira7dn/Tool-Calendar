import jwt
import datetime

secret = "u2vtyhAz6TUnju6yQrDcKTAXRab4A4sRFi/w4hTzI1bqVZiZ6/AKRQSka4eCkWDJbIRCvNLynoDIkaTR14iueA=="
payload = {
    "uid": "1",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Admin",
    "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1),
    "iss": "ToolCalendar",
    "aud": "ToolCalendarUsers"
}
token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
