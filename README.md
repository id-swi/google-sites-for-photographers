# Google Sites Photo Gallery

A free, open-source photo gallery web app for photographers. Built on Google Drive, Apps Script, and Google Sites — no hosting, no database, no costs.

Share client galleries by embedding a single URL into Google Sites. Each client gets their own folder, their own page, and full-resolution downloads.

Two variants are included:

- **Full gallery** (`photo-gallery-webapp-code.gs`) — select and download photos
- **View-only gallery** (`photo-gallery-webapp-viewonly.gs`) — browse and preview only, no downloads

## Features

### Both variants

- **Masonry gallery** with lazy-loaded thumbnails
- **Lightbox preview** with keyboard navigation and preloading
- **Dynamic folders** — one deployment serves unlimited clients via `?folder=` parameter
- **Responsive** — desktop, tablet, and mobile
- **No backend** — runs entirely on Google's free infrastructure

### Full gallery only

- **Single & bulk download** — one photo as direct download, multiple as a ZIP
- **Client-side ZIP builder** — no server limits, works with large files
- **Selection UI** — checkboxes, select all, count badge

## How It Works

```
Google Site → embeds Apps Script web app → reads images from Google Drive folder
```

The web app generates a gallery from any Drive folder. Thumbnails load from Drive's CDN. Downloads use either direct Drive URLs (single file) or the Drive REST API with client-side ZIP packaging (bulk).

See [google-sites-drive-photo-gallery-guide.md](google-sites-drive-photo-gallery-guide.md) for the full architecture diagram.

## Quick Start

1. Copy `photo-gallery-webapp-code.gs` (or `photo-gallery-webapp-viewonly.gs` for view-only) into a new [Apps Script](https://script.google.com) project
2. Deploy as a Web app
3. Add `?folder=YOUR_DRIVE_FOLDER_ID` to the deployment URL
4. Embed that URL in a Google Site

See [SETUP.md](SETUP.md) for detailed step-by-step instructions.

## Files

| File                                        | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| `photo-gallery-webapp-code.gs`              | Full gallery with selection and downloads               |
| `photo-gallery-webapp-viewonly.gs`          | View-only gallery — browse and lightbox, no downloads   |
| `SETUP.md`                                  | Step-by-step setup and deployment instructions          |
| `google-sites-drive-photo-gallery-guide.md` | Architecture, security options, and customization guide |

## Configuration

All options are in the `CONFIG` object at the top of the script:

Both variants share these core settings:

| Setting              | Default            | Description                            |
| -------------------- | ------------------ | -------------------------------------- |
| `GALLERY_TITLE`      | `"Client Gallery"` | Toolbar title                          |
| `THUMBNAIL_SIZE`     | `"w800"`           | Gallery preview quality                |
| `SORT_BY`            | `"name"`           | Sort: `"name"`, `"newest"`, `"oldest"` |
| `INCLUDE_SUBFOLDERS` | `false`            | Scan subfolders for images             |

The full gallery has additional settings for download buttons and selection UI (see `SETUP.md`).

See [SETUP.md](SETUP.md) for the full config reference.

## Security

- Runs as the visiting user's Google account — no shared credentials
- Each client only sees the Drive folder linked in their embed URL
- Drive permissions control file access independently
- IDOR protection on server-side file validation (full gallery)
- View-only variant exposes no download URLs or tokens

See the [security section](google-sites-drive-photo-gallery-guide.md#security-configuration) in the guide for recommended permission setups.

## License

MIT
