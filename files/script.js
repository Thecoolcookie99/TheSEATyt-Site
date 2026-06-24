// Client-side hooks. Password is validated server-side via POST /auth

const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const filesEl = document.getElementById("files");
const uploadBtn = document.getElementById("uploadBtn");
const refreshBtn = document.getElementById("refreshBtn");
let currentPath = ""; // e.g. "folder/subfolder/"

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

    // Build directory view for currentPath
    const dirs = new Set();
    const shownFiles = [];
    for (const file of files) {
      const name = file.name || '';
      if (!name.startsWith(currentPath)) continue;
      const rest = name.slice(currentPath.length).replace(/^\//, '');
      if (!rest) continue;
      const parts = rest.split('/');
      if (parts.length > 1) {
        dirs.add(parts[0]);
      } else {
        shownFiles.push(file);
      }
    }

    filesEl.innerHTML = "";
    // Breadcrumb: remove any existing breadcrumb to avoid duplicates
    document.querySelectorAll('.breadcrumb').forEach((el) => el.remove());
    const bc = document.createElement('div');
    bc.style.marginBottom = '8px';
    bc.className = 'breadcrumb';
    function renderBreadcrumb() {
      bc.innerHTML = '';
      const rootBtn = document.createElement('button');
      rootBtn.className = 'btn secondary';
      rootBtn.textContent = 'Root';
      rootBtn.addEventListener('click', () => { currentPath = ''; loadFiles(); });
      bc.appendChild(rootBtn);
      if (!currentPath) { filesEl.insertAdjacentElement('beforebegin', bc); return; }
      const segs = currentPath.replace(/\/$/, '').split('/');
      let acc = '';
      for (let i = 0; i < segs.length; i++) {
        acc += segs[i] + '/';
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginLeft = '8px';
        btn.textContent = segs[i];
        btn.addEventListener('click', () => { currentPath = acc; loadFiles(); });
        bc.appendChild(btn);
      }
      filesEl.insertAdjacentElement('beforebegin', bc);
    }

    renderBreadcrumb();

    // Render directories first
    const dirList = Array.from(dirs).sort();
    for (const d of dirList) {
      const item = document.createElement('div');
      item.className = 'item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.display = 'flex';
      meta.style.gap = '12px';
      meta.style.alignItems = 'center';

      const img = document.createElement('img');
      img.className = 'fileicon';
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M3 7a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' fill='%23e6f0ff' stroke='%232563eb'/></svg>")}`;
      img.alt = 'folder';
      img.width = 36; img.height = 36;

      const info = document.createElement('div');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'name';
      nameDiv.textContent = d + '/';
      nameDiv.style.cursor = 'pointer';
      nameDiv.addEventListener('click', () => { currentPath = currentPath + d + '/'; loadFiles(); });
      const smallDiv = document.createElement('div');
      smallDiv.className = 'small';
      smallDiv.textContent = 'Folder';

      info.appendChild(nameDiv);
      info.appendChild(smallDiv);
      meta.appendChild(img);
      meta.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const openBtn = document.createElement('button');
      openBtn.className = 'btn';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => { currentPath = currentPath + d + '/'; loadFiles(); });
      actions.appendChild(openBtn);

      item.appendChild(meta);
      item.appendChild(actions);
      filesEl.appendChild(item);
    }

    // Render files in this directory
    for (const file of shownFiles.sort((a,b)=> (a.name||'').localeCompare(b.name||''))) {
      const item = document.createElement('div');
      item.className = 'item';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.display = 'flex';
      meta.style.gap = '12px';
      meta.style.alignItems = 'center';

      const img = document.createElement('img');
      img.className = 'fileicon';
      img.src = fileIconDataUrl(file.name);
      img.alt = 'icon';
      img.width = 36; img.height = 36;

      const info = document.createElement('div');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'name';
      const baseName = file.name.replace(/^.*\//, '');
      nameDiv.textContent = baseName;
      const smallDiv = document.createElement('div');
      smallDiv.className = 'small';
      smallDiv.textContent = `${fmtSize(file.size)} • ${fmtDate(file.uploaded)}`;

      info.appendChild(nameDiv);
      info.appendChild(smallDiv);
      meta.appendChild(img);
      meta.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', () => downloadFile(file.fileId, file.name));

      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn shareBtn';
      shareBtn.textContent = 'Share';
      shareBtn.addEventListener('click', async () => {
        const hours = prompt(`How long should "${file.name}" be available?\nEnter hours (e.g. 1, 6, 24):`, '1');
        if (!hours) return;
        const duration = parseInt(hours, 10);
        if (isNaN(duration) || duration <= 0) { alert('Invalid duration'); return; }
        try {
          const pw = localStorage.getItem('files_password') || '';
          const res = await fetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Files-Password': pw },
            body: JSON.stringify({ fileId: file.fileId, fileName: file.name, durationSeconds: duration * 3600 })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { if (res.status === 401) { localStorage.removeItem('files_password'); showOverlay(); return; } throw new Error(data.error || 'Share failed'); }
          await navigator.clipboard.writeText(data.url);
          alert(`Share link copied!\n\n${data.url}`);
        } catch (err) { alert('Share error: ' + err.message); }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn secondary';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
        try {
          const pw = localStorage.getItem('files_password') || '';
          const res = await fetch('/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Files-Password': pw }, body: JSON.stringify({ fileId: file.fileId, fileName: file.name }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { if (res.status === 401) { localStorage.removeItem('files_password'); showOverlay(); return; } throw new Error(data.error || 'Delete failed'); }
          await loadFiles();
        } catch (err) { alert('Delete error: ' + err.message); }
      });

      actions.appendChild(dlBtn);
      actions.appendChild(shareBtn);
      actions.appendChild(delBtn);

      item.appendChild(meta);
      item.appendChild(actions);
      filesEl.appendChild(item);
    }
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
