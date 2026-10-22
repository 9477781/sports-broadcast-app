import urllib.request
url = 'https://raw.githubusercontent.com/9477781/sports-broadcast-app/main/public/data/status.json'
path = 'public/data/status.json'
try:
    urllib.request.urlretrieve(url, path)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
