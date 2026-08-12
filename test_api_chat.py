import urllib.request
import json
import jwt
import datetime
import sys

def main():
    secret = 'u2vtyhAz6TUnju6yQrDcKTAXRab4A4sRFi/w4hTzI1bqVZiZ6/AKRQSka4eCkWDJbIRCvNLynoDIkaTR14iueA=='
    
    payload = {
        'sub': '1',
        'unique_name': 'admin',
        'role': 'Admin',
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    
    token = jwt.encode(payload, secret.encode('ascii'), algorithm='HS256')
        
    chat_url = 'http://localhost:59607/api/chat/message'
    chat_data = json.dumps({'message': 'Tóm tắt hộ tôi công văn này với 4206/SNV-TCCB&BC'}).encode('utf-8')
    chat_req = urllib.request.Request(chat_url, data=chat_data, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    })
    
    print('--- AI RESPONSE START ---')
    try:
        with urllib.request.urlopen(chat_req) as response:
            for line in response:
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data_json = json.loads(line_str[6:])
                        print(data_json.get('text', ''), end='')
                        sys.stdout.flush()
            print()
    except Exception as e:
        print(f'Chat failed: {e}')
    print('--- AI RESPONSE END ---')

if __name__ == '__main__':
    main()
