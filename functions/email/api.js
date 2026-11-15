// Cloudflare Pages Function -> POST /email/api
// Sends through Cloudflare Email Service (Email Sending) via its REST API.
// Secrets / variables (Pages > Settings > Variables and Secrets):
//   EMAIL_PASSWORD  - the password for the page
//   CF_API_TOKEN    - your Cloudflare API token (needs Email Sending permission)
//   CF_ACCOUNT_ID   - your Cloudflare account ID
// theseat.yt must be onboarded under Email Sending in the Cloudflare dashboard.

const DOMAIN = "theseat.yt";
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b)))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function onRequestPost({ request, env }) {
  if (!env.EMAIL_PASSWORD || !env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ error: "Server is missing EMAIL_PASSWORD, CF_API_TOKEN or CF_ACCOUNT_ID." }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request." }, 400); }

  if (!body.password || !(await safeEqual(body.password, env.EMAIL_PASSWORD))) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (body.action === "login") return json({ ok: true });
  if (body.action !== "send") return json({ error: "Unknown action." }, 400);

  const local = String(body.from || "");
  if (!/^[A-Za-z0-9._+-]{1,64}$/.test(local)) {
    return json({ error: "From name may only contain letters, numbers, . _ + -" }, 400);
  }

  const to = Array.isArray(body.to) ? body.to : [];
  if (!to.length || to.length > 50 || !to.every(a => EMAIL_RE.test(a))) {
    return json({ error: "Enter at least one valid recipient address." }, 400);
  }

  const subject = String(body.subject || "").trim();
  const text = String(body.text || "");
  if (!subject || !text) return json({ error: "Subject and message are required." }, 400);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: `${local}@${DOMAIN}`, to, subject, text })
    }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok || data.success === false) {
    const msg = (data.errors && data.errors[0] && data.errors[0].message) || "Cloudflare rejected the request.";
    return json({ error: msg }, 502);
  }
  return json({ ok: true });
}