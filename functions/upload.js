async function sha1(buffer) {
  const hash = await crypto.subtle.digest("SHA-1", buffer);
  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data, status = 200) {
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
      return json({ error: "No file uploaded" }, 400);
    }

    // 1. Authorize with Backblaze
    const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);

    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const authData = await authResp.json();

    if (!authResp.ok) {
      return json({ error: "Auth failed", authData }, 500);
    }

    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const authToken = authData.authorizationToken;

    // 2. DIRECT bucket ID (FIXED)
    const bucketId = env.B2_BUCKET_ID;

    if (!bucketId) {
      return json({ error: "Missing B2_BUCKET_ID env var" }, 500);
    }

    // 3. Get upload URL
    const uploadUrlResp = await fetch(
      `${apiUrl}/b2api/v3/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bucketId })
      }
    );

    const uploadData = await uploadUrlResp.json();

    if (!uploadUrlResp.ok) {
      return json({ error: "Upload URL failed", uploadData }, 500);
    }

    // 4. Upload file
    const buffer = await file.arrayBuffer();
    const fileSha1 = await sha1(buffer);

    const uploadResp = await fetch(uploadData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadData.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(file.name),
        "Content-Type": "application/octet-stream",
        "X-Bz-Content-Sha1": fileSha1
      },
      body: buffer
    });

    const resultText = await uploadResp.text();

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return json(
        {
          error: "Invalid upload response",
          raw: resultText
        },
        500
      );
    }

    if (!uploadResp.ok) {
      return json({ error: "Upload failed", result }, 500);
    }

    // 5. Public URL
    const url =
      `https://f000.backblazeb2.com/file/${env.B2_BUCKET}/${encodeURIComponent(file.name)}`;

    return json({
      success: true,
      fileId: result.fileId,
      fileName: file.name,
      url
    });

  } catch (err) {
    return json({
      error: err.message,
      stack: err.stack
    }, 500);
  }
}