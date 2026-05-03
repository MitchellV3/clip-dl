<div align="center">

<img src="assets/icon.png" alt="clip-dl logo" width="128" height="128" />

# clip-dl

**Browser extension for downloading video clips from YouTube and Twitch using yt-dlp and ffmpeg.**

</div>

---

clip-dl is a Chromium-based browser extension that allows you to easily download clips from YouTube and Twitch. It integrates directly into the video player UI, letting you select time ranges, choose quality formats, and download clips with a single click.

It uses native messaging to communicate with a Python host script that runs [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and [`ffmpeg`](https://ffmpeg.org/) for video downloading and processing.

## Features

- **Clip downloading** — Select start/end times or use preset durations (10s, 30s, 1m, 3m, 5m, 10m)
- **Full video downloads** — Download entire videos with a single click
- **Audio-only mode** — Extract audio as MP3
- **Quality selection** — Choose from available video formats/resolutions
- **Live progress tracking** — Watch yt-dlp/ffmpeg output in a separate console window
- **Download queue** — Queue up to 5 downloads at once
- **Smart file organization** — Organize downloads by date, source, and/or uploader
- **Custom file naming** — Configure your own filename templates
- **Disk space checks** — Automatic validation before downloads
- **Sound effects** — Optional audio feedback for actions
- **Show in folder** — Quickly locate downloaded clips
- **Download history** — View and manage past downloads in the options page
- **Browser cookie support** — Export your cookies from Chrome to download age-restricted/private videos

## Architecture

```
+------------------------------------------------------------------------+
|                            Browser Extension                           |
|  +------------------+    +------------------+    +------------------+  |    
|  | Content:         |    |Background:       |    | Options Page:    |  |   
|  | Clipper.tsx      | -> |Service           | -> | Settings/History |  |   
|  | (YouTube/Twitch UI)   |                  |    |                  |  |
|  +------------------+    +------------------+    +------------------+  |    
|                                   |                                    |
|                        @webextcore/proxyservice                        |         
+-----------------------------------|------------------------------------+
                              Native|Messaging
                                    v
+------------------------------------------------------------------------+
|                       Python Native Host                               |
|                       host/clip_downloader.py                          |
|  +------------------+    +------------------+    +------------------+  |
|  | yt-dlp           |    | ffmpeg           |    | ffprobe          |  |
|  | Download         |    | Remux/Trim       |    | Analyze          |  |
|  +------------------+    +------------------+    +------------------+  |
+------------------------------------------------------------------------+
```

**Flow:**

1. **Clipper.tsx** (content script) gathers the video URL and clip time range from the page
2. **@webext-core/proxy-service** forwards the request to the background script
3. Background script calls Chrome native messaging
4. Chrome starts **clip_downloader.py**, sends a JSON request via stdin
5. Python host runs **yt-dlp** to download, then **ffmpeg** to remux/trim
6. Result (file path) is returned via stdout

## Prerequisites

Before installing, ensure these tools are installed and available on your `PATH`:

- **Python** 3.8+
- **yt-dlp** — Video downloader
- **ffmpeg** — Multimedia processor (for remuxing clips)
- **ffprobe** — Media analyzer (bundled with ffmpeg)

Verify installation:

```powershell
python --version
yt-dlp --version
ffmpeg -version
ffprobe -version
```

## Installation

### 1. Build the extension

```powershell
# Install dependencies
pnpm install

# Build for development
pnpm run build
```

### 2. Load the extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Navigate to the `.output` directory from this project, and select the `chrome-mv3` folder

### 3. Install the native host

The native host must be registered in Windows Registry for the extension to communicate with Python.

**Find your extension ID:**

1. Go to `chrome://extensions/`
2. Find "clip-dl" in the list
3. Copy the ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

**For Chrome:**

```powershell
# Run the installer with your extension ID
.\install_native_host.ps1 -ExtensionId YOUR_EXTENSION_ID_HERE
```

**For Edge:**

```powershell
.\install_native_host.ps1 -ExtensionId YOUR_EXTENSION_ID_HERE -Edge
```

### 4. Verify installation

**Test Python tools:**

```powershell
python .\clip_downloader.py --self-test
```

Should output:

```
All required tools are available on PATH.
Default downloads directory: C:\Users\YourName\Downloads
```

## Usage

### Downloading a clip

1. Navigate to a YouTube or Twitch video
2. Click the **clip-dl button** in the video player controls
3. Choose a download option:

**Quick presets:**

- **10 seconds** | **30 seconds** | **1 minute** | **3 minutes** | **5 minutes** | **10 minutes**

    Downloads from current timestamp backward

- **Full Video**

    Downloads the entire video

**Custom selection:**

1. Click **Set Start Time** at the desired start point
2. Click **Set End Time** at the desired end point
3. Click **Download Clip**

### Options

Click the extension icon → **Options** to configure:

- **Download folder** — Choose where clips are saved
- **File format** — MKV or MP4
- **File naming template** — Customize the filename patterns
- **Organization** — Organize by date/source/uploader or any combination of the three
- **Live process log** — Show/hide the progress console window
- **Sound effects** — Enable/disable audio feedback
- **Show screenshot button** — Toggle the screenshot capture feature in the clipper UI
- **Download history** — View and manage past downloads
- **Cookie support** — Export cookies from Chrome for age-restricted/private videos

## Supported Platforms

- **Browsers:** Chrome, Edge
- **OS:** Windows (native host registration is Windows-specific)
- **Sites:** YouTube, Twitch

## File Structure

```
clip-dl/
├── entrypoints/
│   ├── content/
│   │   ├── Clipper.tsx          # Clipper UI and logic
│   │   ├── index.tsx            # Content script entry
│   │   └── Screenshot.tsx       # Screenshot utility
│   ├── background/
│   │   └── index.ts             # Background service worker
│   └── options/
│       ├── main.tsx             # Options page renderer
│       ├── App.tsx              # Options page UI
│       ├── index.tsx            # Options page entry
│       └── download-history-list.tsx
├── host/
│   ├── clip_downloader.py       # Native host script
│   ├── install_native_host.ps1  # Windows registry installer
│   └── README.md                # Host documentation
├── lib/
│   ├── repos/                   # Data repositories
│   └── services/                # Services (proxy, sounds)
├── components/
│   └── ui/                      # Reusable UI components
├── assets/
│   └── icon.png                 # Extension icon
├── package.json
├── wxt.config.ts                # WXT configuration
└── README.md                    # This file
```

## Development

```powershell
# Start development server with hot reload
pnpm run dev

# Build for production
pnpm run build

# Type checking
pnpm run compile

# Create zip package
pnpm run zip
```

## Troubleshooting

### Extension doesn't appear on video pages

- Ensure you're on a supported site (YouTube/Twitch)
- Check that the extension is enabled in `chrome://extensions/`
- Verify the extension ID matches the one used for native host registration

### Native host not responding

- Verify Python and tools are on PATH: `python .\clip_downloader.py --self-test`
- Check the host is registered: `reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.clip_dl.clip_downloader"`
- Review logs in `host/logs/host.log`
- Restart Chrome after making registry changes

## Technical Details

### Download Process

1. **yt-dlp** downloads the video section using `--download-sections`
2. A temporary file is created with `.clip-dl-temp.` suffix
3. **ffmpeg** remuxes the temp file to fix timestamps/keyframes
4. The temp file is deleted, leaving the final clip
5. Metadata (title, uploader, thumbnail) is embedded

### Supported Downloaders

The host supports multiple download backends:

- `native` (default) — yt-dlp built-in downloader
- `aria2c`, `axel`, `curl`, `wget`, `httpie`, `ffmpeg`

Alternate downloaders need to be installed separately and added to PATH.

### File Naming Templates

Uses yt-dlp's output template syntax. Common tokens:

- `%(title)s` — Video title
- `%(id)s` — Video ID
- `%(upload_date>%Y-%m-%d)s` — Upload date
- `%(ext)s` — File extension

Example: `%(upload_date>%Y-%m-%d)s - %(title)s.%(ext)s`

## License

This project is for personal/educational use. Ensure you comply with:

- YouTube/Twitch Terms of Service
- Copyright laws in your jurisdiction
- yt-dlp license terms

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Excellent video downloader
- [ffmpeg](https://ffmpeg.org/) — Multimedia framework
- [WXT](https://wxt.dev/) — Web extension framework
- [@webext-core/proxy-service](https://github.com/aklinker1/webext-core) — Native messaging proxy
- [Chakra UI](https://chakra-ui.com/) — UI component library
- [React](https://react.dev/) — UI library
