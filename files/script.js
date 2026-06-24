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

    const pw = localStorage.getItem('files_password') || '';
    const res = await fetch("/upload", {
      method: "POST",
      body: form,
      headers: {
        'X-Files-Password': pw,
      }
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
    const pw = localStorage.getItem('files_password') || '';
    const res = await fetch("/list", { headers: { 'X-Files-Password': pw } });
    const data = await res.json();

    if (!res.ok) {
      // If unauthorized, prompt for password
      if (res.status === 401) {
        localStorage.removeItem('files_password');
        showOverlay();
        return;
      }
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
            <div class="meta" style="display:flex;gap:12px;align-items:center;">
              <img class="fileicon" src="${fileIconDataUrl(file.name)}" alt="icon" width="36" height="36" />
              <div>
                <div class="name">${escapeHtml(file.name)}</div>
                <div class="small">${fmtSize(file.size)} • ${fmtDate(file.uploaded)}</div>
              </div>
            </div>
            <div class="actions">
              <button class="btn downloadBtn" data-id="${encodeURIComponent(file.fileId)}" data-name="${encodeURIComponent(file.name)}">Download</button>
              <button id="share-${encodeURIComponent(file.fileId)}" class="btn shareBtn" data-id="${encodeURIComponent(file.fileId)}" data-name="${encodeURIComponent(file.name)}">Share</button>
              <button class="btn secondary deleteBtn" data-id="${encodeURIComponent(file.fileId)}" data-name="${encodeURIComponent(file.name)}">Delete</button>
            </div>
          `;
      filesEl.appendChild(item);
    }
    // Attach download handlers
    document.querySelectorAll('.downloadBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = decodeURIComponent(btn.dataset.id);
        const name = decodeURIComponent(btn.dataset.name);
        downloadFile(id, name);
      });
    });
      // Attach delete handlers
      document.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = decodeURIComponent(btn.dataset.id);
          const name = decodeURIComponent(btn.dataset.name);
          if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
          try {
            const pw = localStorage.getItem('files_password') || '';
            const res = await fetch('/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Files-Password': pw },
              body: JSON.stringify({ fileId: id, fileName: name })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (res.status === 401) { localStorage.removeItem('files_password'); showOverlay(); return; }
              throw new Error(data.error || 'Delete failed');
            }
            await loadFiles();
          } catch (err) {
            alert('Delete error: ' + err.message);
          }
        });
      });
      document.querySelectorAll('.shareBtn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const fileId = decodeURIComponent(btn.dataset.id);
    const fileName = decodeURIComponent(btn.dataset.name);

    const hours = prompt(
      `How long should "${fileName}" be available?\nEnter hours (e.g. 1, 6, 24):`,
      "1"
    );

    if (!hours) return;

    const duration = parseInt(hours, 10);
    if (isNaN(duration) || duration <= 0) {
      alert("Invalid duration");
      return;
    }

    try {
      const pw = localStorage.getItem('files_password') || '';

      const res = await fetch('/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Files-Password': pw
        },
        body: JSON.stringify({
          fileId,
          fileName,
          durationSeconds: duration * 3600
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('files_password');
          showOverlay();
          return;
        }
        throw new Error(data.error || 'Share failed');
      }

      await navigator.clipboard.writeText(data.url);

      alert(`Share link copied!\n\n${data.url}`);

    } catch (err) {
      alert('Share error: ' + err.message);
    }
  });
});
  } catch (err) {
    filesEl.innerHTML = `<div class="empty" style="color: var(--danger);">ERROR: ${escapeHtml(err.message)}</div>`;
  }
}

async function downloadFile(fileId, name) {
  const pw = localStorage.getItem('files_password') || '';
  const url = `/download?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, { headers: { 'X-Files-Password': pw } });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('files_password');
        showOverlay();
        return;
      }
      const txt = await res.text().catch(() => '');
      throw new Error(txt || 'Download failed');
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    alert('Download error: ' + err.message);
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

function fileIconDataUrl(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const imageExts = ['png','jpg','jpeg','gif','webp','bmp','svg'];
  if (imageExts.includes(ext)) {
    // simple image icon (green)
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2' fill='%23e6f0ff' stroke='%232563eb'/><circle cx='8.5' cy='8.5' r='1.5' fill='%232563eb'/><path d='M21 15l-5-5L9 21' stroke='%232563eb' stroke-width='1.2' fill='none'/></svg>`)} `;
  }
  // generic file icon (gray)
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2' fill='%23f3f4f6' stroke='%236b7280'/><path d='M8 7h8M8 12h8M8 17h5' stroke='%236b7280'/></svg>`)} `;
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
          // Save password in localStorage for subsequent requests
          localStorage.setItem('files_password', val);
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

// On load, check localStorage for saved password; if missing, show overlay
if (localStorage.getItem('files_password')) {
  init();
} else {
  showOverlay();
}
