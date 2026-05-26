# Photo Gallery Web App — Setup Instructions

## Quick Start

1. Deploy the script once.
2. For each client, use the same URL with a different `?folder=` parameter.
3. Embed that URL in their Google Site.

---

## Step 1: Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com).
2. Click **New project**.
3. Rename it (e.g. "Photo Gallery").
4. Delete the default code in `Code.gs`.
5. Paste the entire contents of `photo-gallery-webapp-code.gs`.
6. Save (Ctrl+S).

---

## Step 2: Deploy

1. Click **Deploy → New deployment**.
2. Click the gear icon → **Web app**.
3. Set:
   - **Execute as:** User accessing the web app
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Copy the **Web app URL**. It looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> You only deploy once. The same URL works for all clients.

---

## Step 3: Get a Folder ID

For each client gallery, you need a Google Drive folder ID.

1. Open the Drive folder containing the client's images.
2. Copy the ID from the URL:
   ```
   https://drive.google.com/drive/folders/1ABCxyz123FolderID
                                           └── this part
   ```

---

## Step 4: Build the Gallery URL

Append `?folder=` to your web app URL:

```
https://script.google.com/macros/s/AKfycb.../exec?folder=1ABCxyz123FolderID
```

Test it by opening this URL in your browser. You should see the gallery.

---

## Step 5: Embed in Google Sites

1. Open your Google Site in edit mode.
2. **Insert → Embed → By URL**.
3. Paste the full URL (with `?folder=...`).
4. Resize the embed frame to fill the page.
5. Publish the site.

---

## Using One App for Multiple Clients

Each client gets their own:
- Google Drive folder (with their photos)
- Google Site (or page within a site)
- Embed URL with their folder ID

| Client  | Folder ID | Embed URL                 |
| ------- | --------- | ------------------------- |
| Alice   | `1AAA...` | `.../exec?folder=1AAA...` |
| Bob     | `1BBB...` | `.../exec?folder=1BBB...` |
| Charlie | `1CCC...` | `.../exec?folder=1CCC...` |

None of your personal data is in the app. Each client only sees photos from their own folder.

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

These are at the top of the script. Adjust to taste:

| Setting                       | Default              | Description                                  |
| ----------------------------- | -------------------- | -------------------------------------------- |
| `FOLDER_ID`                   | `""`                 | Fallback folder if no `?folder=` param       |
| `GALLERY_TITLE`               | `"Client Gallery"`   | Title in the toolbar                         |
| `GALLERY_SUBTITLE`            | `"Select images..."` | Subtitle text                                |
| `INCLUDE_SUBFOLDERS`          | `false`              | Also scan subfolders for images              |
| `THUMBNAIL_SIZE`              | `"w1600"`            | Preview quality (`w1000`–`w2000`)            |
| `SORT_BY`                     | `"name"`             | Sort order: `"name"`, `"newest"`, `"oldest"` |
| `SHOW_OPEN_BUTTON`            | `false`              | Show "Open in Drive" button on hover         |
| `SHOW_SINGLE_DOWNLOAD_BUTTON` | `true`               | Show download button on each photo           |
| `SHOW_SELECT_ALL_BUTTON`      | `true`               | Show "Select all" in toolbar                 |

---

## Features

- **Lightbox preview** — click any photo for a large view with arrow navigation
- **Keyboard shortcuts** — Left/Right arrows to navigate, Escape to close
- **Single download** — download icon in lightbox, or hover button on each card
- **Bulk download** — select multiple → downloads as a ZIP file
- **Preloading** — adjacent images load in background for fast navigation
- **Responsive** — works on desktop, tablet, and mobile

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
