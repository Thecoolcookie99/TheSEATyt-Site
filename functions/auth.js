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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.FILES_PASSWORD) {
      return json({ error: "Missing FILES_PASSWORD env var" }, 500);
    }

    const data = await request.json().catch(() => ({}));
    const pw = (data.password || "").toString();

    if (pw === env.FILES_PASSWORD) {
      return json({ ok: true });
    }

    return json({ ok: false }, 401);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
