export async function onRequest() {
  const KEY_ID = B2_KEY_ID;
  const APP_KEY = B2_APP_KEY;

  const credentials = btoaNode(KEY_ID + ":" + APP_KEY);

  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: {
      Authorization: "Basic " + credentials
    }
  });

  const data = await res.json();

  return new Response(JSON.stringify({
    apiUrl: data.apiUrl,
    authToken: data.authorizationToken,
    bucketId: data.allowed.bucketId,
    bucketName: data.allowed.bucketName
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// Cloudflare-safe base64
function btoaNode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}