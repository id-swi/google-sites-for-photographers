/*******************************************************
 * Google Drive Photo Gallery Web App for Google Sites
 *
 * What it does:
 * - Reads every image from one Google Drive folder.
 * - Builds a clean portfolio-style gallery automatically.
 * - Hides filenames visually for a premium look.
 * - Places a selector directly on each image.
 * - Lets users select images and download originals.
 * - Is designed to be embedded into Google Sites.
 *
 * Setup:
 * 1. Replace FOLDER_ID below with your Google Drive folder ID.
 * 2. Deploy as Web app.
 * 3. Recommended deployment:
 *    - Execute as: User accessing the web app
 *    - Who has access: Anyone
 * 4. Embed the Web app URL into Google Sites.
 *******************************************************/

const CONFIG = {
  // Optional fallback folder ID. If empty, the ?folder= URL parameter is required.
  FOLDER_ID: "",

  // Text shown in the clean top toolbar.
  GALLERY_TITLE: "Client Gallery",
  GALLERY_SUBTITLE: "Select images to download originals",

  // Set to true if you want to include images from subfolders too.
  INCLUDE_SUBFOLDERS: false,

  // Thumbnail size used for the gallery preview.
  // Good values: w1000, w1200, w1600, w2000.
  THUMBNAIL_SIZE: "w1600",

  // Sorting: "name", "newest", or "oldest".
  SORT_BY: "name",

  // UI options.
  SHOW_OPEN_BUTTON: false,
  SHOW_SINGLE_DOWNLOAD_BUTTON: true,
  SHOW_SELECT_ALL_BUTTON: true,

  // Delay between selected downloads, in milliseconds.
  // This reduces browser blocking when many files are selected.
  DOWNLOAD_DELAY_MS: 650,
};

function doGet(e) {
  const folderId = (e && e.parameter && e.parameter.folder) || CONFIG.FOLDER_ID;

  if (!folderId) {
    return HtmlService.createHtmlOutput(
      "<p style='font-family:sans-serif;padding:24px'>" +
        "No folder specified. Add <code>?folder=YOUR_FOLDER_ID</code> to the URL.</p>",
    ).setTitle("Gallery");
  }

  const html = buildGalleryHtml_(getPhotosFromDriveFolder_(folderId), folderId);

  return HtmlService.createHtmlOutput(html)
    .setTitle(CONFIG.GALLERY_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPhotosFromDriveFolder_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const photos = [];

  collectImagesFromFolder_(folder, photos);
  sortPhotos_(photos);

  return photos;
}

function collectImagesFromFolder_(folder, photos) {
  // Server-side filter: only fetch image files instead of all files.
  const files = folder.searchFiles("mimeType contains 'image/'");
  const szParam = "&sz=" + encodeURIComponent(CONFIG.THUMBNAIL_SIZE);

  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    const encodedId = encodeURIComponent(id);

    photos.push({
      id: id,
      name: file.getName(),
      mimeType: file.getMimeType(),
      updated: file.getLastUpdated().getTime(),
      viewUrl: file.getUrl(),
      previewUrl:
        "https://drive.google.com/thumbnail?id=" + encodedId + szParam,
      downloadUrl:
        "https://drive.google.com/uc?export=download&confirm=t&id=" + encodedId,
    });
  }

  if (CONFIG.INCLUDE_SUBFOLDERS) {
    const folders = folder.getFolders();

    while (folders.hasNext()) {
      collectImagesFromFolder_(folders.next(), photos);
    }
  }
}

function getFileBase64(fileId, folderId) {
  // Verify the file belongs to the specified gallery folder (prevents arbitrary file access)
  var folder = folderId || CONFIG.FOLDER_ID;
  var file = DriveApp.getFileById(fileId);
  var parents = file.getParents();
  var inGallery = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === folder) {
      inGallery = true;
      break;
    }
  }
  if (!inGallery) throw new Error("Access denied.");
  return {
    data: Utilities.base64Encode(file.getBlob().getBytes()),
    name: file.getName(),
  };
}

function getDriveToken() {
  // Returns the current user's OAuth token for direct Drive API access.
  // IMPORTANT: Only safe with "Execute as: User accessing the web app".
  // Do NOT use with "Execute as: Me" — that would expose the owner's token.
  return ScriptApp.getOAuthToken();
}

function sortPhotos_(photos) {
  const comparators = {
    newest: (a, b) => b.updated - a.updated || a.name.localeCompare(b.name),
    oldest: (a, b) => a.updated - b.updated || a.name.localeCompare(b.name),
    name: (a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  };

  photos.sort(comparators[CONFIG.SORT_BY] || comparators.name);
}

function buildGalleryHtml_(photos, folderId) {
  const photoCards = photos.map((photo) => buildPhotoCard_(photo)).join("\n");

  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #ffffff;
      --text: #111111;
      --muted: #666666;
      --line: rgba(0,0,0,0.10);
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    body {
      padding: 24px;
    }

    .shell {
      max-width: 1400px;
      margin: 0 auto;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .selection-count {
      min-width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      background: var(--text);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
    }

    .title-stack {
      min-width: 0;
    }

    .gallery-title {
      font-size: 15px;
      line-height: 1.3;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .gallery-subtitle {
      margin-top: 1px;
      font-size: 12px;
      line-height: 1.4;
      color: var(--muted);
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    button {
      appearance: none;
      border: 1px solid var(--line);
      margin: 0;
      padding: 8px 14px;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      background: var(--bg);
      color: var(--text);
      transition: background 120ms ease;
    }

    button:hover {
      background: #f5f5f5;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    /* Hide per-photo download buttons when multiple photos are selected */
    body.multi-selected .overlay-actions .btn-white[onclick^="downloadSingle"] {
      display: none;
    }

    .btn-primary {
      background: var(--text);
      color: #ffffff;
      border-color: var(--text);
    }

    .btn-primary:hover {
      background: #333333;
    }

    .btn-secondary {
      background: var(--bg);
      color: var(--text);
    }

    .gallery {
      column-count: 3;
      column-gap: 16px;
    }

    .card {
      position: relative;
      overflow: hidden;
      background: var(--bg);
      break-inside: avoid;
      margin-bottom: 16px;
      transition: outline-color 120ms ease;
      outline: 2px solid transparent;
      outline-offset: -2px;
    }

    .card:hover {
      outline-color: rgba(0,0,0,0.12);
    }

    .card.selected {
      outline: 2px solid var(--text);
      outline-offset: -2px;
    }

    .media {
      position: relative;
      width: 100%;
      overflow: hidden;
      background: #eeeeee;
    }

    .image-link {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
    }

    .card img {
      width: 100%;
      height: auto;
      display: block;
      background: #eeeeee;
    }

    .select-control {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .select-control input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .select-ui {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: transparent;
      background: rgba(255,255,255,0.85);
      border: 1px solid rgba(0,0,0,0.15);
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }

    .select-control:hover .select-ui {
      background: rgba(255,255,255,0.95);
    }

    .select-control input:checked + .select-ui {
      color: #ffffff;
      background: var(--text);
      border-color: var(--text);
    }

    .check-icon {
      width: 16px;
      height: 16px;
      display: block;
    }

    .overlay {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 12px;
      background: linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0) 50%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms ease;
    }

    .card:hover .overlay,
    .card.selected .overlay {
      opacity: 1;
    }

    .overlay-actions {
      pointer-events: auto;
    }

    .overlay-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .overlay-actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: background 120ms ease;
    }

    .btn-glass {
      color: #ffffff;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.30);
    }

    .btn-white {
      color: var(--text);
      background: #ffffff;
    }

    .empty {
      width: 100%;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border: 1px solid var(--line);
      color: var(--muted);
      text-align: center;
      font-size: 14px;
    }

    .download-note {
      position: fixed;
      left: 50%;
      bottom: 20px;
      z-index: 100;
      transform: translateX(-50%) translateY(12px);
      opacity: 0;
      pointer-events: none;
      min-width: min(480px, calc(100vw - 32px));
      padding: 12px 16px;
      background: var(--text);
      color: #ffffff;
      font-size: 13px;
      line-height: 1.4;
      text-align: center;
      transition: opacity 150ms ease, transform 150ms ease;
    }

    .download-note.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .download-progress {
      margin-top: 8px;
      height: 3px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      overflow: hidden;
      display: none;
    }

    .download-progress-fill {
      height: 100%;
      background: #ffffff;
      width: 0%;
      transition: width 300ms ease;
      border-radius: 2px;
    }

    .download-eta {
      margin-top: 4px;
      font-size: 11px;
      opacity: 0.7;
    }

    @media (max-width: 920px) {
      .topbar {
        flex-direction: column;
        align-items: stretch;
      }

      .topbar-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 620px) {
      body {
        padding: 12px;
      }

      .gallery {
        column-count: 2;
        column-gap: 10px;
      }

      .card {
        margin-bottom: 10px;
      }

      button {
        padding: 8px 12px;
        font-size: 11px;
      }

      .select-control {
        top: 6px;
        right: 6px;
      }

      .select-ui {
        width: 24px;
        height: 24px;
      }

      .overlay-actions a {
        min-height: 28px;
        padding: 6px 10px;
        font-size: 11px;
      }
    }

    /* Lightbox */
    .lightbox {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0,0,0,0.92);
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 60px;
    }

    .lightbox.open {
      display: flex;
    }

    .lb-close, .lb-prev, .lb-next {
      position: absolute;
      z-index: 210;
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 120ms ease, background 120ms ease;
      border-radius: 50%;
    }

    .lb-close:hover, .lb-prev:hover, .lb-next:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }

    .lb-close {
      top: 12px;
      right: 12px;
      width: 44px;
      height: 44px;
    }

    .lb-prev, .lb-next {
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
    }

    .lb-prev { left: 12px; }
    .lb-next { right: 12px; }

    .lb-image {
      max-width: calc(100vw - 120px);
      max-height: calc(100vh - 100px);
      object-fit: contain;
      user-select: none;
    }

    .lb-counter {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      z-index: 210;
      pointer-events: none;
    }

    .lb-download {
      position: absolute;
      top: 12px;
      right: 64px;
      z-index: 210;
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      padding: 0;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 120ms ease, background 120ms ease;
      border-radius: 50%;
    }

    .lb-download:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }

    @media (max-width: 620px) {
      .lb-prev, .lb-next {
        width: 36px;
        height: 36px;
      }

      .lb-prev { left: 6px; }
      .lb-next { right: 6px; }

      .lb-image {
        max-width: calc(100vw - 80px);
        max-height: calc(100vh - 80px);
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar" aria-label="Gallery controls">
      <div class="topbar-left">
        <div class="selection-count" id="selectedCount" aria-label="Selected image count">0</div>
        <div class="title-stack">
          <div class="gallery-title">${escapeHtml_(CONFIG.GALLERY_TITLE)}</div>
          <div class="gallery-subtitle">${escapeHtml_(CONFIG.GALLERY_SUBTITLE)}</div>
        </div>
      </div>

      <div class="topbar-actions">
        ${CONFIG.SHOW_SELECT_ALL_BUTTON ? `<button class="btn-secondary" type="button" onclick="selectAllPhotos()">Select all</button>` : ""}
        <button class="btn-secondary" type="button" onclick="clearSelection()">Clear</button>
        <button class="btn-primary" type="button" onclick="downloadSelected()">Download selected</button>
      </div>
    </header>

    <section class="gallery" aria-label="Photo gallery">
      ${photoCards || `<div class="empty">No image files were found in this Drive folder.</div>`}
    </section>
  </main>

  <div class="download-note" id="downloadNote" role="status" aria-live="polite">
    <div id="downloadNoteText"></div>
    <div class="download-progress" id="downloadProgress">
      <div class="download-progress-fill" id="downloadProgressFill"></div>
    </div>
    <div class="download-eta" id="downloadEta"></div>
  </div>

  <div class="lightbox" id="lightbox" onclick="if(event.target===this)closeLightbox()">
    <div class="lb-counter" id="lbCounter"></div>
    <button class="lb-close" onclick="closeLightbox()" aria-label="Close preview">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <button class="lb-prev" onclick="navigateLightbox(-1)" aria-label="Previous photo">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button class="lb-next" onclick="navigateLightbox(1)" aria-label="Next photo">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <img class="lb-image" id="lbImage" src="" alt="">
    <button class="lb-download" onclick="downloadLightboxPhoto()" aria-label="Download photo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
  </div>

  <script>
    var GALLERY_FOLDER_ID = "${escapeHtml_(folderId)}";

    function updateSelection() {
      const cards = document.querySelectorAll(".card");
      let selectedCount = 0;

      cards.forEach(card => {
        const checkbox = card.querySelector(".photo-checkbox");

        if (checkbox && checkbox.checked) {
          card.classList.add("selected");
          selectedCount++;
        } else {
          card.classList.remove("selected");
        }
      });

      const selectedCountEl = document.getElementById("selectedCount");
      if (selectedCountEl) {
        selectedCountEl.textContent = selectedCount;
      }

      // Toggle class to hide per-photo download buttons when multiple selected
      document.body.classList.toggle("multi-selected", selectedCount > 1);
    }

    function selectAllPhotos() {
      document.querySelectorAll(".photo-checkbox").forEach(checkbox => {
        checkbox.checked = true;
      });
      updateSelection();
    }

    function clearSelection() {
      document.querySelectorAll(".photo-checkbox").forEach(checkbox => {
        checkbox.checked = false;
      });
      updateSelection();
    }

    function triggerDirectDownload(url) {
      // Use a link click to trigger download from Google Drive CDN.
      // The Drive URL responds with Content-Disposition: attachment.
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); }, 200);
    }

    var isDownloading = false;

    function setDownloadState(active) {
      isDownloading = active;
      var btn = document.querySelector(".btn-primary");
      if (btn) {
        btn.disabled = active;
        btn.innerHTML = active
          ? '<span class="spinner"></span>Downloading\u2026'
          : 'Download selected';
      }
    }

    function downloadSelected() {
      if (isDownloading) {
        showNote("A download is already in progress.");
        return;
      }

      var selectedCards = Array.from(document.querySelectorAll(".card"))
        .filter(function(card) {
          var checkbox = card.querySelector(".photo-checkbox");
          return checkbox && checkbox.checked;
        });

      if (selectedCards.length === 0) {
        showNote("Select at least one image first.");
        return;
      }

      setDownloadState(true);

      if (selectedCards.length === 1) {
        var url = selectedCards[0].getAttribute("data-download");
        triggerDirectDownload(url);
        showDownloadStarted(url);
        setDownloadState(false);
        return;
      }

      // Multiple files: fetch directly from Drive API (bypasses google.script.run)
      var fileIds = selectedCards.map(function(card) {
        return card.getAttribute("data-id");
      });
      var fileNames = selectedCards.map(function(card) {
        return card.getAttribute("data-name");
      });
      var done = 0;
      var skipped = 0;
      var total = fileIds.length;
      var startTime = Date.now();

      function showFetchProgress() {
        var pct = Math.round((done / total) * 100);
        var eta = "";
        if (done > 0) {
          var elapsed = (Date.now() - startTime) / 1000;
          var perFile = elapsed / done;
          var remaining = Math.ceil(perFile * (total - done));
          eta = remaining >= 60
            ? Math.floor(remaining / 60) + "m " + (remaining % 60) + "s remaining"
            : remaining + "s remaining";
        } else {
          eta = "calculating…";
        }
        showProgress("Fetched " + done + " of " + total + " photos", pct, eta);
      }

      function finishZip(zipFiles) {
        if (zipFiles.length === 0) {
          showNote("All downloads failed.");
          setDownloadState(false);
          return;
        }
        showProgress("Building ZIP…", 100, "");
        var zipBlob = _buildZip(zipFiles);
        var url = URL.createObjectURL(zipBlob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "gallery-photos.zip";
        a.target = "_self";
        a.style.position = "fixed";
        a.style.left = "-9999px";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); }, 200);
        setTimeout(function() { URL.revokeObjectURL(url); }, 120000);
        var msg = "ZIP download started (" + zipFiles.length + " photos).";
        if (skipped > 0) msg += " " + skipped + " skipped due to errors.";
        showNote(msg);
        setDownloadState(false);
      }

      showFetchProgress();

      // Get auth token, then fetch all files in parallel via Drive API
      google.script.run
        .withSuccessHandler(function(token) {
          var fetches = fileIds.map(function(id, idx) {
            var url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media";
            return fetch(url, {
              headers: { "Authorization": "Bearer " + token }
            })
            .then(function(response) {
              if (!response.ok) throw new Error("HTTP " + response.status);
              return response.arrayBuffer();
            })
            .then(function(buffer) {
              done++;
              showFetchProgress();
              return { name: fileNames[idx], data: new Uint8Array(buffer) };
            })
            .catch(function(err) {
              console.error("Failed to fetch file:", err);
              skipped++;
              done++;
              showFetchProgress();
              return null;
            });
          });

          Promise.all(fetches).then(function(results) {
            finishZip(results.filter(Boolean));
          });
        })
        .withFailureHandler(function(err) {
          showNote("Failed to start download: " + (err.message || err));
          setDownloadState(false);
        })
        .getDriveToken();
    }

    // --- Minimal ZIP builder (STORE, no compression — ideal for JPEGs) ---
    var _crcTable = null;
    function _crc32(bytes) {
      if (!_crcTable) {
        _crcTable = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
          var c = n;
          for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          _crcTable[n] = c;
        }
      }
      var crc = 0xFFFFFFFF;
      for (var i = 0; i < bytes.length; i++) crc = _crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function _buildZip(files) {
      var parts = [];
      var cdParts = [];
      var offset = 0;
      for (var i = 0; i < files.length; i++) {
        var nameBytes = new TextEncoder().encode(files[i].name);
        var data = files[i].data;
        var crc = _crc32(data);
        // Local file header
        var lh = new ArrayBuffer(30);
        var lv = new DataView(lh);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(8, 0, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        parts.push(new Uint8Array(lh), nameBytes, data);
        // Central directory entry
        var ch = new ArrayBuffer(46);
        var cv = new DataView(ch);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(10, 0, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        cdParts.push(new Uint8Array(ch), nameBytes);
        offset += 30 + nameBytes.length + data.length;
      }
      var cdSize = cdParts.reduce(function(s, p) { return s + p.length; }, 0);
      var eocd = new ArrayBuffer(22);
      var ev = new DataView(eocd);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(8, files.length, true);
      ev.setUint16(10, files.length, true);
      ev.setUint32(12, cdSize, true);
      ev.setUint32(16, offset, true);
      return new Blob(parts.concat(cdParts, [new Uint8Array(eocd)]), { type: "application/zip" });
    }

    function downloadSingle(event, fileId) {
      event.preventDefault();
      event.stopPropagation();
      // Find the card and use its direct Drive download URL (no server call)
      var card = document.querySelector('.card[data-id="' + fileId + '"]');
      if (!card) return;
      var url = card.getAttribute("data-download");
      triggerDirectDownload(url);
      showNote("Download started.");
    }

    function showDownloadStarted(url) {
      var note = document.getElementById("downloadNote");
      var text = document.getElementById("downloadNoteText");
      var bar = document.getElementById("downloadProgress");
      var etaEl = document.getElementById("downloadEta");
      if (!note) return;

      text.innerHTML = "";
      text.appendChild(document.createTextNode("Download started. "));
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.color = "#ffffff";
      link.style.textDecoration = "underline";
      link.style.cursor = "pointer";
      link.textContent = "Click here if it didn\u2019t start.";
      text.appendChild(link);

      if (bar) bar.style.display = "none";
      if (etaEl) etaEl.textContent = "";
      note.classList.add("visible");

      window.clearTimeout(window.__downloadNoteTimer);
      window.__downloadNoteTimer = window.setTimeout(function() {
        note.classList.remove("visible");
      }, 10000);
    }

    function showProgress(message, percent, eta) {
      var note = document.getElementById("downloadNote");
      var text = document.getElementById("downloadNoteText");
      var bar = document.getElementById("downloadProgress");
      var fill = document.getElementById("downloadProgressFill");
      var etaEl = document.getElementById("downloadEta");
      if (!note) return;

      text.textContent = message;
      bar.style.display = "block";
      fill.style.width = percent + "%";
      etaEl.textContent = eta || "";
      note.classList.add("visible");
      window.clearTimeout(window.__downloadNoteTimer);
    }

    function showNote(message, persistent) {
      var note = document.getElementById("downloadNote");
      var text = document.getElementById("downloadNoteText");
      var bar = document.getElementById("downloadProgress");
      var etaEl = document.getElementById("downloadEta");
      if (!note) return;

      text.textContent = message;
      if (bar) bar.style.display = "none";
      if (etaEl) etaEl.textContent = "";
      note.classList.add("visible");

      window.clearTimeout(window.__downloadNoteTimer);
      if (!persistent) {
        window.__downloadNoteTimer = window.setTimeout(function() {
          note.classList.remove("visible");
        }, 4600);
      }
    }

    // --- Lightbox ---
    var lbCurrentIndex = -1;

    function openLightbox(linkEl) {
      var card = linkEl.closest(".card");
      var cards = Array.from(document.querySelectorAll(".card"));
      var index = cards.indexOf(card);
      if (index < 0) return;
      showLightboxAt(index);
    }

    function _lbThumbUrl(fileId) {
      return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w2400";
    }

    function _preloadLightbox(cards, index) {
      var indices = [index - 1, index + 1];
      for (var i = 0; i < indices.length; i++) {
        var idx = indices[i];
        if (idx < 0) idx = cards.length - 1;
        if (idx >= cards.length) idx = 0;
        if (idx === index) continue;
        var fid = cards[idx].getAttribute("data-id");
        if (fid) new Image().src = _lbThumbUrl(fid);
      }
    }

    function showLightboxAt(index) {
      var cards = document.querySelectorAll(".card");
      if (index < 0 || index >= cards.length) return;
      lbCurrentIndex = index;
      var card = cards[index];
      var fileId = card.getAttribute("data-id");
      var img = document.getElementById("lbImage");
      img.src = _lbThumbUrl(fileId);
      img.alt = card.getAttribute("data-name") || "";
      document.getElementById("lbCounter").textContent = (index + 1) + " / " + cards.length;
      document.getElementById("lightbox").classList.add("open");
      document.body.style.overflow = "hidden";
      _preloadLightbox(cards, index);
    }

    function closeLightbox() {
      document.getElementById("lightbox").classList.remove("open");
      document.body.style.overflow = "";
      lbCurrentIndex = -1;
    }

    function navigateLightbox(delta) {
      var cards = document.querySelectorAll(".card");
      var newIndex = lbCurrentIndex + delta;
      if (newIndex < 0) newIndex = cards.length - 1;
      if (newIndex >= cards.length) newIndex = 0;
      showLightboxAt(newIndex);
    }

    function downloadLightboxPhoto() {
      var cards = document.querySelectorAll(".card");
      if (lbCurrentIndex < 0 || lbCurrentIndex >= cards.length) return;
      var card = cards[lbCurrentIndex];
      var url = card.getAttribute("data-download");
      var name = card.getAttribute("data-name") || "photo";
      // Fetch as blob so the download stays in the same tab
      fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
      }).catch(function() {
        triggerDirectDownload(url);
      });
    }

    document.addEventListener("keydown", function(e) {
      var lb = document.getElementById("lightbox");
      if (!lb || !lb.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navigateLightbox(-1);
      else if (e.key === "ArrowRight") navigateLightbox(1);
    });

    updateSelection();
  </script>
</body>
</html>
`;
}

function buildPhotoCard_(photo) {
  const openButton = CONFIG.SHOW_OPEN_BUTTON
    ? `<a class="btn-glass" href="${escapeHtml_(photo.viewUrl)}" target="_blank" rel="noopener">Open</a>`
    : "";

  const downloadButton = CONFIG.SHOW_SINGLE_DOWNLOAD_BUTTON
    ? `<a class="btn-white" href="#" onclick="downloadSingle(event, '${escapeHtml_(photo.id)}')" rel="noopener">Download</a>`
    : "";

  return `
    <article class="card" data-id="${escapeHtml_(photo.id)}" data-download="${escapeHtml_(photo.downloadUrl)}" data-name="${escapeHtml_(photo.name)}">
      <div class="media">
        <a class="image-link" href="#" onclick="openLightbox(this); return false;" aria-label="Preview image">
          <img src="${escapeHtml_(photo.previewUrl)}" alt="${escapeHtml_(photo.name)}" loading="lazy">
        </a>

        <label class="select-control" aria-label="Select image">
          <input type="checkbox" class="photo-checkbox" onchange="updateSelection()">
          <span class="select-ui" aria-hidden="true">
            <svg class="check-icon" viewBox="0 0 24 24" focusable="false">
              <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
        </label>

        <div class="overlay" aria-hidden="true">
          <div class="overlay-actions">
            ${openButton}
            ${downloadButton}
          </div>
        </div>
      </div>
    </article>`;
}

const ESCAPE_MAP_ = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const ESCAPE_RE_ = /[&<>"']/g;

function escapeHtml_(value) {
  return String(value).replace(ESCAPE_RE_, (ch) => ESCAPE_MAP_[ch]);
}
