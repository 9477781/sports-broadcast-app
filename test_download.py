import urllib.request
import os

url = "https://raw.githubusercontent.com/9477781/sports-broadcast-app/main/public/data/status.json"
try:
    with urllib.request.urlopen(url) as response:
        content = response.read()
        print(f"Downloaded {len(content)} bytes")
        print("Start of content:", content[:100])
        # Try writing to a different location just in case
        target_path = os.path.join("public", "data", "status_py.json")
        with open(target_path, "wb") as f:
            f.write(content)
        print(f"Successfully wrote to {target_path}")
        print("Actual file size:", os.path.getsize(target_path))
except Exception as e:
    print(f"Error: {e}")
