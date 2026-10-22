import urllib.request
import os
import sys

url = 'https://raw.githubusercontent.com/9477781/sports-broadcast-app/main/public/data/status.json'
path = 'public/data/status_v3.json'

print(f"Downloading {url} to {path}...")
try:
    response = urllib.request.urlopen(url, timeout=30)
    data = response.read()
    print(f"Read {len(data)} bytes.")
    with open(path, 'wb') as f:
        f.write(data)
    print("Done.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
