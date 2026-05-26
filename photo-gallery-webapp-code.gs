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
  // REQUIRED: Replace this with your Google Drive folder ID.
  FOLDER_ID: "PASTE_YOUR_DRIVE_FOLDER_ID_HERE",

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

function doGet() {
  const html = buildGalleryHtml_(getPhotosFromDriveFolder_());

  return HtmlService.createHtmlOutput(html)
    .setTitle(CONFIG.GALLERY_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPhotosFromDriveFolder_() {
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
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
        "https://drive.google.com/uc?export=download&id=" + encodedId,
    });
  }

  if (CONFIG.INCLUDE_SUBFOLDERS) {
    const folders = folder.getFolders();

    while (folders.hasNext()) {
      collectImagesFromFolder_(folders.next(), photos);
    }
  }
}

function getFileForDownload(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return {
    data: Utilities.base64Encode(blob.getBytes()),
    name: file.getName(),
    mimeType: blob.getContentType(),
  };
}

function getFilesAsZip(fileIds) {
  const blobs = fileIds.map(function (id) {
    return DriveApp.getFileById(id).getBlob();
  });
  const zip = Utilities.zip(blobs, "photos.zip");
  return {
    data: Utilities.base64Encode(zip.getBytes()),
    name: "photos.zip",
    mimeType: "application/zip",
  };
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

function buildGalleryHtml_(photos) {
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

  <div class="download-note" id="downloadNote" role="status" aria-live="polite"></div>

  <script>
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

    function triggerBlobDownload(base64Data, fileName, mimeType) {
      var byteChars = atob(base64Data);
      var byteArray = new Uint8Array(byteChars.length);
      for (var i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      var blob = new Blob([byteArray], { type: mimeType });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    function downloadSelected() {
      var selectedCards = Array.from(document.querySelectorAll(".card"))
        .filter(function(card) {
          var checkbox = card.querySelector(".photo-checkbox");
          return checkbox && checkbox.checked;
        });

      if (selectedCards.length === 0) {
        showNote("Select at least one image first.");
        return;
      }

      var fileIds = selectedCards.map(function(card) {
        return card.getAttribute("data-id");
      });

      if (fileIds.length === 1) {
        showNote("Preparing download…");
        google.script.run
          .withSuccessHandler(function(result) {
            triggerBlobDownload(result.data, result.name, result.mimeType);
            showNote("Download complete.");
          })
          .withFailureHandler(function(err) {
            showNote("Download failed: " + err.message);
          })
          .getFileForDownload(fileIds[0]);
      } else {
        showNote("Preparing ZIP with " + fileIds.length + " images…");
        google.script.run
          .withSuccessHandler(function(result) {
            triggerBlobDownload(result.data, result.name, result.mimeType);
            showNote("ZIP download complete.");
          })
          .withFailureHandler(function(err) {
            showNote("Download failed: " + err.message);
          })
          .getFilesAsZip(fileIds);
      }
    }

    function downloadSingle(event, fileId) {
      event.preventDefault();
      event.stopPropagation();
      showNote("Preparing download…");
      google.script.run
        .withSuccessHandler(function(result) {
          triggerBlobDownload(result.data, result.name, result.mimeType);
          showNote("Download complete.");
        })
        .withFailureHandler(function(err) {
          showNote("Download failed: " + err.message);
        })
        .getFileForDownload(fileId);
    }

    function showNote(message) {
      const note = document.getElementById("downloadNote");
      if (!note) return;

      note.textContent = message;
      note.classList.add("visible");

      window.clearTimeout(window.__downloadNoteTimer);
      window.__downloadNoteTimer = window.setTimeout(() => {
        note.classList.remove("visible");
      }, 4600);
    }

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
    <article class="card" data-id="${escapeHtml_(photo.id)}" data-download="${escapeHtml_(photo.downloadUrl)}">
      <div class="media">
        <a class="image-link" href="${escapeHtml_(photo.viewUrl)}" target="_blank" rel="noopener" aria-label="Open image">
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
