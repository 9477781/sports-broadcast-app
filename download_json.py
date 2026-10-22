import urllib.request
import os

url = "https://raw.githubusercontent.com/9477781/sports-broadcast-app/main/public/data/status.json"
path = "public/data/status.json"

try:
    print(f"Downloading {url}...")
    with urllib.request.urlopen(url) as response:
        content = response.read()
        print(f"Downloaded {len(content)} bytes.")
        with open(path, "wb") as f:
            f.write(content)
    print("Done.")
except Exception as e:
    print(f"Error: {e}")
