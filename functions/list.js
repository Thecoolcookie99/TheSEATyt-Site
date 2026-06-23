function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet({ env }) {
  try {
    if (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET_ID) {
      return json({ error: "Missing B2 env vars" }, 500);
    }

    const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);

    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    const authData = await authResp.json();
    if (!authResp.ok) return json({ error: "Auth failed", authData }, 500);

    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const authToken = authData.authorizationToken;

    const resp = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId: env.B2_BUCKET_ID,
        maxFileCount: 100,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) return json({ error: "List failed", data }, 500);

    const files = (data.files || [])
      .filter((f) => f.action === "upload")
      .map((f) => ({
        fileId: f.fileId,
        name: f.fileName,
        size: f.contentLength,
        uploaded: f.uploadTimestamp,
        downloadUrl: `/download?fileId=${encodeURIComponent(f.fileId)}&name=${encodeURIComponent(f.fileName)}`,
      }));

    return json({ files });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}