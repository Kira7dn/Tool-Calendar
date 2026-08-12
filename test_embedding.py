import urllib.request, json
data = json.dumps({"model": "nomic-embed-text", "prompt": "a" * 5000}).encode()
req = urllib.request.Request("http://localhost:11434/api/embeddings", data=data, headers={'Content-Type': 'application/json'})
try:
    urllib.request.urlopen(req)
except Exception as e:
    print(e.read())
