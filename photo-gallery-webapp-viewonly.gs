/*******************************************************
 * Google Drive Photo Gallery Web App — VIEW ONLY
 *
 * What it does:
 * - Reads every image from one Google Drive folder.
 * - Builds a clean portfolio-style gallery automatically.
 * - Hides filenames visually for a premium look.
 * - Click any photo for a full-size lightbox preview.
 * - No selection, no downloads — view only.
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

  // Text shown in the clean top toolbar.
  GALLERY_TITLE: "Gallery",
  GALLERY_SUBTITLE: "Browse photos",

  // Set to true if you want to include images from subfolders too.
  INCLUDE_SUBFOLDERS: false,

  // Thumbnail size used for the gallery preview.
  // Good values: w600, w800, w1000, w1200, w1600.
  // w1200 gives sharp thumbnails on all screens.
  THUMBNAIL_SIZE: "w1200",

  // Sorting: "name", "newest", or "oldest".
  SORT_BY: "name",
};

function doGet(e) {
  const folderId = (e && e.parameter && e.parameter.folder) || CONFIG.FOLDER_ID;

  if (!folderId) {
    return HtmlService.createHtmlOutput(
      "<p style='font-family:sans-serif;padding:24px'>" +
        "No folder specified. Add <code>?folder=YOUR_FOLDER_ID</code> to the URL.</p>",
    ).setTitle("Gallery");
  }

  const html = buildGalleryHtml_(getPhotosFromDriveFolder_(folderId));

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
      width: 100%;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
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

    .photo-count {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
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
      cursor: pointer;
      transition: outline-color 120ms ease;
      outline: 2px solid transparent;
      outline-offset: -2px;
    }

    .card:hover {
      outline-color: rgba(0,0,0,0.12);
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

    @media (max-width: 920px) {
      .topbar {
        flex-direction: column;
        align-items: stretch;
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
    <header class="topbar" aria-label="Gallery header">
      <div class="topbar-left">
        <div class="title-stack">
          <div class="gallery-title">${escapeHtml_(CONFIG.GALLERY_TITLE)}</div>
          <div class="gallery-subtitle">${escapeHtml_(CONFIG.GALLERY_SUBTITLE)}</div>
        </div>
      </div>
      <div class="photo-count">${photos.length} photo${photos.length !== 1 ? "s" : ""}</div>
    </header>

    <section class="gallery" aria-label="Photo gallery">
      ${photoCards || `<div class="empty">No image files were found in this Drive folder.</div>`}
    </section>
  </main>

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
  </div>

  <script>
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

    document.addEventListener("keydown", function(e) {
      var lb = document.getElementById("lightbox");
      if (!lb || !lb.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navigateLightbox(-1);
      else if (e.key === "ArrowRight") navigateLightbox(1);
    });
  </script>
</body>
</html>
`;
}

function buildPhotoCard_(photo) {
  return `
    <article class="card" data-id="${escapeHtml_(photo.id)}" data-name="${escapeHtml_(photo.name)}">
      <div class="media">
        <a class="image-link" href="#" onclick="openLightbox(this); return false;" aria-label="Preview image">
          <img src="${escapeHtml_(photo.previewUrl)}" alt="${escapeHtml_(photo.name)}" loading="lazy">
        </a>
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
