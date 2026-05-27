# Google Sites + Google Drive Photo Gallery Guide

## Overview

A photography gallery built entirely on free Google infrastructure:

- **Google Drive** stores the original images
- **Google Apps Script** reads the folder and generates a premium gallery
- **Google Sites** hosts the page and embeds the gallery

When you add images to the Drive folder, the gallery updates automatically. No manual HTML editing needed.

Gallery features: no visible filenames, checkbox selectors on each image, sticky toolbar, hover download controls, bulk ZIP download, lightbox preview with navigation, responsive layout.

Two variants are available:

- **Full gallery** (`photo-gallery-webapp-code.gs`) — includes all of the above
- **View-only gallery** (`photo-gallery-webapp-viewonly.gs`) — gallery grid and lightbox only, no selection or downloads

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
│  │  getFileBase64()   → server-side download with IDOR check    │    │
│  └──────────┬──────────────────────────────────────────────────┘    │
│             │ generates                                             │
│             ▼                                                       │
│  Client side (browser JS inside HtmlService)                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Gallery grid       → masonry layout, lazy-loaded thumbnails│    │
│  │  Selection UI       → checkboxes, select all, count badge   │    │
│  │  Lightbox           → large preview, arrow nav, preloading  │    │
│  │  Download engine    → server-side fetch via getFileBase64()  │    │
│  │                     → bulk: sequential fetch + client ZIP   │    │
│  └──────────┬──────────────────────────┬───────────────────────┘    │
└─────────────┼──────────────────────────┼────────────────────────────┘
              │                          │
              │ thumbnails               │ downloads (server-side)
              ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  Drive Thumbnail API     │  │  Apps Script server (DriveApp)   │
│                          │  │                                  │
│  /thumbnail?id=X&sz=w800 │  │  getFileBase64(fileId, folder)  │
│  (gallery previews)      │  │    → validates file in folder    │
│                          │  │    → returns base64 blob         │
│  /thumbnail?id=X&sz=w1600│  │    → client triggers download   │
│  (lightbox previews)     │  │                                  │
│                          │  │  Bulk: sequential server fetch   │
└──────────────────────────┘  │    → client-side ZIP builder    │
                              └──────────────────────────────────┘

Data flow:
  Viewer opens Site → iframe loads Apps Script → server reads Drive folder
  → sends HTML with thumbnail URLs → browser lazy-loads images from Drive CDN
  → user clicks photo → lightbox shows w1600 preview, preloads neighbors
  → user downloads → server fetches file → base64 to client → blob download
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

Google Sites controls who can enter. The script runs as you (the owner) so it can read your Drive folders directly — no extra sharing required, no login prompt for visitors.

```text
Google Sites:
  Share -> Restricted -> add client email(s)

Google Drive folder:
  No extra sharing needed (script reads it as you)

Apps Script deployment:
  Execute as: Me
  Who has access: Anyone
```

**How it works:** Only people you share the Site with can reach the embedded gallery. The script runs under your account and reads the Drive folder server-side. File downloads go through the server (HMAC-signed folder validation prevents access to anything outside the gallery folder). No OAuth token or credential is ever sent to the client.

**Security:** Downloads are protected by an HMAC signature — the client can only request files from the folder the server rendered the gallery for. Even if someone calls the download function directly, they cannot forge a signature for a different folder.

### Option B: Drive Link Sharing

If you enable `SHOW_OPEN_BUTTON` and want clients to open files directly in Drive, you also need to share the folder.

```text
Google Sites:
  Share -> Restricted -> add client email(s)

Google Drive folder:
  Share -> Anyone with the link -> Viewer

Apps Script deployment:
  Execute as: Me
  Who has access: Anyone
```

**When to use this:** Only needed if you want the "Open in Drive" button to work. Gallery browsing and downloads work without Drive sharing.

### Summary

| Setting                      | Option A (Site-Gated) | Option B (Drive Links) |
| ---------------------------- | --------------------- | ---------------------- |
| Google Sites access          | Restricted + emails   | Restricted + emails    |
| Drive folder access          | No sharing needed     | Anyone with link       |
| Apps Script "Execute as"     | Me                    | Me                     |
| Apps Script "Who has access" | Anyone                | Anyone                 |
| Auth prompt for visitors     | No                    | No                     |
| "Open in Drive" button works | No                    | Yes                    |
| Admin work per client        | Low                   | Low                    |

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
4. Paste the contents of `photo-gallery-webapp-code.gs` (or `photo-gallery-webapp-viewonly.gs` for the view-only variant).
5. Save.
6. Run once and approve the permission prompt.

The "unverified app" warning is normal for personal Apps Script projects. Click Advanced → Go to project → Allow.

### 3. Deploy

1. Click Deploy → New deployment → Web app.
2. Set "Execute as" to **Me** and "Who has access" to **Anyone**.
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

All options are in the `CONFIG` object at the top of each `.gs` file.

Shared settings (both variants):

| Setting              | Values / Notes                                     |
| -------------------- | -------------------------------------------------- |
| `FOLDER_ID`          | Fallback folder ID if no `?folder=` in URL         |
| `GALLERY_TITLE`      | Text in the toolbar                                |
| `GALLERY_SUBTITLE`   | Secondary text in the toolbar                      |
| `INCLUDE_SUBFOLDERS` | `false` (default) or `true`                        |
| `THUMBNAIL_SIZE`     | `"w600"`, `"w800"` (default), `"w1000"`, `"w1600"` |
| `SORT_BY`            | `"name"` (default), `"newest"`, `"oldest"`         |

Full gallery only (`photo-gallery-webapp-code.gs`):

| Setting                       | Values / Notes                                      |
| ----------------------------- | --------------------------------------------------- |
| `SHOW_OPEN_BUTTON`            | `false` (default) or `true` — hover Open button     |
| `SHOW_SINGLE_DOWNLOAD_BUTTON` | `true` (default) or `false` — hover Download button |
| `SHOW_SELECT_ALL_BUTTON`      | `true` (default) or `false`                         |


---

## Downloads

- **Single file:** Fetched server-side via `getFileBase64()`, delivered as a blob download.
- **Multiple files:** Each file fetched sequentially server-side, packaged into a ZIP client-side, then downloaded as `gallery-photos.zip`.
- No OAuth token is ever sent to client-side JavaScript.
- File access is validated server-side (file must belong to the gallery folder).

---

## Troubleshooting

| Problem                  | Check                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| "No folder specified"    | Add `?folder=FOLDER_ID` to the web app URL                              |
| Gallery shows no images  | Folder ID is correct; folder has image files; latest version deployed   |
| Images do not load       | Drive sharing allows the visitor to view the files                      |
| Downloads fail           | Check the script is deployed as latest version; try redeploying         |
| Old design still showing | Deploy a new version (Deploy → Manage deployments → Edit → New version) |
