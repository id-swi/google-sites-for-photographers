# Google Sites + Google Drive Photo Gallery Guide

## Overview

A photography gallery built entirely on free Google infrastructure:

- **Google Drive** stores the original images
- **Google Apps Script** reads the folder and generates a premium gallery
- **Google Sites** hosts the page and embeds the gallery

When you add images to the Drive folder, the gallery updates automatically. No manual HTML editing needed.

Gallery features: no visible filenames, checkbox selectors on each image, sticky toolbar, hover download controls, bulk download, responsive layout.

---

## How Previews and Downloads Work

The script uses Drive's thumbnail endpoint for gallery previews and the original file for downloads. This keeps page loads fast while delivering full-quality originals.

Thumbnail size is set in the script via `THUMBNAIL_SIZE`:

| Value | Result              |
| ----- | ------------------- |
| w1200 | Faster, still good  |
| w1600 | Recommended balance |
| w2000 | Sharper, heavier    |

---

## Security Configuration

There are three independent permission layers. Restricting one does not restrict the others.

```text
1. Google Sites page        (who can open the site)
2. Google Apps Script        (who can run the web app)
3. Google Drive folder       (who can view/download files)
```

### Option A: Site-Gated Access (Recommended)

Google Sites controls who can enter. Drive is open to anyone with the link. The script runs as the visiting user, which lets you tighten Drive permissions later without redeploying.

```text
Google Sites:
  Share -> Restricted -> add client email(s)

Google Drive folder:
  Share -> Anyone with the link -> Viewer
  Downloads allowed

Apps Script deployment:
  Execute as: User accessing the web app
  Who has access: Anyone
```

**How it works:** Only people you share the Site with can reach the embedded gallery. The script runs under their Google account. Since Drive is link-shared, the gallery loads without extra permissions.

**Trade-off:** Visitors see a one-time Google authorization prompt the first time they open the gallery. This is normal for Apps Script running as the user.

**Why this is flexible:** If you later want to restrict Drive access to specific people, you can change the Drive folder to Restricted and add emails — without touching the script or redeploying.

### Option B: Email-Permission Access

Every layer is locked to specific email addresses. Most restrictive option.

```text
Google Sites:
  Share -> Restricted -> add client email(s)

Google Drive folder:
  Share -> Restricted -> add the same client email(s) -> Viewer
  Downloads allowed

Apps Script deployment:
  Execute as: User accessing the web app
  Who has access: Anyone with a Google account
```

**How it works:** The Site is restricted, the Drive folder is restricted, and the script runs as the visiting user. Each visitor must have explicit Viewer access to the Drive folder or previews and downloads will fail.

**Trade-off:** You must add each client's email to both the Site and the Drive folder. If you miss one, that client gets a broken gallery. More admin work per client, but maximum control.

**When to use this:** Private shoots, sensitive content, or when you want a full audit trail of who accessed what.

### Summary

| Setting                      | Option A (Site-Gated) | Option B (Email-Permission) |
| ---------------------------- | --------------------- | --------------------------- |
| Google Sites access          | Restricted + emails   | Restricted + emails         |
| Drive folder access          | Anyone with link      | Restricted + same emails    |
| Apps Script "Execute as"     | User accessing        | User accessing              |
| Apps Script "Who has access" | Anyone                | Anyone with Google account  |
| Auth prompt for visitors     | Yes (once)            | Yes (once)                  |
| Can tighten Drive later      | Yes, no redeploy      | Already tight               |
| Admin work per client        | Low                   | Medium                      |

---

## Setup

### 1. Drive Folder

1. Create a folder in Google Drive.
2. Add your final image files.
3. Copy the folder ID from the URL:

```text
https://drive.google.com/drive/folders/1ABCxyzFolderIdExample
                                        └── this is the folder ID
```

4. Set sharing permissions according to your chosen security option above.

### 2. Apps Script

1. Go to [script.google.com](https://script.google.com).
2. Create a new project and rename it (e.g. "Photo Gallery Web App").
3. Delete the default code.
4. Paste the full script from the next section.
5. Replace `PASTE_YOUR_DRIVE_FOLDER_ID_HERE` with your folder ID.
6. Save.
7. Run once and approve the permission prompt.

The "unverified app" warning is normal for personal Apps Script projects. Click Advanced → Go to project → Allow.

### 3. Deploy

1. Click Deploy → New deployment → Web app.
2. Set "Execute as" and "Who has access" per your security option.
3. Deploy and copy the Web app URL.

To update after code changes:

```text
Deploy -> Manage deployments -> Edit -> Version -> New version -> Deploy
```

### 4. Embed in Google Sites

1. Open your Google Site → Insert → Embed → By URL.
2. Paste the Apps Script Web app URL.
3. Resize the frame.
4. Publish the Site.
5. Share the Site with your client(s) per your security option.

---

## Full Google Apps Script

Copy this entire script into Apps Script:

```javascript
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
  DOWNLOAD_DELAY_MS: 650
};

function doGet() {
  const photos = getPhotosFromDriveFolder_();
  const html = buildGalleryHtml_(photos);

  return HtmlService
    .createHtmlOutput(html)
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
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();

    if (!mimeType || !mimeType.startsWith("image/")) {
      continue;
    }

    const id = file.getId();
    const name = file.getName();

    photos.push({
      id: id,
      name: name,
      mimeType: mimeType,
      updated: file.getLastUpdated().getTime(),
      viewUrl: file.getUrl(),
      previewUrl: "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=" + encodeURIComponent(CONFIG.THUMBNAIL_SIZE),
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(id)
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
  if (CONFIG.SORT_BY === "newest") {
    photos.sort((a, b) => b.updated - a.updated || a.name.localeCompare(b.name));
    return;
  }

  if (CONFIG.SORT_BY === "oldest") {
    photos.sort((a, b) => a.updated - b.updated || a.name.localeCompare(b.name));
    return;
  }

  photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function buildGalleryHtml_(photos) {
  const photoCards = photos.map(photo => buildPhotoCard_(photo)).join("\n");

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
      --muted: #747474;
      --line: rgba(17,17,17,0.08);
      --soft-line: rgba(255,255,255,0.38);
      --panel: rgba(255,255,255,0.86);
      --panel-strong: rgba(255,255,255,0.96);
      --shadow: 0 12px 32px rgba(0,0,0,0.08);
      --shadow-hover: 0 20px 44px rgba(0,0,0,0.14);
      --radius-lg: 22px;
      --radius-md: 16px;
      --radius-pill: 999px;
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
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      padding: 26px;
    }

    .shell {
      max-width: 1440px;
      margin: 0 auto;
    }

    .topbar {
      position: sticky;
      top: 16px;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 14px 16px;
      margin-bottom: 26px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .selection-count {
      min-width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 11px;
      border-radius: var(--radius-pill);
      background: #111111;
      color: #ffffff;
      font-size: 13px;
      font-weight: 650;
      line-height: 1;
    }

    .title-stack {
      min-width: 0;
    }

    .gallery-title {
      font-size: 17px;
      line-height: 1.2;
      font-weight: 650;
      letter-spacing: -0.025em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gallery-subtitle {
      margin-top: 2px;
      font-size: 13px;
      line-height: 1.35;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 9px;
      flex-wrap: wrap;
    }

    button {
      appearance: none;
      border: 0;
      margin: 0;
      border-radius: var(--radius-pill);
      padding: 10px 15px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    button:hover {
      transform: translateY(-1px);
    }

    button:active {
      transform: translateY(0);
    }

    .btn-primary {
      background: #111111;
      color: #ffffff;
      box-shadow: 0 10px 22px rgba(0,0,0,0.13);
    }

    .btn-primary:hover {
      box-shadow: 0 12px 26px rgba(0,0,0,0.18);
    }

    .btn-secondary {
      background: #f4f4f4;
      color: #111111;
    }

    .btn-secondary:hover {
      background: #eeeeee;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
      gap: 22px;
    }

    .card {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-lg);
      background: #f3f3f3;
      box-shadow: var(--shadow);
      transform: translateZ(0);
      transition: transform 220ms ease, box-shadow 220ms ease, outline-color 180ms ease;
      outline: 0 solid transparent;
    }

    .card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-hover);
    }

    .card.selected {
      outline: 2px solid #111111;
      outline-offset: 0;
    }

    .media {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 5;
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
      height: 100%;
      display: block;
      object-fit: cover;
      transform: scale(1.001);
      transition: transform 520ms ease, filter 220ms ease;
      background: #efefef;
    }

    .card:hover img {
      transform: scale(1.035);
      filter: saturate(1.03) contrast(1.02);
    }

    .select-control {
      position: absolute;
      top: 14px;
      right: 14px;
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
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-pill);
      color: transparent;
      background: rgba(255,255,255,0.74);
      border: 1px solid rgba(255,255,255,0.72);
      box-shadow: 0 8px 20px rgba(0,0,0,0.14);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      transition: background 180ms ease, color 180ms ease, transform 180ms ease, border-color 180ms ease;
    }

    .select-control:hover .select-ui {
      transform: scale(1.04);
      background: rgba(255,255,255,0.92);
    }

    .select-control input:checked + .select-ui {
      color: #ffffff;
      background: #111111;
      border-color: #111111;
    }

    .check-icon {
      width: 18px;
      height: 18px;
      display: block;
    }

    .overlay {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 18px;
      background: linear-gradient(to top, rgba(0,0,0,0.48), rgba(0,0,0,0.14) 42%, rgba(0,0,0,0.00) 72%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 220ms ease;
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
      gap: 10px;
      flex-wrap: wrap;
      transform: translateY(4px);
      transition: transform 220ms ease;
    }

    .card:hover .overlay-actions,
    .card.selected .overlay-actions {
      transform: translateY(0);
    }

    .overlay-actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 10px 14px;
      border-radius: var(--radius-pill);
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
      transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
    }

    .overlay-actions a:hover {
      transform: translateY(-1px);
    }

    .btn-glass {
      color: #ffffff;
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.30);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .btn-white {
      color: #111111;
      background: #ffffff;
      box-shadow: 0 10px 22px rgba(0,0,0,0.15);
    }

    .empty {
      grid-column: 1 / -1;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      border: 1px dashed var(--line);
      border-radius: var(--radius-lg);
      color: var(--muted);
      text-align: center;
      font-size: 15px;
    }

    .download-note {
      position: fixed;
      left: 50%;
      bottom: 22px;
      z-index: 100;
      transform: translateX(-50%) translateY(18px);
      opacity: 0;
      pointer-events: none;
      min-width: min(520px, calc(100vw - 36px));
      padding: 13px 16px;
      border-radius: 16px;
      background: rgba(17,17,17,0.92);
      color: #ffffff;
      box-shadow: 0 18px 44px rgba(0,0,0,0.22);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-size: 13px;
      line-height: 1.4;
      text-align: center;
      transition: opacity 220ms ease, transform 220ms ease;
    }

    .download-note.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    @media (max-width: 920px) {
      body {
        padding: 18px;
      }

      .topbar {
        align-items: stretch;
        flex-direction: column;
        top: 10px;
      }

      .topbar-actions {
        justify-content: flex-start;
      }

      .gallery-subtitle {
        white-space: normal;
      }
    }

    @media (max-width: 620px) {
      body {
        padding: 14px;
      }

      .gallery {
        grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
        gap: 14px;
      }

      .media {
        aspect-ratio: 1 / 1.18;
      }

      .topbar {
        padding: 12px;
        border-radius: 17px;
      }

      .gallery-title {
        font-size: 16px;
      }

      .gallery-subtitle {
        font-size: 12px;
      }

      button {
        padding: 10px 13px;
        font-size: 12px;
      }

      .select-control {
        top: 10px;
        right: 10px;
      }

      .select-ui {
        width: 32px;
        height: 32px;
      }

      .overlay-actions a {
        min-height: 34px;
        padding: 8px 12px;
        font-size: 12px;
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

    function downloadSelected() {
      const selectedCards = Array.from(document.querySelectorAll(".card"))
        .filter(card => {
          const checkbox = card.querySelector(".photo-checkbox");
          return checkbox && checkbox.checked;
        });

      if (selectedCards.length === 0) {
        showNote("Select at least one image first.");
        return;
      }

      showNote("Starting " + selectedCards.length + " download" + (selectedCards.length === 1 ? "" : "s") + ". If your browser asks, allow multiple downloads.");

      selectedCards.forEach((card, index) => {
        const downloadUrl = card.getAttribute("data-download");

        window.setTimeout(() => {
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.target = "_blank";
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * ${Number(CONFIG.DOWNLOAD_DELAY_MS) || 650});
      });
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
    ? `<a class="btn-white" href="${escapeHtml_(photo.downloadUrl)}" target="_blank" rel="noopener">Download</a>`
    : "";

  return `
    <article class="card" data-download="${escapeHtml_(photo.downloadUrl)}">
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

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

---

## Customization

All options are in the `CONFIG` object at the top of the script.

| Setting                       | Values / Notes                                      |
| ----------------------------- | --------------------------------------------------- |
| `GALLERY_TITLE`               | Text in the toolbar                                 |
| `GALLERY_SUBTITLE`            | Secondary text in the toolbar                       |
| `INCLUDE_SUBFOLDERS`          | `false` (default) or `true`                         |
| `THUMBNAIL_SIZE`              | `"w1200"`, `"w1600"` (default), `"w2000"`           |
| `SORT_BY`                     | `"name"` (default), `"newest"`, `"oldest"`          |
| `SHOW_OPEN_BUTTON`            | `false` (default) or `true` — hover Open button     |
| `SHOW_SINGLE_DOWNLOAD_BUTTON` | `true` (default) or `false` — hover Download button |
| `SHOW_SELECT_ALL_BUTTON`      | `true` (default) or `false`                         |
| `DOWNLOAD_DELAY_MS`           | Delay between downloads, default `650`              |

To change the image card shape, edit this CSS in the script:

```css
aspect-ratio: 4 / 5;   /* portrait, default */
aspect-ratio: 1 / 1;   /* square */
aspect-ratio: 3 / 4;   /* taller portrait */
aspect-ratio: 16 / 10; /* landscape */
```

---

## Downloads

Each selected image downloads via a direct Drive URL. Limitations:

- No automatic ZIP — each file downloads individually.
- Browsers may ask to allow multiple downloads.
- Very large files may show a Drive confirmation page.

---

## Troubleshooting

| Problem                  | Check                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| Gallery shows no images  | Folder ID is correct; folder has image files; latest version deployed   |
| Images do not load       | Drive sharing allows the visitor to view the files                      |
| Downloads fail           | Visitor has Viewer access; downloads not disabled in Drive              |
| Old design still showing | Deploy a new version (Deploy → Manage deployments → Edit → New version) |
| Authorization warning    | Normal on first visit when script runs as the user                      |
