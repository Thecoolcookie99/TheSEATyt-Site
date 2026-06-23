async function sha1(buffer) {
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeJSON(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file) {
      return safeJSON({ error: "No file provided" }, 400);
    }

    const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);

    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        headers: { Authorization: `Basic ${auth}` }
      }
    );

    const authData = await authResp.json();

    if (!authResp.ok) {
      return safeJSON({ error: "Auth failed", authData }, 500);
    }

    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const authToken = authData.authorizationToken;

    const bucketResp = await fetch(
      `${apiUrl}/b2api/v3/b2_list_buckets`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accountId: authData.accountId })
      }
    );

    const bucketData = await bucketResp.json();

    const bucket = bucketData.buckets.find(
      b => b.bucketName === env.B2_BUCKET
    );

    if (!bucket) {
      return safeJSON({ error: "Bucket not found" }, 404);
    }

    const uploadResp = await fetch(
      `${apiUrl}/b2api/v3/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bucketId: bucket.bucketId })
      }
    );

    const uploadData = await uploadResp.json();

    const fileBuffer = await file.arrayBuffer();
    const fileSha1 = await sha1(fileBuffer);

    const uploadFileResp = await fetch(uploadData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadData.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(file.name),
        "Content-Type": "application/octet-stream",
        "X-Bz-Content-Sha1": fileSha1
      },
      body: fileBuffer
    });

    const resultText = await uploadFileResp.text();

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return safeJSON({
        error: "Upload response not JSON",
        raw: resultText
      }, 500);
    }

    if (!uploadFileResp.ok) {
      return safeJSON({ error: "Upload failed", result }, 500);
    }

    const url =
      `https://f000.backblazeb2.com/file/${env.B2_BUCKET}/${encodeURIComponent(file.name)}`;

    return safeJSON({
      success: true,
      fileId: result.fileId,
      url
    });

  } catch (err) {
    return safeJSON({
      error: err.message,
      stack: err.stack
    }, 500);
  }
}