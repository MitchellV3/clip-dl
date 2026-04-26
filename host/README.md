# Native messaging host

This folder contains the Windows native messaging host that runs `yt-dlp` and `ffmpeg` on behalf of the extension.

## Why this exists

Chrome content scripts cannot call `browser.runtime.sendNativeMessage()` directly. The flow is:

1. `entrypoints/content/Clipper.tsx` gathers the YouTube URL and the clip time range.
2. `@webext-core/proxy-service` forwards that request to the background script.
3. The background script calls Chrome native messaging.
4. Chrome starts `clip_downloader.py`, sends one JSON request over stdin, and waits for one JSON response on stdout.
5. The Python host runs `yt-dlp`/`ffmpeg`, then returns the saved file path.

## Files

- `clip_downloader.py` — validates the request, checks PATH tools, builds the `yt-dlp` command, and returns one final result.
- `run_clip_downloader.cmd` — small launcher referenced by the generated native host manifest.
- `install_native_host.ps1` — generates the manifest for the current extension ID and registers it in the Windows registry.

## Prerequisites

These tools must already be installed and available on PATH:

- `python`
- `yt-dlp`
- `ffmpeg`
- `ffprobe`

Quick validation:

```powershell
python --version
yt-dlp --version
ffmpeg -version
ffprobe -version
```

## Install

1. Build/load the extension and copy the extension ID from `chrome://extensions`.
2. Run the installer from this folder:

```powershell
.\install_native_host.ps1 -ExtensionId YOUR_EXTENSION_ID
```

For Edge registration too:

```powershell
.\install_native_host.ps1 -ExtensionId YOUR_EXTENSION_ID -Edge
```

The installer writes a generated manifest to `host/.generated/` and registers the new host name `com.clip_dl.clip_downloader`.

## Smoke test

Tool-only smoke test:

```powershell
python .\clip_downloader.py --self-test
```

End-to-end smoke test:

1. Restart Chrome after registration.
2. Open a YouTube video.
3. Seek to a known timestamp, for example 1:20.
4. Click `30 seconds` in the clipper UI.
5. Confirm a loading toast appears immediately, then a success or error toast appears when the host exits.
6. Verify the clip lands in the user Downloads folder.

## Notes

- The host writes all protocol/debug logs to `stderr`. Chrome native messaging ignores `stderr` for payloads, which keeps JSON responses on `stdout` clean.
- `yt-dlp` section downloads rely on `ffmpeg`, which is why the host validates those tools before attempting the download.
- The installer also removes the old click-logger host registrations so Chrome does not keep pointing at the prototype host.
