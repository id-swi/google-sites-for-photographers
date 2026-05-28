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
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Embed the Web app URL into Google Sites.
 *******************************************************/

const CONFIG = {
  // Optional fallback folder ID. If empty, the ?folder= URL parameter is required.
  FOLDER_ID: "",

  // Dynamic mode: list every folder ID you want to serve galleries for.
  // Only these folders will be accepted via ?folder=X&sig=Y URLs.
  // Run generateGalleryLinks() from the script editor to get signed URLs.
  ALLOWED_FOLDERS: [
    // "folder-id-1",
    // "folder-id-2",
  ],

  // Text shown in the clean top toolbar.
  GALLERY_TITLE: "Client Gallery",
  GALLERY_SUBTITLE: "Select images to download originals",

  // Set to true if you want to include images from subfolders too.
  INCLUDE_SUBFOLDERS: false,

  // Thumbnail size used for the gallery preview.
  // Good values: w600, w800, w1000, w1200, w1600.
  // w1200 gives sharp thumbnails on all screens.
  THUMBNAIL_SIZE: "w1200",

  // Sorting: "name", "newest", or "oldest".
  SORT_BY: "name",

  // UI options.
  SHOW_OPEN_BUTTON: false,
  SHOW_SINGLE_DOWNLOAD_BUTTON: true,
  SHOW_SELECT_ALL_BUTTON: true,

  // Custom HTML injected above the gallery grid (below the toolbar).
  // Use for banners, announcements, instructions, etc.
  CUSTOM_HTML_TOP: "",
};

function doGet(e) {
  var folderId;

  if (CONFIG.FOLDER_ID) {
    // Hardcoded folder — ignore URL parameter to prevent IDOR.
    folderId = CONFIG.FOLDER_ID;
  } else {
    // Dynamic mode — require a signed URL (?folder=X&sig=Y).
    var paramFolder = e && e.parameter && e.parameter.folder;
    var paramSig = e && e.parameter && e.parameter.sig;

    if (!paramFolder) {
      return HtmlService.createHtmlOutput(
        "<p style='font-family:sans-serif;padding:24px'>" +
          "No folder specified.</p>",
      ).setTitle("Gallery");
    }

    // Verify folder is in the allowlist.
    if (CONFIG.ALLOWED_FOLDERS.length > 0) {
      if (CONFIG.ALLOWED_FOLDERS.indexOf(paramFolder) === -1) {
        return HtmlService.createHtmlOutput(
          "<p style='font-family:sans-serif;padding:24px'>" +
            "Access denied.</p>",
        ).setTitle("Gallery");
      }
      // Allowlist is the security boundary — no signature needed.
    } else {
      // No allowlist — require a signed URL (?folder=X&sig=Y).
      if (
        !paramSig ||
        !constantTimeEqual_(signFolderId_(paramFolder), paramSig)
      ) {
        return HtmlService.createHtmlOutput(
          "<p style='font-family:sans-serif;padding:24px'>" +
            "Invalid or missing gallery signature.</p>",
        ).setTitle("Gallery");
      }
    }

    folderId = paramFolder;
  }

  const html = buildGalleryHtml_(
    getPhotosFromDriveFolder_(folderId),
    folderId,
    signFolderId_(folderId),
  );

  return HtmlService.createHtmlOutput(html)
    .setTitle(CONFIG.GALLERY_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Run this from the script editor to generate signed URLs for all ALLOWED_FOLDERS.
 * Safe to be client-visible — it takes no parameters and only uses the allowlist.
 */
function generateGalleryLinks() {
  var folders = CONFIG.ALLOWED_FOLDERS;
  if (!folders || folders.length === 0) {
    Logger.log(
      "No folders in CONFIG.ALLOWED_FOLDERS. Add folder IDs there first.",
    );
    return;
  }
  var deployUrl = ScriptApp.getService().getUrl();
  Logger.log("=== Signed Gallery URLs ===");
  for (var i = 0; i < folders.length; i++) {
    var sig = signFolderId_(folders[i]);
    var url =
      deployUrl +
      "?folder=" +
      encodeURIComponent(folders[i]) +
      "&sig=" +
      encodeURIComponent(sig);
    Logger.log(url);
  }
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
    });
  }

  if (CONFIG.INCLUDE_SUBFOLDERS) {
    const folders = folder.getFolders();

    while (folders.hasNext()) {
      collectImagesFromFolder_(folders.next(), photos);
    }
  }
}

function getFileBase64(fileId, folderId, folderSig) {
  // Verify the folder signature to prevent IDOR — the client cannot forge a
  // signature for a folder other than the one the server rendered the gallery for.
  // Uses constant-time comparison to prevent timing attacks.
  var expected = signFolderId_(folderId);
  if (
    !folderSig ||
    expected.length !== folderSig.length ||
    !constantTimeEqual_(expected, folderSig)
  ) {
    throw new Error("Access denied.");
  }

  var galleryFolderId = folderId || CONFIG.FOLDER_ID;
  var file = DriveApp.getFileById(fileId);

  if (!isFileInGalleryFolder_(file, galleryFolderId)) {
    throw new Error("Access denied.");
  }

  // Only serve image files — prevent using the gallery as a proxy for other file types.
  if (!file.getMimeType().match(/^image\//)) {
    throw new Error("Access denied.");
  }

  return {
    data: Utilities.base64Encode(file.getBlob().getBytes()),
    name: file.getName(),
    mimeType: file.getMimeType(),
  };
}

function getFilesBatch(fileIds, folderId, folderSig) {
  var expected = signFolderId_(folderId);
  if (
    !folderSig ||
    expected.length !== folderSig.length ||
    !constantTimeEqual_(expected, folderSig)
  ) {
    throw new Error("Access denied.");
  }

  var galleryFolderId = folderId || CONFIG.FOLDER_ID;
  var results = [];

  for (var i = 0; i < fileIds.length; i++) {
    try {
      var file = DriveApp.getFileById(fileIds[i]);
      if (!isFileInGalleryFolder_(file, galleryFolderId)) continue;
      if (!file.getMimeType().match(/^image\//)) continue;
      results.push({
        data: Utilities.base64Encode(file.getBlob().getBytes()),
        name: file.getName(),
        mimeType: file.getMimeType(),
      });
    } catch (e) {
      // Skip files that fail individually
    }
  }

  return results;
}

function isFileInGalleryFolder_(file, galleryFolderId) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() === galleryFolderId) return true;
    // If subfolders are enabled, walk up the tree to check ancestry
    if (CONFIG.INCLUDE_SUBFOLDERS) {
      var ancestor = parent;
      for (var depth = 0; depth < 10; depth++) {
        var grandparents = ancestor.getParents();
        if (!grandparents.hasNext()) break;
        ancestor = grandparents.next();
        if (ancestor.getId() === galleryFolderId) return true;
      }
    }
  }
  return false;
}

// --- Folder ID signing (HMAC) ---
// Prevents IDOR: the client can only request files from the folder the server
// rendered the gallery for. The HMAC key is auto-generated on first use and
// stored in Script Properties.

function getHmacKey_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("GALLERY_HMAC_KEY");
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("GALLERY_HMAC_KEY", key);
  }
  return key;
}

function signFolderId_(folderId) {
  var sig = Utilities.computeHmacSha256Signature(folderId, getHmacKey_());
  return Utilities.base64EncodeWebSafe(sig);
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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

function buildGalleryHtml_(photos, folderId, folderSig) {
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
      width: 100%;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      scrollbar-gutter: stable;
    }

    body {
      padding: 24px 48px;
      min-height: 100%;
    }

    .shell {
      max-width: 100%;
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

    .custom-top {
      margin-bottom: 20px;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .gallery.masonry {
      grid-auto-rows: 1px;
      row-gap: 0;
    }

    .gallery.ready {
      opacity: 1;
    }

    .gallery-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      color: var(--muted);
      font-size: 13px;
      gap: 10px;
    }

    .gallery-loader.hidden {
      display: none;
    }

    .loader-dot {
      width: 6px;
      height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: pulse 1s ease-in-out infinite;
    }

    .loader-dot:nth-child(2) { animation-delay: 0.15s; }
    .loader-dot:nth-child(3) { animation-delay: 0.3s; }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1); }
    }

    .card {
      position: relative;
      overflow: hidden;
      background: var(--bg);
      transition: outline-color 120ms ease;
      outline: 2px solid transparent;
      outline-offset: -2px;
      line-height: 0;
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
    }

    .image-link {
      display: block;
      width: 100%;
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
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .gallery.masonry {
        row-gap: 0;
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
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 200;
      background: rgba(0,0,0,0.92);
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .lightbox.open {
      display: flex;
    }

    .lb-close, .lb-prev, .lb-next {
      position: absolute;
      z-index: 210;
      background: rgba(0,0,0,0.4);
      border: none;
      color: #ffffff;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease;
      border-radius: 50%;
    }

    .lb-close:hover, .lb-prev:hover, .lb-next:hover {
      background: rgba(255,255,255,0.2);
    }

    .lb-close {
      top: 16px;
      right: 16px;
      width: 48px;
      height: 48px;
    }

    .lb-prev, .lb-next {
      top: 50%;
      transform: translateY(-50%);
      width: 52px;
      height: 52px;
    }

    .lb-prev { left: 16px; }
    .lb-next { right: 16px; }

    .lb-image {
      max-width: calc(100vw - 100px);
      max-height: calc(100vh - 40px);
      object-fit: contain;
      user-select: none;
    }

    .lb-counter {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 500;
      z-index: 210;
      pointer-events: none;
      background: rgba(0,0,0,0.4);
      padding: 4px 12px;
      border-radius: 12px;
    }

    .lb-download {
      position: absolute;
      top: 16px;
      right: 72px;
      z-index: 210;
      background: rgba(0,0,0,0.4);
      border: none;
      color: #ffffff;
      cursor: pointer;
      padding: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease;
      border-radius: 50%;
    }

    .lb-download:hover {
      background: rgba(255,255,255,0.2);
    }

    @media (max-width: 620px) {
      .lb-prev, .lb-next {
        width: 40px;
        height: 40px;
      }

      .lb-prev { left: 8px; }
      .lb-next { right: 8px; }

      .lb-image {
        max-width: calc(100vw - 60px);
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

    ${CONFIG.CUSTOM_HTML_TOP ? '<div class="custom-top">' + CONFIG.CUSTOM_HTML_TOP + "</div>" : ""}

    <section class="gallery" aria-label="Photo gallery">
      ${photoCards || `<div class="empty">No image files were found in this Drive folder.</div>`}
    </section>
    <div class="gallery-loader" id="galleryLoader">
      <span class="loader-dot"></span>
      <span class="loader-dot"></span>
      <span class="loader-dot"></span>
    </div>
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
    var GALLERY_FOLDER_ID = ${JSON.stringify(folderId)};
    var GALLERY_FOLDER_SIG = ${JSON.stringify(folderSig)};

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

    function triggerBlobDownload(base64Data, filename, mimeType) {
      var raw = atob(base64Data);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      triggerDownload(new Blob([bytes], { type: mimeType || "application/octet-stream" }), filename);
    }

    function triggerDownload(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      a.style.position = "fixed";
      a.style.left = "-9999px";
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); }, 500);
      setTimeout(function() { URL.revokeObjectURL(url); }, 120000);
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
      var fileIds = selectedCards.map(function(card) { return card.getAttribute("data-id"); });

      if (fileIds.length === 1) {
        showNote("Preparing download\u2026");
        google.script.run
          .withSuccessHandler(function(result) {
            triggerBlobDownload(result.data, result.name, result.mimeType);
            showNote("Download started.");
            setDownloadState(false);
          })
          .withFailureHandler(function(err) {
            showNote("Download failed: " + (err.message || err));
            setDownloadState(false);
          })
          .getFileBase64(fileIds[0], GALLERY_FOLDER_ID, GALLERY_FOLDER_SIG);
        return;
      }

      // Multiple files: fetch in parallel, build ZIP client-side
      downloadMultipleAsZip(fileIds);
    }

    function downloadMultipleAsZip(fileIds) {
      var total = fileIds.length;
      var done = 0;
      var skipped = 0;
      var zipFiles = [];
      var startTime = Date.now();
      var BATCH_SIZE = 3;
      var CONCURRENT = 4;

      // Split file IDs into batches
      var batches = [];
      for (var i = 0; i < fileIds.length; i += BATCH_SIZE) {
        batches.push(fileIds.slice(i, i + BATCH_SIZE));
      }
      var currentBatchIdx = 0;

      function showFetchProgress() {
        var pct = Math.round(((done + skipped) / total) * 100);
        var eta = "";
        if (done + skipped > 0) {
          var elapsed = (Date.now() - startTime) / 1000;
          var perFile = elapsed / (done + skipped);
          var remaining = Math.ceil(perFile * (total - done - skipped));
          eta = remaining >= 60
            ? Math.floor(remaining / 60) + "m " + (remaining % 60) + "s remaining"
            : remaining + "s remaining";
        } else {
          eta = "calculating\u2026";
        }
        showProgress("Fetched " + (done + skipped) + " of " + total + " photos", pct, eta);
      }

      function processBatchResults(results, batchLen) {
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          var raw = atob(r.data);
          var bytes = new Uint8Array(raw.length);
          for (var j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
          var safeName = r.name.replace(/[\\\/]/g, '_').replace(/^\.+/, '');
          zipFiles.push({ name: safeName || 'photo.jpg', data: bytes });
          done++;
        }
        skipped += batchLen - results.length;
        showFetchProgress();
        if (done + skipped >= total) {
          finishZip();
        } else {
          fetchNextBatch();
        }
      }

      function fetchNextBatch() {
        if (currentBatchIdx >= batches.length) return;
        var batchIdx = currentBatchIdx++;
        var batch = batches[batchIdx];
        google.script.run
          .withSuccessHandler(function(results) {
            processBatchResults(results, batch.length);
          })
          .withFailureHandler(function(err) {
            console.error("Batch failed:", err);
            skipped += batch.length;
            showFetchProgress();
            if (done + skipped >= total) {
              finishZip();
            } else {
              fetchNextBatch();
            }
          })
          .getFilesBatch(batch, GALLERY_FOLDER_ID, GALLERY_FOLDER_SIG);
      }

      function finishZip() {
        if (zipFiles.length === 0) {
          showNote("All downloads failed.");
          setDownloadState(false);
          return;
        }
        showProgress("Building ZIP\u2026", 100, "");
        var zipBlob = _buildZip(zipFiles);
        triggerDownload(zipBlob, "gallery-photos.zip");
        var msg = "ZIP download started (" + zipFiles.length + " photos).";
        if (skipped > 0) msg += " " + skipped + " skipped due to errors.";
        showNote(msg);
        setDownloadState(false);
      }

      // Start concurrent batch fetching
      showFetchProgress();
      var initial = Math.min(CONCURRENT, batches.length);
      for (var c = 0; c < initial; c++) fetchNextBatch();
    }

    // --- Minimal ZIP builder (STORE, no compression — ideal for JPEGs) ---
    // Writes into a single contiguous ArrayBuffer for maximum mobile compatibility.
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
      // Pre-encode filenames and compute CRCs
      var entries = [];
      var totalSize = 22; // EOCD record
      for (var i = 0; i < files.length; i++) {
        var nameBytes = new TextEncoder().encode(files[i].name);
        var data = files[i].data;
        var crc = _crc32(data);
        entries.push({ nameBytes: nameBytes, data: data, crc: crc, offset: 0 });
        totalSize += 30 + nameBytes.length + data.length; // local header + name + data
        totalSize += 46 + nameBytes.length;               // central directory entry + name
      }

      var buf = new ArrayBuffer(totalSize);
      var v = new DataView(buf);
      var u8 = new Uint8Array(buf);
      var p = 0;

      // Write local file headers + data
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        e.offset = p;
        v.setUint32(p, 0x04034b50, true);        // local file header signature
        v.setUint16(p + 4, 20, true);             // version needed (2.0)
        v.setUint16(p + 6, 0, true);              // general purpose bit flag
        v.setUint16(p + 8, 0, true);              // compression method (STORE)
        v.setUint16(p + 10, 0x6000, true);        // last mod file time (12:00)
        v.setUint16(p + 12, 0x5921, true);        // last mod file date (2024-09-01)
        v.setUint32(p + 14, e.crc, true);         // crc-32
        v.setUint32(p + 18, e.data.length, true); // compressed size
        v.setUint32(p + 22, e.data.length, true); // uncompressed size
        v.setUint16(p + 26, e.nameBytes.length, true); // file name length
        v.setUint16(p + 28, 0, true);             // extra field length
        p += 30;
        u8.set(e.nameBytes, p); p += e.nameBytes.length;
        u8.set(e.data, p);     p += e.data.length;
      }

      // Write central directory
      var cdStart = p;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        v.setUint32(p, 0x02014b50, true);         // central directory header signature
        v.setUint16(p + 4, 20, true);              // version made by
        v.setUint16(p + 6, 20, true);              // version needed
        v.setUint16(p + 8, 0, true);               // general purpose bit flag
        v.setUint16(p + 10, 0, true);              // compression method
        v.setUint16(p + 12, 0x6000, true);         // last mod file time
        v.setUint16(p + 14, 0x5921, true);         // last mod file date
        v.setUint32(p + 16, e.crc, true);          // crc-32
        v.setUint32(p + 20, e.data.length, true);  // compressed size
        v.setUint32(p + 24, e.data.length, true);  // uncompressed size
        v.setUint16(p + 28, e.nameBytes.length, true); // file name length
        v.setUint16(p + 30, 0, true);              // extra field length
        v.setUint16(p + 32, 0, true);              // file comment length
        v.setUint16(p + 34, 0, true);              // disk number start
        v.setUint16(p + 36, 0, true);              // internal file attributes
        v.setUint32(p + 38, 0, true);              // external file attributes
        v.setUint32(p + 42, e.offset, true);       // relative offset of local header
        p += 46;
        u8.set(e.nameBytes, p); p += e.nameBytes.length;
      }
      var cdSize = p - cdStart;

      // Write end of central directory record
      v.setUint32(p, 0x06054b50, true);            // EOCD signature
      v.setUint16(p + 4, 0, true);                 // disk number
      v.setUint16(p + 6, 0, true);                 // disk with central directory
      v.setUint16(p + 8, entries.length, true);     // entries on this disk
      v.setUint16(p + 10, entries.length, true);    // total entries
      v.setUint32(p + 12, cdSize, true);            // size of central directory
      v.setUint32(p + 16, cdStart, true);           // offset of central directory
      v.setUint16(p + 20, 0, true);                 // comment length

      return new Blob([buf], { type: "application/zip" });
    }

    function downloadSingle(event, fileId) {
      event.preventDefault();
      event.stopPropagation();
      showNote("Preparing download\u2026");
      google.script.run
        .withSuccessHandler(function(result) {
          triggerBlobDownload(result.data, result.name, result.mimeType);
          showNote("Download started.");
        })
        .withFailureHandler(function(err) {
          showNote("Download failed: " + (err.message || err));
        })
        .getFileBase64(fileId, GALLERY_FOLDER_ID, GALLERY_FOLDER_SIG);
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
      return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w1600";
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

    var _lbSavedScrollY = 0;

    function showLightboxAt(index) {
      var cards = document.querySelectorAll(".card");
      if (index < 0 || index >= cards.length) return;
      lbCurrentIndex = index;
      _lbSavedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var card = cards[index];
      var fileId = card.getAttribute("data-id");
      var img = document.getElementById("lbImage");
      img.src = _lbThumbUrl(fileId);
      img.alt = card.getAttribute("data-name") || "";
      document.getElementById("lbCounter").textContent = (index + 1) + " / " + cards.length;
      // Lock body in place to prevent scroll jump
      document.body.style.position = "fixed";
      document.body.style.top = "-" + _lbSavedScrollY + "px";
      document.body.style.width = "100%";
      document.getElementById("lightbox").classList.add("open");
      _preloadLightbox(cards, index);
    }

    function closeLightbox() {
      document.getElementById("lightbox").classList.remove("open");
      // Unlock body and restore scroll position
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, _lbSavedScrollY);
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
      var fileId = card.getAttribute("data-id");
      showNote("Preparing download\u2026");
      google.script.run
        .withSuccessHandler(function(result) {
          triggerBlobDownload(result.data, result.name, result.mimeType);
          showNote("Download started.");
        })
        .withFailureHandler(function(err) {
          showNote("Download failed: " + (err.message || err));
        })
        .getFileBase64(fileId, GALLERY_FOLDER_ID, GALLERY_FOLDER_SIG);
    }

    document.addEventListener("keydown", function(e) {
      var lb = document.getElementById("lightbox");
      if (!lb || !lb.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navigateLightbox(-1);
      else if (e.key === "ArrowRight") navigateLightbox(1);
    });

    updateSelection();

    // --- Masonry layout ---
    var _masonryGap = 16;

    function applyMasonry() {
      var gallery = document.querySelector(".gallery");
      if (!gallery) return;
      var cards = gallery.querySelectorAll(".card");
      var gap = window.innerWidth <= 620 ? 8 : _masonryGap;

      cards.forEach(function(card) {
        card.style.gridRowEnd = "";
      });
      gallery.classList.remove("masonry");

      var colWidth = cards.length > 0 ? cards[0].getBoundingClientRect().width : 0;

      cards.forEach(function(card) {
        var img = card.querySelector("img");
        var h;
        if (img && img.naturalWidth && img.naturalHeight) {
          h = Math.round(colWidth * img.naturalHeight / img.naturalWidth);
        } else {
          h = Math.round(card.getBoundingClientRect().height);
        }
        card.style.gridRowEnd = "span " + (h + gap);
      });
      gallery.classList.add("masonry");
    }

    var _loadedCount = 0;
    var _totalImages = document.querySelectorAll(".card img").length;

    function onGalleryImageLoad() {
      _loadedCount++;
      if (_loadedCount >= _totalImages) {
        applyMasonry();
        document.querySelector(".gallery").classList.add("ready");
        var loader = document.getElementById("galleryLoader");
        if (loader) loader.classList.add("hidden");
      }
    }

    if (_totalImages === 0) {
      document.querySelector(".gallery").classList.add("ready");
      var loader = document.getElementById("galleryLoader");
      if (loader) loader.classList.add("hidden");
    }

    document.querySelectorAll(".card img").forEach(function(img) {
      if (img.complete && img.naturalWidth) {
        onGalleryImageLoad();
      } else {
        img.addEventListener("load", onGalleryImageLoad);
        img.addEventListener("error", onGalleryImageLoad);
      }
    });

    var _resizeTimer;
    window.addEventListener("resize", function() {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(applyMasonry, 150);
    });
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
    <article class="card" data-id="${escapeHtml_(photo.id)}" data-name="${escapeHtml_(photo.name)}">
      <div class="media">
        <a class="image-link" href="#" onclick="openLightbox(this); return false;" aria-label="Preview image">
          <img src="${escapeHtml_(photo.previewUrl)}" alt="${escapeHtml_(photo.name)}">
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
