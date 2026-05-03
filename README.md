# kTerm

Cross-platform terminal emulator built with [Tauri v2](https://v2.tauri.app/) and [SolidJS](https://www.solidjs.com/).

## Features

- **Local PTY** — Native shell sessions with auto-detected default shell
- **SSH** — Password, key, and agent authentication with host key verification
- **Multi-tab** — Multiple tabs per project with inline rename
- **Split Panes** — Horizontal/vertical splits with draggable dividers
- **Projects** — Group related sessions into collapsible projects
- **Themes** — Tokyo Night Dark/Light with system theme detection
- **Customizable** — Font, cursor, scrollback, and keybinding settings
- **Cross-platform** — macOS (Apple Silicon + Intel), Windows, Linux

## Download

See the [latest release](https://github.com/KumaBase/kterm/releases/latest) for pre-built binaries.

| Platform | Files |
|----------|-------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.msi`, `.exe` |
| Linux | `.deb`, `.AppImage` |

### First launch (unsigned build)

This app is not code-signed. On first launch you may see a security warning:

**macOS:**
1. Open the `.dmg` and drag **kTerm** to `/Applications`
2. Open Terminal and run:
   ```bash
   xattr -cr /Applications/kTerm.app
   ```
3. Launch kTerm

**Windows:**
1. Click **More info** → **Run anyway** on the SmartScreen warning

**Linux:**
No extra steps needed.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://www.rust-lang.org/tools/install) stable
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS, xterm.js, Vite |
| Backend | Tauri v2, Tokio, Rust |
| Terminal | portable-pty (local), russh (SSH) |
| Config | TOML, serde |

## Project Structure

```
src/                  # Frontend (SolidJS)
├── components/       # UI components
│   ├── common/       #   SplitPane, Modal
│   ├── connection/   #   Quick Connect dialog
│   ├── project/      #   Project sidebar
│   ├── settings/     #   Settings views
│   └── terminal/     #   xterm.js adapter & panes
├── hooks/            # Keyboard & terminal hooks
├── ipc/              # Tauri IPC wrappers
├── stores/           # State management
├── themes/           # Terminal themes
└── types/            # TypeScript types

src-tauri/            # Backend (Rust)
└── src/
    ├── commands/     # Tauri command handlers
    ├── config/       # Configuration management
    ├── pty/          # PTY session management
    ├── session/      # Unified session registry
    └── ssh/          # SSH client implementation
```

## License

All rights reserved.
