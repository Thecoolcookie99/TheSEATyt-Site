// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️', svg:'🖼️',
    mp4:'🎬', mov:'🎬', avi:'🎬', mkv:'🎬',
    mp3:'🎵', wav:'🎵', flac:'🎵',
    pdf:'📄', doc:'📝', docx:'📝', txt:'📝', md:'📝',
    zip:'📦', tar:'📦', gz:'📦', rar:'📦',
    js:'💾', ts:'💾', py:'💾', html:'💾', css:'💾', json:'💾',
  };
  return map[ext] || '📁';
}

function log(msg, type = '') {
  const el = $('log');
  if (!el) return console.log(msg);
  el.classList.add('visible');
  const line = document.createElement('div');
  line.className = 'log-line ' + type;
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// ── SHA‑1 (required by B2 native API) ─────────────────────────────────────

async function sha1Hex(data) {
  const enc = new TextEncoder();
  let bytes;
  if (typeof data === 'string') bytes = enc.encode(data);
  else if (data instanceof ArrayBuffer) bytes = data;
  else if (ArrayBuffer.isView(data)) bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  else bytes = enc.encode('');
  const buf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── B2 Native API calls (using the main API endpoint to avoid CORS issues) ──

const B2_API_BASE = 'https://api.backblazeb2.com/b2api/v4';

async function authorizeAccount(keyId, appKey) {
  const auth = btoa(`${keyId}:${appKey}`);
  const response = await fetch(`${B2_API_BASE}/b2_authorize_account`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Authorization failed (${response.status}): ${errText}`);
  }
  return await response.json();
}

async function getUploadUrl(authToken, bucketId) {
  const response = await fetch(
    `${B2_API_BASE}/b2_get_upload_url?bucketId=${bucketId}`,
    { headers: { 'Authorization': authToken } }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get upload URL (${response.status}): ${errText}`);
  }
  return await response.json();
}

// ── File state ──────────────────────────────────────────────────────────────

let files = [];

function renderFileList() {
  const list = $('file-list');
  if (!list) {
    console.error('❌ Element #file-list missing');
    return;
  }
  list.innerHTML = '';
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.id = `file-item-${i}`;
    item.innerHTML = `
      <span class="file-item-icon">${fileIcon(f.file.name)}</span>
      <div class="file-item-info">
        <div class="file-item-name">${f.file.name}</div>
        <div class="file-item-meta">${fmtBytes(f.file.size)} · ${f.file.type || 'unknown type'}</div>
        <div class="progress-wrap"><div class="progress-bar" id="bar-${i}"></div></div>
      </div>
      <span class="status-chip pending" id="chip-${i}">pending</span>
      <button class="file-item-remove" data-idx="${i}" title="Remove">✕</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      files.splice(+btn.dataset.idx, 1);
      renderFileList();
      const btnEl = $('uploadBtn');
      if (btnEl) btnEl.disabled = files.length === 0;
    });
  });

  const btnEl = $('uploadBtn');
  if (btnEl) btnEl.disabled = files.length === 0;
}

function addFiles(newFiles) {
  console.log('📁 addFiles called with', newFiles.length, 'files');
  for (const f of newFiles) {
    console.log('  -', f.name, f.size);
    if (!files.find(x => x.file.name === f.name && x.file.size === f.size)) {
      files.push({ file: f, status: 'pending' });
    }
  }
  renderFileList();
}

// ── Upload using B2 Native API ──────────────────────────────────────────────

async function uploadFile(idx) {
  const { file } = files[idx];
  const keyId   = $('keyId').value.trim();
  const appKey  = $('appKey').value.trim();
  const bucketId = $('bucket').value.trim();   // user must enter bucket ID
  const prefix  = $('prefix').value.trim();

  // Sanitise file name
  const safeName = file.name
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '_')
    .replace(/\s+/g, '_');

  const b2FileName = prefix
    ? `${prefix.replace(/\/$/, '')}/${safeName}`
    : safeName;

  const chip = $(`chip-${idx}`);
  const bar  = $(`bar-${idx}`);
  const item = $(`file-item-${idx}`);

  if (chip) { chip.className = 'status-chip uploading'; chip.textContent = 'uploading'; }
  if (item) item.classList.add('uploading');

  log(`Uploading ${file.name} → ${b2FileName}`, 'inf');

  try {
    // 1. Authorize
    log('Authorizing…', 'inf');
    const authData = await authorizeAccount(keyId, appKey);
    const authToken = authData.authorizationToken;
    log('✓ Authorized', 'ok');

    // 2. Get upload URL
    log('Requesting upload URL…', 'inf');
    const uploadData = await getUploadUrl(authToken, bucketId);
    const { uploadUrl, authorizationToken: uploadAuthToken } = uploadData;
    log('✓ Upload URL obtained', 'ok');

    // 3. Compute SHA‑1
    log('Computing SHA‑1…', 'inf');
    const arrayBuf = await file.arrayBuffer();
    const sha1 = await sha1Hex(arrayBuf);
    log(`SHA‑1: ${sha1}`, 'inf');

    // 4. Upload via XHR (progress tracking)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      xhr.setRequestHeader('Authorization', uploadAuthToken);
      xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(b2FileName));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-Bz-Content-Sha1', sha1);
      xhr.setRequestHeader('Content-Length', String(file.size));

      xhr.upload.onprogress = e => {
        if (e.lengthComputable && bar) {
          bar.style.width = ((e.loaded / e.total) * 100) + '%';
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr);
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));

      xhr.send(file);
    });

    // Success
    if (bar) bar.style.width = '100%';
    if (chip) { chip.className = 'status-chip done'; chip.textContent = 'done'; }
    if (item) item.classList.remove('uploading');
    files[idx].status = 'done';
    log(`✓ ${file.name} uploaded successfully`, 'ok');

    // Construct public URL (if bucket is public)
    const accountId = authData.accountId;
    const publicUrl = `https://f${accountId.slice(-6)}.backblazeb2.com/file/${bucketId}/${encodeURIComponent(b2FileName)}`;
    log(`   URL: ${publicUrl}`);

  } catch (err) {
    if (chip) { chip.className = 'status-chip error'; chip.textContent = 'error'; }
    if (item) item.classList.remove('uploading');
    files[idx].status = 'error';
    log(`✗ ${file.name}: ${err.message}`, 'err');
    console.error('Upload error:', err);
  }
}

async function uploadAll() {
  const keyId   = $('keyId').value.trim();
  const appKey  = $('appKey').value.trim();
  const bucketId = $('bucket').value.trim();

  if (!keyId || !appKey) { alert('Enter your Key ID and Application Key.'); return; }
  if (!bucketId)         { alert('Enter your bucket ID (not the name).'); return; }
  if (files.length === 0){ alert('Add at least one file.'); return; }

  const btn = $('uploadBtn');
  if (btn) btn.disabled = true;
  const logEl = $('log');
  if (logEl) logEl.innerHTML = '';

  let done = 0, errors = 0;

  for (let i = 0; i < files.length; i++) {
    if (files[i].status !== 'done') {
      await uploadFile(i);
      if (files[i].status === 'done') done++;
      else errors++;
    }
  }

  const summary = $('summary');
  if (summary) {
    summary.style.display = 'block';
    summary.innerHTML = errors === 0
      ? `<span style="color:var(--success)">✓ ${done} file${done !== 1 ? 's' : ''} uploaded successfully</span>`
      : `<span style="color:var(--muted)">${done} succeeded · <span style="color:var(--error)">${errors} failed</span></span>`;
  }

  if (btn) btn.disabled = false;
}

// ── Events ──────────────────────────────────────────────────────────────────

const fileInput = $('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', e => {
    try {
      console.log('📎 File input change:', e.target.files);
      addFiles(e.target.files);
    } catch (err) {
      console.error('Error in file input handler:', err);
    }
    e.target.value = '';
  });
} else {
  console.error('❌ Element #fileInput not found');
}

const dz = $('dropZone');
if (dz) {
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    try {
      console.log('📎 Drop event:', e.dataTransfer.files);
      addFiles(e.dataTransfer.files);
    } catch (err) {
      console.error('Error in drop handler:', err);
    }
  });
} else {
  console.error('❌ Element #dropZone not found');
}

const uploadBtn = $('uploadBtn');
if (uploadBtn) {
  uploadBtn.addEventListener('click', uploadAll);
} else {
  console.error('❌ Element #uploadBtn not found');
}

console.log('✅ B2 Native Uploader ready (main API endpoint for CORS)');