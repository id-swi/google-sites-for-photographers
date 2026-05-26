# Google Sites + Google Drive Photo Gallery Guide

## Overview

A photography gallery built entirely on free Google infrastructure:

- **Google Drive** stores the original images
- **Google Apps Script** reads the folder and generates a premium gallery
- **Google Sites** hosts the page and embeds the gallery

When you add images to the Drive folder, the gallery updates automatically. No manual HTML editing needed.

Gallery features: no visible filenames, checkbox selectors on each image, sticky toolbar, hover download controls, bulk ZIP download, lightbox preview with navigation, responsive layout.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Google Site (client-facing page)                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  <iframe> embed                                               │  │
│  │  URL: .../exec?folder=FOLDER_ID                               │  │
│  └──────────────────────┬────────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ loads
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Google Apps Script (Web App)                                       │
│                                                                     │
│  Server side (Apps Script runtime)                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  doGet(e)          → reads ?folder= parameter               │    │
│  │  getPhotosFromDriveFolder_() → lists images via DriveApp    │    │
│  │  getDriveToken()   → returns OAuth token for direct API     │    │
│  │  getFileBase64()   → fallback download with IDOR check      │    │
│  └──────────┬──────────────────────────────────────────────────┘    │
│             │ generates                                             │
│             ▼                                                       │
│  Client side (browser JS inside HtmlService)                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Gallery grid       → masonry layout, lazy-loaded thumbnails│    │
│  │  Selection UI       → checkboxes, select all, count badge   │    │
│  │  Lightbox           → large preview, arrow nav, preloading  │    │
│  │  Download engine    → single: direct URL                    │    │
│  │                     → bulk: Drive API + client-side ZIP     │    │
│  └──────────┬──────────────────────────┬───────────────────────┘    │
└─────────────┼──────────────────────────┼────────────────────────────┘
              │                          │
              │ thumbnails               │ downloads
              ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  Drive Thumbnail API     │  │  Drive REST API v3               │
│                          │  │                                  │
│  /thumbnail?id=X&sz=w800 │  │  Single file:                   │
│  (gallery previews)      │  │    /uc?export=download&id=X     │
│                          │  │                                  │
│  /thumbnail?id=X&sz=w1600│  │  Bulk ZIP:                      │
│  (lightbox previews)     │  │    /drive/v3/files/X?alt=media  │
│                          │  │    + Bearer token               │
└──────────────────────────┘  │    → parallel fetch             │
                              │    → client-side ZIP builder    │
                              └──────────────────────────────────┘

Data flow:
  Viewer opens Site → iframe loads Apps Script → server reads Drive folder
  → sends HTML with thumbnail URLs → browser lazy-loads images from Drive CDN
  → user clicks photo → lightbox shows w1600 preview, preloads neighbors
  → user downloads → direct Drive URL (single) or API + ZIP (bulk)
```

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
4. Paste the contents of `photo-gallery-webapp-code.gs`.
5. Save.
6. Run once and approve the permission prompt.

The "unverified app" warning is normal for personal Apps Script projects. Click Advanced → Go to project → Allow.

### 3. Deploy

1. Click Deploy → New deployment → Web app.
2. Set "Execute as" and "Who has access" per your security option.
3. Deploy and copy the Web app URL.
4. Add `?folder=YOUR_FOLDER_ID` to the URL for each client gallery.

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

## Customization

All options are in the `CONFIG` object at the top of `photo-gallery-webapp-code.gs`.

| Setting                       | Values / Notes                                      |
| ----------------------------- | --------------------------------------------------- |
| `FOLDER_ID`                   | Fallback folder ID if no `?folder=` in URL          |
| `GALLERY_TITLE`               | Text in the toolbar                                 |
| `GALLERY_SUBTITLE`            | Secondary text in the toolbar                       |
| `INCLUDE_SUBFOLDERS`          | `false` (default) or `true`                         |
| `THUMBNAIL_SIZE`              | `"w600"`, `"w800"` (default), `"w1000"`, `"w1600"`  |
| `SORT_BY`                     | `"name"` (default), `"newest"`, `"oldest"`          |
| `SHOW_OPEN_BUTTON`            | `false` (default) or `true` — hover Open button     |
| `SHOW_SINGLE_DOWNLOAD_BUTTON` | `true` (default) or `false` — hover Download button |
| `SHOW_SELECT_ALL_BUTTON`      | `true` (default) or `false`                         |

---

## Downloads

- **Single file:** Downloads directly from Google Drive CDN.
- **Multiple files:** Fetched in parallel via the Drive REST API, packaged into a ZIP file client-side, then downloaded as `gallery-photos.zip`.
- Very large files may show a Drive confirmation page.

---

## Troubleshooting

| Problem                  | Check                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| "No folder specified"    | Add `?folder=FOLDER_ID` to the web app URL                              |
| Gallery shows no images  | Folder ID is correct; folder has image files; latest version deployed   |
| Images do not load       | Drive sharing allows the visitor to view the files                      |
| Downloads fail           | Visitor has Viewer access; downloads not disabled in Drive              |
| Old design still showing | Deploy a new version (Deploy → Manage deployments → Edit → New version) |
| Authorization warning    | Normal on first visit when script runs as the user                      |
