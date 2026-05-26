# Project Instructions

## Repository Structure

This repository contains two Google Apps Script web app variants for a photo gallery:

- `photo-gallery-webapp-code.gs` — **Full gallery** with selection and download functionality
- `photo-gallery-webapp-viewonly.gs` — **View-only gallery** with browse and lightbox only (no selection, no downloads)

Documentation files:

- `README.md` — Project overview, features, quick start
- `SETUP.md` — Step-by-step deployment instructions and CONFIG reference
- `google-sites-drive-photo-gallery-guide.md` — Architecture, security, and customization guide

## Critical Rule: Keep Both Variants in Sync

When making changes to gallery functionality (layout, styling, lightbox, thumbnails, folder handling, sorting, responsive behavior, or any shared logic), **always apply the change to both `.gs` files**:

1. `photo-gallery-webapp-code.gs`
2. `photo-gallery-webapp-viewonly.gs`

The view-only variant is a subset of the full variant. It shares the same gallery grid, lightbox, CSS, and server-side folder/image logic. The only differences are:

- **No selection UI** (no checkboxes, no selection count, no select/clear buttons)
- **No download functionality** (no download buttons, no ZIP builder, no `getDriveToken()`, no `getFileBase64()`, no download progress bar)
- **No download URLs** in the photo data (no `downloadUrl` or `viewUrl` — only `previewUrl`)
- **Simpler toolbar** (title + photo count instead of selection controls)

### When editing shared code

Apply the change to both files. Shared code includes:

- CSS for gallery grid, cards, images, lightbox, responsive breakpoints
- `doGet()`, `getPhotosFromDriveFolder_()`, `collectImagesFromFolder_()`, `sortPhotos_()`
- Lightbox JS (open, close, navigate, preload, keyboard shortcuts)
- `buildGalleryHtml_()` structure (the `<html>` shell, `<head>`, base styles)
- `escapeHtml_()` utility

### When editing download/selection-only code

Only edit `photo-gallery-webapp-code.gs`. This includes:

- `getFileBase64()`, `getDriveToken()`
- Selection JS (`updateSelection`, `selectAllPhotos`, `clearSelection`)
- Download JS (`downloadSelected`, `downloadSingle`, `downloadLightboxPhoto`, ZIP builder)
- Download progress UI
- Selection-related CSS (`.select-control`, `.selection-count`, download note, etc.)

## Documentation Updates

When changing CONFIG options, features, or behavior, update **all three** documentation files:

1. `README.md` — features list, config table, files table
2. `SETUP.md` — CONFIG options tables, features list
3. `google-sites-drive-photo-gallery-guide.md` — customization table, architecture diagram (if applicable)

If a change only applies to one variant, note which variant it belongs to in the docs.
