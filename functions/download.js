export async function onRequestGet({ request, env }) {
  try {
    // Authenticate using FILES_PASSWORD header
    const provided = request.headers.get('x-files-password') || '';
    if (!env.FILES_PASSWORD) return new Response(JSON.stringify({ error: 'Missing FILES_PASSWORD env var' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    if (provided !== env.FILES_PASSWORD) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    if (!env.B2_KEY_ID || !env.B2_APP_KEY) {
      return new Response("Missing B2 env vars", { status: 500 });
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get("fileId");
    const name = url.searchParams.get("name") || "download";

    if (!fileId) {
      return new Response("Missing fileId", { status: 400 });
    }

    const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);

    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    const authData = await authResp.json();

    if (!authResp.ok) {
      return new Response(JSON.stringify(authData), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const downloadBase = authData.apiInfo.storageApi.downloadUrl;
    const b2Resp = await fetch(
      `${downloadBase}/b2api/v4/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`,
      {
        headers: {
          Authorization: authData.authorizationToken,
        },
      }
    );

    if (!b2Resp.ok) {
      const errText = await b2Resp.text();
      return new Response(errText, {
        status: b2Resp.status,
        headers: {
          "Content-Type": b2Resp.headers.get("Content-Type") || "application/json",
        },
      });
    }

    const headers = new Headers();

    const passthrough = [
      "content-type",
      "content-length",
      "x-bz-file-id",
      "x-bz-file-name",
      "x-bz-content-sha1",
      "x-bz-upload-timestamp",
      "cache-control",
      "content-language",
      "content-encoding",
      "expires",
      "x-bz-server-side-encryption",
      "x-bz-server-side-encryption-customer-algorithm",
      "x-bz-server-side-encryption-customer-key-md5",
      "content-disposition",
    ];

    for (const key of passthrough) {
      const value = b2Resp.headers.get(key);
      if (value) headers.set(key, value);
    }

    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
    );

    return new Response(b2Resp.body, {
      status: b2Resp.status,
      headers,
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}