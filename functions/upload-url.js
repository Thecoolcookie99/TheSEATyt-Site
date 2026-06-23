async function sha1(buffer) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    buffer
  );

  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const authString =
      `${env.B2_KEY_ID}:${env.B2_APP_KEY}`;

    const authHeader =
      "Basic " + btoa(authString);

    const authResp = await fetch(
      "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
      {
        headers: {
          Authorization: authHeader
        }
      }
    );

    const authData = await authResp.json();

    if (!authResp.ok) {
      return Response.json(authData, {
        status: 500
      });
    }

    const apiUrl =
      authData.apiInfo.storageApi.apiUrl;

    const authToken =
      authData.authorizationToken;

    const accountId =
      authData.accountId;

    const bucketResp = await fetch(
      `${apiUrl}/b2api/v3/b2_list_buckets`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          accountId
        })
      }
    );

    const bucketData =
      await bucketResp.json();

    const bucket =
      bucketData.buckets.find(
        b => b.bucketName === env.B2_BUCKET
      );

    if (!bucket) {
      return Response.json(
        { error: "Bucket not found" },
        { status: 404 }
      );
    }

    const uploadUrlResp = await fetch(
      `${apiUrl}/b2api/v3/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          bucketId: bucket.bucketId
        })
      }
    );

    const uploadInfo =
      await uploadUrlResp.json();

    const fileBuffer =
      await file.arrayBuffer();

    const fileSha1 =
      await sha1(fileBuffer);

    const uploadResp = await fetch(
      uploadInfo.uploadUrl,
      {
        method: "POST",
        headers: {
          Authorization:
            uploadInfo.authorizationToken,
          "X-Bz-File-Name":
            encodeURIComponent(file.name),
          "Content-Type":
            "application/octet-stream",
          "X-Bz-Content-Sha1":
            fileSha1
        },
        body: fileBuffer
      }
    );

    const result =
      await uploadResp.json();

    if (!uploadResp.ok) {
      return Response.json(result, {
        status: 500
      });
    }

    const publicUrl =
      `https://f000.backblazeb2.com/file/${env.B2_BUCKET}/${encodeURIComponent(file.name)}`;

    return Response.json({
      success: true,
      fileId: result.fileId,
      fileName: file.name,
      url: publicUrl
    });

  } catch (err) {
    return Response.json(
      {
        error: err.message
      },
      { status: 500 }
    );
  }
}