function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Files-Password",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const provided = request.headers.get("x-files-password") || "";
    if (!env.FILES_PASSWORD) return json({ error: "Missing FILES_PASSWORD env var" }, 500);
    if (provided !== env.FILES_PASSWORD) return json({ error: "Unauthorized" }, 401);

    if (!env.B2_KEY_ID || !env.B2_APP_KEY) {
      return json({ error: "Missing B2 env vars" }, 500);
    }

    const data = await request.json().catch(() => ({}));
    const fileId = data.fileId;
    const fileName = data.fileName;
    const newFileName = data.newFileName;

    if (!fileId || !fileName || !newFileName) {
      return json({ error: "Missing fileId, fileName, or newFileName" }, 400);
    }

    if (fileName === newFileName) {
      return json({ ok: true, message: "Name unchanged" });
    }

    const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);
    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const authData = await authResp.json();
    if (!authResp.ok) return json({ error: "Auth failed", authData }, 500);

    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const authToken = authData.authorizationToken;

    const copyResp = await fetch(`${apiUrl}/b2api/v3/b2_copy_file`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceFileId: fileId,
        destinationBucketId: env.B2_BUCKET_ID,
        fileName: newFileName,
      }),
    });

    const copyData = await copyResp.json().catch(() => null);
    if (!copyResp.ok) return json({ error: "Rename copy failed", copyData }, 500);

    const deleteResp = await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileId, fileName }),
    });

    const deleteData = await deleteResp.json().catch(() => null);
    if (!deleteResp.ok) return json({ error: "Rename cleanup failed", deleteData }, 500);

    return json({ ok: true, result: { copied: copyData, deleted: deleteData } });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
