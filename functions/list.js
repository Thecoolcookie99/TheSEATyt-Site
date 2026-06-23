export async function onRequestGet({ env }) {
  try {
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

    const apiUrl = authData.apiInfo.storageApi.apiUrl;
    const authToken = authData.authorizationToken;

    const bucketId = env.B2_BUCKET_ID;

    const resp = await fetch(
      `${apiUrl}/b2api/v3/b2_list_file_names`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bucketId,
          maxFileCount: 100
        })
      }
    );

    const data = await resp.json();

    const files = (data.files || []).map(f => ({
      name: f.fileName,
      size: f.contentLength,
      uploaded: f.uploadTimestamp,
      url: `https://f000.backblazeb2.com/file/${env.B2_BUCKET}/${f.fileName}`
    }));

    return Response.json({ files });

  } catch (err) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}