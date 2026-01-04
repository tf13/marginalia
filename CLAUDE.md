# Marginalia

Persistent zero-data web annotation tool.

## Overview

Marginalia allows users to highlight and annotate text on any web page using browser bookmarklets. Annotations can be stored in localStorage (default) or synced via remoteStorage.

## Project Structure

```
marginalia/
├── app.py                  # Flask server
├── storage.js              # Storage abstraction (reference implementation)
├── setAnnotation.js        # Bookmarklet: create highlight/annotation
├── loadAnnotations.js      # Bookmarklet: restore saved annotations
├── templates/
│   ├── index.html          # Main web interface with storage toggle
│   └── stylesheet.css      # Styles
├── package.json            # Node dependencies (remotestorage)
└── .venv/                  # Python virtual environment
```

## Tech Stack

- **Backend**: Python 3.11, Flask
- **Frontend**: Vanilla JavaScript bookmarklets
- **Storage**: localStorage (default) or remoteStorage (optional sync)
- **Dependencies**: remotestoragejs, remotestorage-widget (loaded via CDN)

## Storage Backends

### localStorage (default)
- No setup required
- Data stays in browser
- No sync between devices
- Annotations stored under key `marginalia_annotations` (organized by URL)
- Legacy key `r` maintained for backwards compatibility

### remoteStorage
- Requires a remoteStorage provider account (e.g., 5apps.com)
- Syncs annotations across devices
- Library injected via CDN when needed
- Data stored under `/marginalia/annotations/` path

## User Flow

1. First bookmarklet run prompts: "1 = localStorage, 2 = remoteStorage"
2. User can choose to remember preference
3. If remoteStorage: prompts for address (e.g., `user@5apps.com`)
4. Preference stored in `marginalia_storage` localStorage key
5. Enter `c` in prompt to clear/change saved preference

## Key Components

### setAnnotation.js
- Captures text selection and range data
- Prompts for annotation text and highlight color
- Saves to chosen storage backend
- Applies visual highlight to page

### loadAnnotations.js
- Loads annotations for current URL from chosen backend
- Recreates highlights by matching DOM elements
- Reports success/failure count

### templates/index.html
- Storage toggle UI (localStorage vs remoteStorage)
- remoteStorage connection widget
- Bookmarklet links and usage instructions

### storage.js
Reference implementation of storage abstraction. The bookmarklets include this logic inline.

## Storage Format

Annotations organized by URL:
```json
{
  "https://example.com/page": [
    {
      "startNode": "text content",
      "startOffset": 0,
      "startIsText": true,
      "startTagName": "P",
      "startHTML": "...",
      "endNode": "text content",
      "endOffset": 10,
      "endIsText": true,
      "endTagName": "P",
      "endHTML": "...",
      "hcolor": "yellow",
      "annotation": "note",
      "created": "2024-01-01T00:00:00.000Z",
      "lsid": "hl1234567890"
    }
  ]
}
```

## Development

```bash
# Python setup
source .venv/bin/activate
python app.py

# Server runs on port 80 (or PORT env var)
```
