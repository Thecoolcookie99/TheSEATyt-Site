
#!/usr/bin/env python3
import requests
import base64
import json
import hashlib
import os

# ─── YOUR CREDENTIALS ──────────────────────────────────────────────────────
KEY_ID = "00564b3b529b7ba0000000002"          # e.g., "004..."
APP_KEY = "K005uAWGMQHBX1EFxLVijC8aJzipuVo" # e.g., "K0..."

BUCKET_NAME = "theseat"
FILE_PATH = "image.png"  # change this

def b2_authorize():
    auth = base64.b64encode(f"{KEY_ID}:{APP_KEY}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}
    resp = requests.get("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", headers=headers)
    resp.raise_for_status()
    data = resp.json()
    # Extract the nested values
    api_url = data["apiInfo"]["storageApi"]["apiUrl"]
    download_url = data["apiInfo"]["storageApi"]["downloadUrl"]
    auth_token = data["authorizationToken"]
    account_id = data["accountId"]
    return api_url, download_url, auth_token, account_id

def main():
    print("🚀 Authorizing...")
    api_url, download_url, auth_token, account_id = b2_authorize()
    print("✅ Authorized")
    print(f"   API URL: {api_url}")
    print(f"   Download URL: {download_url}")

    # List buckets
    print("📋 Getting bucket list...")
    resp = requests.post(
        f"{api_url}/b2api/v3/b2_list_buckets",
        headers={"Authorization": auth_token, "Content-Type": "application/json"},
        json={"accountId": account_id}
    )
    resp.raise_for_status()
    buckets = resp.json()["buckets"]
    bucket = next((b for b in buckets if b["bucketName"] == BUCKET_NAME), None)
    if not bucket:
        print(f"❌ Bucket '{BUCKET_NAME}' not found. Available buckets:")
        for b in buckets:
            print(f"  - {b['bucketName']}")
        return
    bucket_id = bucket["bucketId"]
    print(f"✅ Found bucket '{BUCKET_NAME}' (ID: {bucket_id})")

    # Get upload URL
    resp = requests.post(
        f"{api_url}/b2api/v3/b2_get_upload_url",
        headers={"Authorization": auth_token, "Content-Type": "application/json"},
        json={"bucketId": bucket_id}
    )
    resp.raise_for_status()
    upload_data = resp.json()
    upload_url = upload_data["uploadUrl"]
    upload_auth = upload_data["authorizationToken"]
    print("✅ Got upload URL")

    # Upload file
    with open(FILE_PATH, "rb") as f:
        file_data = f.read()
    file_name = os.path.basename(FILE_PATH)
    sha1 = hashlib.sha1(file_data).hexdigest()
    headers = {
        "Authorization": upload_auth,
        "X-Bz-File-Name": file_name,
        "Content-Type": "application/octet-stream",
        "X-Bz-Content-Sha1": sha1,
        "Content-Length": str(len(file_data))
    }
    resp = requests.post(upload_url, headers=headers, data=file_data)
    if resp.status_code != 200:
        print(f"❌ Upload failed (status {resp.status_code}):")
        print(resp.text)
        resp.raise_for_status()
    result = resp.json()
    print("✅ Upload successful!")
    print(f"   File ID: {result['fileId']}")
    print(f"   Public URL: https://f000.backblazeb2.com/file/{BUCKET_NAME}/{file_name}")

if __name__ == "__main__":
    main()