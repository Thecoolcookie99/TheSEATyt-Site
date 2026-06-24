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
    `${authData.apiInfo.apiUrl}/b2api/v3/b2_get_download_authorization`,
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

  const url = `${authData.apiInfo.downloadUrl}/file/${env.B2_BUCKET_NAME}/${encodeURIComponent(fileName)}?Authorization=${auth2Data.authorizationToken}`;

  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" }
  });
}