export async function onRequestPost({ request, env }) {
  const provided = request.headers.get('x-files-password') || '';
  if (provided !== env.FILES_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { fileId, durationSeconds } = body;

  if (!fileId || !durationSeconds) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
  }

  const auth = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);

  const authResp = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    { headers: { Authorization: `Basic ${auth}` } }
  );

  const authData = await authResp.json();

  if (!authResp.ok) {
    return new Response(JSON.stringify(authData), { status: 500 });
  }

  // 1. Get file info (to convert fileId → fileName)
  const fileInfoResp = await fetch(
    `${authData.apiInfo.storageApi.apiUrl}/b2api/v3/b2_get_file_info`,
    {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fileId })
    }
  );

  const fileInfo = await fileInfoResp.json();

  if (!fileInfoResp.ok) {
    return new Response(JSON.stringify(fileInfo), { status: 500 });
  }

  const fileName = fileInfo.fileName;

  // 2. Create download authorization
  const auth2 = await fetch(
    `${authData.apiInfo.storageApi.apiUrl}/b2api/v3/b2_get_download_authorization`,
    {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucketId: env.B2_BUCKET_ID,
        fileNamePrefix: fileName,
        validDurationInSeconds: durationSeconds
      })
    }
  );

  const auth2Data = await auth2.json();

  if (!auth2.ok) {
    return new Response(JSON.stringify(auth2Data), { status: 500 });
  }

  const downloadBase = authData.apiInfo.storageApi.downloadUrl || authData.apiInfo.downloadUrl;
  // Resolve bucket name if not set in env
  let bucketName = env.B2_BUCKET_NAME;
  if (!bucketName) {
    try {
      const listResp = await fetch(`${authData.apiInfo.storageApi.apiUrl}/b2api/v3/b2_list_buckets`, {
        method: 'POST',
        headers: { Authorization: authData.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: authData.accountId })
      });
      const listData = await listResp.json();
      if (listResp.ok && Array.isArray(listData.buckets)) {
        const b = listData.buckets.find(x => x.bucketId === env.B2_BUCKET_ID);
        if (b) bucketName = b.bucketName;
      }
    } catch (e) {
      // ignore and fallback
    }
  }

  if (!bucketName) {
    return new Response(JSON.stringify({ error: 'Bucket name not available' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const url = `${downloadBase}/file/${bucketName}/${encodeURIComponent(fileName)}?Authorization=${auth2Data.authorizationToken}`;

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" }
  });
}