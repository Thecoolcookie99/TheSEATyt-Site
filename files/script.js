const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const uploadStatus = document.getElementById("uploadStatus");
const uploadProgressWrap = document.getElementById("uploadProgressWrap");
const uploadProgressText = document.getElementById("uploadProgressText");
const uploadProgressPercent = document.getElementById("uploadProgressPercent");
const uploadProgressFill = document.getElementById("uploadProgressFill");
const downloadProgressWrap = document.getElementById("downloadProgressWrap");
const downloadProgressText = document.getElementById("downloadProgressText");
const downloadProgressPercent = document.getElementById("downloadProgressPercent");
const downloadProgressFill = document.getElementById("downloadProgressFill");
const filesEl = document.getElementById("files");

let currentPath = "";
let initialized = false;
let loadSeq = 0;

/* ---------------- UTILS ---------------- */

function fmtSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let i = 0;
  let size = bytes / 1024;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return size.toFixed(1) + " " + units[i];
}

function fmtDate(ts) {
  return new Date(Number(ts)).toLocaleString();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function updateProgressBar(progressWrap, progressFill, progressText, progressPercent, percent, text) {
  if (!progressWrap || !progressFill || !progressText || !progressPercent) return;

  const value = Math.max(0, Math.min(100, percent));
  progressWrap.hidden = false;
  progressText.textContent = text;
  progressPercent.textContent = value + "%";
  progressFill.style.width = value + "%";
}

function hideProgressBar(progressWrap, progressFill, progressText, progressPercent) {
  if (!progressWrap || !progressFill || !progressText || !progressPercent) return;
  progressWrap.hidden = true;
  progressFill.style.width = "0%";
  progressText.textContent = "";
  progressPercent.textContent = "0%";
}

/* ---------------- INIT ---------------- */

function init() {
  if (initialized) return;
  initialized = true;

  if (!uploadBtn || !fileInput || !filesEl) {
    console.error("Missing DOM elements");
    return;
  }

  uploadBtn.addEventListener("click", upload);
  refreshBtn?.addEventListener("click", loadFiles);

  // path controls (Up / Root)
  document.getElementById && (() => {
    const upBtn = document.getElementById("upBtn");
    const rootBtn = document.getElementById("rootBtn");
    upBtn?.addEventListener("click", () => { goUp(); });
    rootBtn?.addEventListener("click", () => { currentPath = ""; loadFiles(); });
  })();

  loadFiles();
}

/* ---------------- UPLOAD ---------------- */

async function upload() {
  const file = fileInput.files?.[0];
  if (!file) return alert("Select a file first");

  uploadStatus.textContent = "Uploading...";
  uploadBtn.disabled = true;
  updateProgressBar(uploadProgressWrap, uploadProgressFill, uploadProgressText, uploadProgressPercent, 0, "Preparing upload...");

  try {
    const form = new FormData();
    form.append("file", file);

    const pw = localStorage.getItem("files_password") || "";
    const data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/upload");
      xhr.setRequestHeader("X-Files-Password", pw);

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        updateProgressBar(uploadProgressWrap, uploadProgressFill, uploadProgressText, uploadProgressPercent, percent, `Uploading ${file.name}...`);
      });

      xhr.addEventListener("load", () => {
        let body = {};
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch (e) {
          body = {};
        }

        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error || "Upload failed"));
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

      xhr.send(form);
    });

    updateProgressBar(uploadProgressWrap, uploadProgressFill, uploadProgressText, uploadProgressPercent, 100, "Upload complete");
    uploadStatus.textContent = "Uploaded: " + data.fileName;
    fileInput.value = "";

    await loadFiles();
  } catch (e) {
    uploadStatus.textContent = "Error: " + e.message;
  } finally {
    uploadBtn.disabled = false;
    setTimeout(() => {
      hideProgressBar(uploadProgressWrap, uploadProgressFill, uploadProgressText, uploadProgressPercent);
    }, 400);
  }
}

/* ---------------- LOAD FILES (FIXED RACE CONDITION) ---------------- */

async function loadFiles() {
  const seq = ++loadSeq;

  filesEl.innerHTML = `<div class="empty">Loading...</div>`;

  // update path UI
  const pathNameEl = document.getElementById("pathName");
  const upBtnEl = document.getElementById("upBtn");
  if (pathNameEl) pathNameEl.textContent = currentPath || '/';
  if (upBtnEl) upBtnEl.disabled = !currentPath;

  try {
    const pw = localStorage.getItem("files_password") || "";

    const res = await fetch("/list", {
      headers: { "X-Files-Password": pw }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to load");

    if (seq !== loadSeq) return; // ignore stale response

    const files = data.files || [];
    if (!files.length) {
      filesEl.innerHTML = `<div class="empty">No files in this folder yet</div>`;
      return;
    }

    const dirs = new Set();
    const shown = [];

    for (const f of files) {
      if (!f.name.startsWith(currentPath)) continue;

      const rest = f.name.slice(currentPath.length).replace(/^\//, "");
      if (!rest) continue;

      const parts = rest.split("/");
      if (parts.length > 1) dirs.add(parts[0]);
      else shown.push(f);
    }

    filesEl.innerHTML = "";

    /* folders */
    [...dirs].sort().forEach(d => {
      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div class="meta">
          <div>
            <div class="name">${d}/</div>
            <div class="small">Folder</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn">Open</button>
        </div>
      `;

      div.querySelector("button").onclick = () => {
        currentPath += d + "/";
        loadFiles();
      };

      filesEl.appendChild(div);
    });

    /* files */
    shown.sort((a,b)=>a.name.localeCompare(b.name)).forEach(f => {
      const name = f.name.split("/").pop();

      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div class="meta">
          <div>
            <div class="name">${escapeHtml(name)}</div>
            <div class="small">${fmtSize(f.size)} • ${fmtDate(f.uploaded)}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn">Download</button>
          <button class="btn secondary">Copy link</button>
          <button class="btn secondary">Rename</button>
          <button class="btn danger-btn">Delete</button>
        </div>
      `;

      const [dl, shareBtn, renameBtn, del] = div.querySelectorAll("button");

      dl.onclick = () => downloadFile(f.fileId, f.name);

      shareBtn.onclick = () => shareFile(f.fileId, f.name);

      renameBtn.onclick = () => renameFile(f);

      del.onclick = async () => {
        if (!confirm("Delete file?")) return;

        const pw = localStorage.getItem("files_password") || "";

        await fetch("/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Files-Password": pw
          },
          body: JSON.stringify({ fileId: f.fileId, fileName: f.name })
        });

        loadFiles();
      };

      filesEl.appendChild(div);
    });

  } catch (e) {
    filesEl.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

/* ---------------- DOWNLOAD ---------------- */

async function downloadFile(fileId, name) {
  const pw = localStorage.getItem("files_password") || "";

  updateProgressBar(downloadProgressWrap, downloadProgressFill, downloadProgressText, downloadProgressPercent, 0, `Preparing ${name}...`);

  try {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `/download?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(name)}`);
      xhr.setRequestHeader("X-Files-Password", pw);
      xhr.responseType = "blob";

      xhr.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        updateProgressBar(downloadProgressWrap, downloadProgressFill, downloadProgressText, downloadProgressPercent, percent, `Downloading ${name}...`);
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response);
        else reject(new Error("Download failed"));
      });

      xhr.addEventListener("error", () => reject(new Error("Download failed")));
      xhr.addEventListener("abort", () => reject(new Error("Download cancelled")));

      xhr.send();
    });

    updateProgressBar(downloadProgressWrap, downloadProgressFill, downloadProgressText, downloadProgressPercent, 100, `Download complete`);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Download failed: " + e.message);
  } finally {
    setTimeout(() => {
      hideProgressBar(downloadProgressWrap, downloadProgressFill, downloadProgressText, downloadProgressPercent);
    }, 400);
  }
}

/* ---------------- AUTH OVERLAY ---------------- */

/* ---------------- NAV HELPERS ---------------- */

function goUp() {
  if (!currentPath) return;
  let p = currentPath.replace(/\/$/, '');
  const idx = p.lastIndexOf('/');
  if (idx === -1) currentPath = '';
  else currentPath = p.slice(0, idx + 1);
  loadFiles();
}

/* ---------------- RENAME ---------------- */

async function renameFile(file) {
  const currentName = file.name.split("/").pop();
  const nextName = prompt("Rename file", currentName);
  if (!nextName || nextName.trim() === "") return;

  const cleanName = nextName.trim();
  if (cleanName === currentName) return;

  const pw = localStorage.getItem("files_password") || "";

  try {
    const res = await fetch("/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Files-Password": pw
      },
      body: JSON.stringify({
        fileId: file.fileId,
        fileName: file.name,
        newFileName: (currentPath ? currentPath : "") + cleanName
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Rename failed");

    uploadStatus.textContent = "Renamed to " + cleanName;
    await loadFiles();
  } catch (e) {
    uploadStatus.textContent = "Error: " + e.message;
  }
}

/* ---------------- SHARE ---------------- */

async function shareFile(fileId, name) {
  const pw = localStorage.getItem("files_password") || "";

  // ask for duration (seconds)
  let dur = 3600; // default 1 hour
  try {
    const val = prompt("Share duration in seconds (leave blank for 3600)", "3600");
    if (val === null) return; // cancelled
    if (val.trim() !== "") dur = Math.max(30, parseInt(val, 10) || dur);
  } catch (e) {}

  try {
    const res = await fetch("/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Files-Password": pw },
      body: JSON.stringify({ fileId, durationSeconds: dur })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Share failed");

    const url = data.url;
    if (!url) throw new Error("No URL returned");

    // copy to clipboard when possible
    try {
      await navigator.clipboard.writeText(url);
      alert("Share link copied to clipboard:\n" + url);
    } catch (e) {
      // fallback: show prompt to copy manually
      prompt("Share URL (copy manually)", url);
    }
  } catch (e) {
    alert("Share failed: " + (e.message || e));
  }
}

function showOverlay() {
  let overlay = document.getElementById("pwOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pwOverlay";
    overlay.innerHTML = `
      <div class="pw-box">
        <h3>Password</h3>
        <input id="pwInput" class="pw-input" type="password"/>
        <button id="pwBtn">Unlock</button>
        <div id="pwErr" class="pw-error">Wrong password</div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#pwBtn").onclick = async () => {
      const val = overlay.querySelector("#pwInput").value;

      const res = await fetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: val })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        localStorage.setItem("files_password", val);
        overlay.style.display = "none";
        init();
      } else {
        overlay.querySelector("#pwErr").style.display = "block";
      }
    };
  }

  overlay.style.display = "flex";
}

/* ---------------- BOOT ---------------- */

if (localStorage.getItem("files_password")) {
  init();
} else {
  showOverlay();
}

//refresh api keys AGAIN