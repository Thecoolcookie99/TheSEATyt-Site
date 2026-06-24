// Client-side hooks. Password is validated server-side via POST /auth

const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const filesEl = document.getElementById("files");
const uploadBtn = document.getElementById("uploadBtn");
const refreshBtn = document.getElementById("refreshBtn");

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function fmtDate(ts) {
  return new Date(Number(ts)).toLocaleString();
}

async function upload() {
  const file = fileInput.files[0];
  if (!file) {
    alert("Choose a file first.");
    return;
  }

  uploadStatus.textContent = "Uploading...";
  uploadBtn.disabled = true;

  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/upload", {
      method: "POST",
      body: form,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || "Server returned non-JSON response");
    }

    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }

    uploadStatus.textContent = `Uploaded: ${data.fileName}`;
    fileInput.value = "";
    await loadFiles();
  } catch (err) {
    uploadStatus.textContent = `ERROR:\n${err.message}`;
  } finally {
    uploadBtn.disabled = false;
  }
}

async function loadFiles() {
  filesEl.innerHTML = `<div class="empty">Loading...</div>`;

  try {
    const res = await fetch("/list");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load files");
    }

    const files = data.files || [];
    if (!files.length) {
      filesEl.innerHTML = `<div class="empty">No files found.</div>`;
      return;
    }

    filesEl.innerHTML = "";
    for (const file of files) {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="meta">
          <div class="name">${escapeHtml(file.name)}</div>
          <div class="small">${fmtSize(file.size)} • ${fmtDate(file.uploaded)}</div>
        </div>
        <div class="actions">
          <a class="btn" href="${file.downloadUrl}">Download</a>
        </div>
      `;
      filesEl.appendChild(item);
    }
  } catch (err) {
    filesEl.innerHTML = `<div class="empty" style="color: var(--danger);">ERROR: ${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function init() {
  uploadBtn.addEventListener("click", upload);
  refreshBtn.addEventListener("click", loadFiles);
  loadFiles();
}

/* Password overlay handling */
function showOverlay() {
  let overlay = document.getElementById('pwOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pwOverlay';
    overlay.innerHTML = `
      <div class="pw-box">
        <h3>Enter password</h3>
        <p class="small">This page is protected. Enter the password to continue.</p>
        <input id="pwInput" class="pw-input" type="password" placeholder="Password" />
        <div class="pw-actions">
          <button id="pwSubmit" class="btn">Unlock</button>
        </div>
        <div id="pwError" class="pw-error">Incorrect password</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const pwInput = document.getElementById('pwInput');
    const pwSubmit = document.getElementById('pwSubmit');
    const pwError = document.getElementById('pwError');

    pwSubmit.addEventListener('click', async () => {
      const val = pwInput.value || '';
      try {
        const res = await fetch('/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: val })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          sessionStorage.setItem('b2_authed', '1');
          overlay.style.display = 'none';
          init();
        } else {
          pwError.textContent = 'Incorrect password';
          pwError.style.display = 'block';
        }
      } catch (err) {
        pwError.textContent = 'Authentication error';
        pwError.style.display = 'block';
      }
    });

    pwInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') pwSubmit.click();
    });
  }
  overlay.style.display = 'flex';
}

function hideOverlay() {
  const overlay = document.getElementById('pwOverlay');
  if (overlay) overlay.style.display = 'none';
}

// On load, check sessionStorage for auth, otherwise show overlay
if (sessionStorage.getItem('b2_authed') === '1') {
  init();
} else {
  showOverlay();
}
