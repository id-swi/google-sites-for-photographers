# Photo Gallery Web App — Setup Instructions

This guide covers both gallery variants:

- **Full gallery** (`photo-gallery-webapp-code.gs`) — clients can select and download photos
- **View-only gallery** (`photo-gallery-webapp-viewonly.gs`) — clients can browse and preview, no downloads

The setup steps are identical. Just use the file that matches your use case.

## Quick Start

1. Deploy the script once → you get a **Web App URL**.
2. For each client, combine that URL with their Drive folder ID.
3. Embed the combined URL in their Google Site.

---

## Step 1: Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com).
2. Click **New project**.
3. Rename it (e.g. "Photo Gallery").
4. Delete the default code in `Code.gs`.
5. Paste the entire contents of `photo-gallery-webapp-code.gs` (or `photo-gallery-webapp-viewonly.gs` for view-only).
6. Save (Ctrl+S).

---

## Step 2: Deploy and Get Your Web App URL

1. Click **Deploy → New deployment**.
2. Click the gear icon → **Web app**.
3. Set:
   - **Execute as:** User accessing the web app
   - **Who has access:** Anyone
4. Click **Deploy**.
5. A dialog appears with your **Web App URL**. Copy it and save it somewhere.

Your Web App URL looks like this:

```
https://script.google.com/macros/s/AKfycbzuLD-9zLIO.../exec
```

> This URL never changes. You use it for every client.

---

## Step 3: Get a Client's Folder ID

1. Upload the client's photos to a Google Drive folder.
2. Open that folder in Drive.
3. Look at the browser address bar:

```
https://drive.google.com/drive/folders/14BjHKjxtRnbmhGh6FUra5EnhDyO0ks6G
```

4. The folder ID is the long string after `/folders/`:

```
14BjHKjxtRnbmhGh6FUra5EnhDyO0ks6G
```

---

## Step 4: Combine Into a Gallery URL

Take your Web App URL and add `?folder=` followed by the folder ID:

```
[Your Web App URL]?folder=[Folder ID]
```

**Example:**

```
https://script.google.com/macros/s/AKfycbzuLD-9zLIO.../exec?folder=14BjHKjxtRnbmhGh6FUra5EnhDyO0ks6G
```

Open this URL in your browser to test. You should see the photo gallery.

---

## Step 5: Embed in Google Sites

1. Open your Google Site in edit mode.
2. **Insert → Embed → By URL**.
3. Paste the full gallery URL from Step 4.
4. Resize the embed frame to fill the page.
5. Publish the site.

---

## Multiple Clients

You reuse the same Web App URL every time. Only the folder ID changes.

| Client  | Their Folder ID | Their Gallery URL                                   |
| ------- | --------------- | --------------------------------------------------- |
| Alice   | `1AAA...`       | `https://script.google.com/.../exec?folder=1AAA...` |
| Bob     | `1BBB...`       | `https://script.google.com/.../exec?folder=1BBB...` |
| Charlie | `1CCC...`       | `https://script.google.com/.../exec?folder=1CCC...` |

Each client only sees photos from their own folder. None of your personal data is involved.

---

## Sharing & Permissions

### Recommended Setup (simplest)

| Layer        | Setting                                |
| ------------ | -------------------------------------- |
| Drive folder | Share → Anyone with the link → Viewer  |
| Apps Script  | Execute as: User accessing the web app |
| Google Site  | Share → Restricted → add client emails |

The Site controls who can access the page. Drive is open by link so the gallery loads without issues. Each client sees only the folder you linked in their embed.

### Locked-Down Setup (maximum privacy)

| Layer        | Setting                                         |
| ------------ | ----------------------------------------------- |
| Drive folder | Share → Restricted → add client emails → Viewer |
| Apps Script  | Execute as: User accessing the web app          |
| Google Site  | Share → Restricted → add client emails          |

More admin work but each layer is individually locked.

> **Note:** With "Execute as: User accessing the web app", visitors see a one-time Google authorization prompt. This is normal.

---

## Updating the Script

After making code changes:

1. Open the Apps Script project.
2. **Deploy → Manage deployments → Edit (pencil icon)**.
3. Set Version to **New version**.
4. Click **Deploy**.

All existing embed URLs continue to work with the updated code.

---

## CONFIG Options

### Shared settings (both variants)

These are at the top of the script. Adjust to taste:

| Setting              | Default              | Description                                  |
| -------------------- | -------------------- | -------------------------------------------- |
| `FOLDER_ID`          | `""`                 | Fallback folder if no `?folder=` in the URL  |
| `GALLERY_TITLE`      | `"Client Gallery"`   | Title shown in the toolbar                   |
| `GALLERY_SUBTITLE`   | `"Select images..."` | Subtitle below the title                     |
| `INCLUDE_SUBFOLDERS` | `false`              | Also scan subfolders for images              |
| `THUMBNAIL_SIZE`     | `"w800"`             | Gallery preview quality (`w600`–`w1600`)     |
| `SORT_BY`            | `"name"`             | Sort order: `"name"`, `"newest"`, `"oldest"` |

### Full gallery only

These settings only exist in `photo-gallery-webapp-code.gs`:

| Setting                       | Default | Description                           |
| ----------------------------- | ------- | ------------------------------------- |
| `SHOW_OPEN_BUTTON`            | `false` | Show "Open in Drive" button on hover  |
| `SHOW_SINGLE_DOWNLOAD_BUTTON` | `true`  | Show download button on each photo    |
| `SHOW_SELECT_ALL_BUTTON`      | `true`  | Show "Select all" in toolbar          |
| `DOWNLOAD_DELAY_MS`           | `650`   | Delay between selected downloads (ms) |

---

## Features

### Both variants

- **Lightbox preview** — click any photo for a large view with arrow navigation
- **Keyboard shortcuts** — Left/Right arrows to navigate, Escape to close
- **Preloading** — adjacent images load in background for fast navigation
- **Responsive** — works on desktop, tablet, and mobile

### Full gallery only

- **Single download** — download icon in lightbox, or hover button on each card
- **Bulk download** — select multiple → downloads as a ZIP file

---

## Troubleshooting

| Problem                   | Fix                                                          |
| ------------------------- | ------------------------------------------------------------ |
| "No folder specified"     | Add `?folder=FOLDER_ID` to the URL                           |
| Gallery shows no images   | Check folder ID is correct and contains image files          |
| Images don't load         | Ensure Drive folder is shared (at minimum: anyone with link) |
| Downloads open blank tab  | Normal for Drive CDN; file still downloads                   |
| Authorization prompt      | Normal on first visit; click Allow                           |
| Old version still showing | Deploy a new version (see Updating section above)            |
| "Access denied" error     | Visitor doesn't have permission to the Drive folder          |
