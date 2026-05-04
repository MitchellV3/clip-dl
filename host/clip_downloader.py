from __future__ import annotations

import json
import logging
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlparse
import ctypes

LOCK_FILE_PATH = Path(tempfile.gettempdir()) / 'clip-dl-native-host.lock'
LOG_DIR = Path(__file__).resolve().parent / 'logs'
LOG_FILE_PATH = LOG_DIR / 'host.log'

def _configure_logging() -> None:
    """Configure logging with rotating file handler and console output."""
    logger = logging.getLogger('clip-dl')
    logger.setLevel(logging.DEBUG)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Create log directory
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s,%(msecs)03d - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handler with rotation (5 files, 10MB each)
    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

_configure_logging()
logger = logging.getLogger('clip-dl')


def _read_native_message() -> dict[str, Any] | None:
    # Chrome native messaging uses a 4-byte little-endian length prefix followed
    # by a UTF-8 JSON payload on stdin/stdout. The browser starts the host, sends
    # one request, waits for one response, and then tears the process down.
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None

    message_length = struct.unpack('<I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def _write_native_message(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def _error_response(code: str, message: str) -> dict[str, Any]:
    return {
        'ok': False,
        'code': code,
        'message': message,
    }

def _validate_download_request_fields(message: dict[str, Any], label_error_message: str) -> tuple[str | None, str | None, bool | None, dict[str, Any] | None, str | None]:
    url = message.get('url')
    label = message.get('label')
    audio_only = message.get('audioOnly', False)

    if not isinstance(url, str) or not url:
        return None, None, None, _error_response('bad-request', 'A non-empty video URL is required.'), None

    if not isinstance(label, str) or not label:
        return None, None, None, _error_response('bad-request', label_error_message), None

    # Validate downloader setting
    downloader = message.get('downloader', 'native')
    valid_downloaders = {'native', 'aria2c', 'axel', 'curl', 'wget', 'httpie', 'ffmpeg'}
    if downloader not in valid_downloaders:
        return None, None, None, _error_response('bad-request', f'Invalid downloader: {downloader}. Must be one of: {", ".join(sorted(valid_downloaders))}'), None

    return url, label, bool(audio_only), None, downloader


def _get_video_formats(url: str) -> list[dict[str, str]]:
    """
    Fetch and normalize video formats from yt-dlp.
    Returns a list of format objects with 'label' and 'value' keys.
    The 'value' is the exact format selector string to pass to yt-dlp.
    """
    try:
        result = subprocess.run(
            ['yt-dlp', '--dump-json', '--no-download', '--skip-download', url],
            capture_output=True,
            text=True,
            timeout=30,
            encoding='utf-8',
            errors='replace',
        )
        if result.returncode != 0:
            logger.warning(f'yt-dlp failed to fetch formats for {url}: {result.stderr}')
            return []

        if not result.stdout.strip():
            logger.warning(f'yt-dlp returned empty output for {url}')
            return []

        info = json.loads(result.stdout)
        formats = info.get('formats', [])
        
        if not formats:
            logger.warning(f'No formats found in yt-dlp output for {url}')
            return []

        # Group formats by video resolution and fps
        # Map: (height, fps) -> best format in that group
        format_groups: dict[tuple[int, int], dict[str, Any]] = {}
        
        for fmt in formats:
            # Skip audio-only and other non-video formats
            if fmt.get('vcodec') == 'none':
                continue
            
            height = fmt.get('height')
            fps = fmt.get('fps', 0)
            format_id = fmt.get('format_id')
            
            if not format_id or height is None:
                continue
            
            # Group by height and fps
            key = (height, int(fps) if fps else 0)
            
            # Keep the format with the best bitrate in each group
            if key not in format_groups or fmt.get('tbr', 0) > format_groups[key].get('tbr', 0):
                format_groups[key] = fmt
        
        if not format_groups:
            logger.warning(f'No suitable video formats found for {url}')
            return []
        
        # Sort by resolution (height) descending, then by fps descending
        sorted_formats = sorted(
            format_groups.items(),
            key=lambda x: (x[0][0], x[0][1]),
            reverse=True
        )
        
        # Build the result list
        result_formats: list[dict[str, str]] = []
        
        for (height, fps), fmt in sorted_formats:
            format_id = fmt['format_id']
            
            # Create a label for display
            if fps and fps > 30:
                label = f'{height}p{int(fps)}'
            else:
                label = f'{height}p'
            
            # For video-only formats, we need to pair with audio
            if fmt.get('acodec') == 'none':
                # Video-only: use format_id+bestaudio/best selector
                selector = f'{format_id}+bestaudio/best'
            else:
                # Video+audio or other: use the format_id directly
                selector = format_id
            
            result_formats.append({
                'label': label,
                'value': selector,
            })
        
        # Add a "Best available" option at the top
        if result_formats:
            result_formats.insert(0, {
                'label': 'Best available',
                'value': 'bestvideo+bestaudio/best',
            })
        
        logger.debug(f'Found {len(result_formats)} formats for {url}: {result_formats}')
        return result_formats
        
    except subprocess.TimeoutExpired:
        logger.warning(f'yt-dlp timeout while fetching formats for {url}')
        return []
    except json.JSONDecodeError as e:
        logger.warning(f'Failed to parse yt-dlp JSON output for {url}: {e}')
        return []
    except Exception as e:
        logger.warning(f'Unexpected error fetching formats for {url}: {e}')
        return []


def _validate_download_clip_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'download-clip':
        return None, _error_response('bad-request', "Expected request type 'download-clip'.")

    url, label, audio_only, validation_error, downloader = _validate_download_request_fields(message, 'A non-empty clip label is required.')
    if validation_error:
        return None, validation_error

    assert url is not None
    assert label is not None
    assert audio_only is not None
    assert downloader is not None

    start_time_seconds = message.get('startTimeSeconds')
    end_time_seconds = message.get('endTimeSeconds')

    if not isinstance(start_time_seconds, (int, float)) or not isinstance(end_time_seconds, (int, float)):
        return None, _error_response('bad-request', 'Clip start/end times must be numeric.')

    start_time_seconds = float(start_time_seconds)
    end_time_seconds = float(end_time_seconds)

    if start_time_seconds < 0 or end_time_seconds < 0:
        return None, _error_response('bad-request', 'Clip start/end times cannot be negative.')

    if end_time_seconds <= start_time_seconds:
        return None, _error_response('bad-request', 'Clip end time must be greater than start time.')

    validated_request: dict[str, Any] = {
        'type': 'download-clip',
        'url': url,
        'label': label,
        'startTimeSeconds': round(start_time_seconds, 3),
        'endTimeSeconds': round(end_time_seconds, 3),
        'audioOnly': bool(audio_only),
        'showLiveProcessLog': bool(message.get('showLiveProcessLog', True)),
        'organizeByDate': bool(message.get('organizeByDate', False)),
        'organizeBySource': bool(message.get('organizeBySource', False)),
        'organizeByUploader': bool(message.get('organizeByUploader', False)),
        'downloader': downloader,
    }

    # Preserve optional fields if provided
    format_selector = message.get('formatSelector')
    if isinstance(format_selector, str) and format_selector:
        validated_request['formatSelector'] = format_selector

    downloads_path = message.get('downloadsPath')
    if isinstance(downloads_path, str) and downloads_path:
        validated_request['downloadsPath'] = downloads_path

    file_format = message.get('fileFormat')
    if isinstance(file_format, str) and file_format:
        validated_request['fileFormat'] = file_format

    file_naming_template = message.get('fileNamingTemplate')
    if isinstance(file_naming_template, str) and file_naming_template:
        validated_request['fileNamingTemplate'] = file_naming_template

    cookies_file = message.get('cookiesFile')
    if isinstance(cookies_file, str):
        validated_request['cookiesFile'] = cookies_file

    return validated_request, None


def _validate_download_full_video_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'download-full-video':
        return None, _error_response('bad-request', "Expected request type 'download-full-video'.")

    url, label, audio_only, validation_error, downloader = _validate_download_request_fields(message, 'A non-empty full-video label is required.')
    if validation_error:
        return None, validation_error

    assert url is not None
    assert label is not None
    assert audio_only is not None
    assert downloader is not None

    validated_request: dict[str, Any] = {
        'type': 'download-full-video',
        'url': url,
        'label': label,
        'audioOnly': audio_only,
        'showLiveProcessLog': bool(message.get('showLiveProcessLog', True)),
        'organizeByDate': bool(message.get('organizeByDate', False)),
        'organizeBySource': bool(message.get('organizeBySource', False)),
        'organizeByUploader': bool(message.get('organizeByUploader', False)),
        'downloader': downloader,
    }

    # Preserve optional fields if provided
    format_selector = message.get('formatSelector')
    if isinstance(format_selector, str) and format_selector:
        validated_request['formatSelector'] = format_selector

    downloads_path = message.get('downloadsPath')
    if isinstance(downloads_path, str) and downloads_path:
        validated_request['downloadsPath'] = downloads_path

    # Preserve optional formatSelector if provided
    format_selector = message.get('formatSelector')
    if isinstance(format_selector, str) and format_selector:
        validated_request['formatSelector'] = format_selector

    file_format = message.get('fileFormat')
    if isinstance(file_format, str) and file_format:
        validated_request['fileFormat'] = file_format

    file_naming_template = message.get('fileNamingTemplate')
    if isinstance(file_naming_template, str) and file_naming_template:
        validated_request['fileNamingTemplate'] = file_naming_template

    cookies_file = message.get('cookiesFile')
    if isinstance(cookies_file, str):
        validated_request['cookiesFile'] = cookies_file

    return validated_request, None


def _validate_show_downloaded_clip_in_folder_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'show-downloaded-clip-in-folder':
        return None, _error_response('bad-request', "Expected request type 'show-downloaded-clip-in-folder'.")

    output_path = message.get('outputPath')
    highlight_file = message.get('highlightFile', True)

    if not isinstance(output_path, str) or not output_path.strip():
        return None, _error_response('bad-request', 'A non-empty outputPath is required.')

    if not isinstance(highlight_file, bool):
        return None, _error_response('bad-request', 'highlightFile must be a boolean when provided.')

    return {
        'type': 'show-downloaded-clip-in-folder',
        'outputPath': output_path,
        'highlightFile': highlight_file,
    }, None


def _validate_delete_file_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'delete-file':
        return None, _error_response('bad-request', "Expected request type 'delete-file'.")

    output_path = message.get('outputPath')
    if not isinstance(output_path, str) or not output_path.strip():
        return None, _error_response('bad-request', 'A non-empty outputPath is required.')

    return {
        'type': 'delete-file',
        'outputPath': output_path,
    }, None


def _validate_check_file_exists_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'check-file-exists':
        return None, _error_response('bad-request', "Expected request type 'check-file-exists'.")

    output_path = message.get('outputPath')
    if not isinstance(output_path, str) or not output_path.strip():
        return None, _error_response('bad-request', 'A non-empty outputPath is required.')

    return {
        'type': 'check-file-exists',
        'outputPath': output_path,
    }, None


def _validate_get_video_formats_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'get-video-formats':
        return None, _error_response('bad-request', "Expected request type 'get-video-formats'.")

    url = message.get('url')

    if not isinstance(url, str) or not url:
        return None, _error_response('bad-request', 'A non-empty video URL is required.')

    return {
        'type': 'get-video-formats',
        'url': url,
    }, None


def _validate_pick_directory_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'pick-directory':
        return None, _error_response('bad-request', "Expected request type 'pick-directory'.")

    return {'type': 'pick-directory'}, None


def _validate_pick_file_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'pick-file':
        return None, _error_response('bad-request', "Expected request type 'pick-file'.")

    return {'type': 'pick-file'}, None


def _validate_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    request_type = message.get('type')

    if request_type == 'download-clip':
        return _validate_download_clip_request(message)

    if request_type == 'download-full-video':
        return _validate_download_full_video_request(message)

    if request_type == 'show-downloaded-clip-in-folder':
        return _validate_show_downloaded_clip_in_folder_request(message)

    if request_type == 'delete-file':
        return _validate_delete_file_request(message)

    if request_type == 'check-file-exists':
        return _validate_check_file_exists_request(message)

    if request_type == 'get-video-formats':
        return _validate_get_video_formats_request(message)

    if request_type == 'pick-directory':
        return _validate_pick_directory_request(message)

    if request_type == 'pick-file':
        return _validate_pick_file_request(message)

    return None, _error_response('bad-request', "Expected request type 'download-clip', 'download-full-video', 'show-downloaded-clip-in-folder', 'delete-file', 'check-file-exists', 'get-video-formats', 'pick-directory', or 'pick-file'.")


def _require_tool(tool_name: str) -> tuple[str | None, dict[str, Any] | None]:
    tool_path = shutil.which(tool_name)
    if tool_path:
        logger.debug(f'Tool found: {tool_name} at {tool_path}')
        return tool_path, None

    logger.warning(f'Tool not found: {tool_name}')
    return None, _error_response(
        'missing-tool',
        f"'{tool_name}' was not found on PATH. Install it and make sure a new terminal can run `{tool_name} --version`.",
    )


def _sanitize_file_token(value: str) -> str:
    return ''.join(character if character.isalnum() else '-' for character in value).strip('-') or 'clip'


def _format_yt_dlp_seconds(seconds: float) -> str:
    return f'{seconds:.3f}'


def _get_estimated_file_size(url: str) -> int | None:
    try:
        result = subprocess.run(
            ['yt-dlp', '--dump-json', '--no-download', '--skip-download', url],
            capture_output=True,
            text=True,
            timeout=30,
            encoding='utf-8',
            errors='replace',
        )
        if result.returncode == 0 and result.stdout.strip():
            info = json.loads(result.stdout)
            filesize = info.get('filesize')
            if filesize and isinstance(filesize, (int, float)) and filesize > 0:
                return int(filesize)
            filesize_approx = info.get('filesize_approx')
            if filesize_approx and isinstance(filesize_approx, (int, float)) and filesize_approx > 0:
                return int(filesize_approx)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError, KeyError):
        pass
    return None


def _check_disk_space(downloads_dir: Path, estimated_size: int | None) -> dict[str, Any] | None:
    try:
        disk_usage = shutil.disk_usage(downloads_dir)
    except OSError as error:
        return _error_response('disk-error', f'Could not check disk space: {error}')

    available_bytes = disk_usage.free
    free_gb = available_bytes / (1024 ** 3)

    if estimated_size is not None and estimated_size > 0:
        required_bytes = int(estimated_size * 1.25)
        if available_bytes < required_bytes:
            required_gb = required_bytes / (1024 ** 3)
            return _error_response(
                'insufficient-disk-space',
                f'Not enough disk space to download this clip. '
                f'Estimated size: {required_gb:.2f} GB, '
                f'Available: {free_gb:.2f} GB. '
                f'Please free up at least '
                f'{(required_bytes - available_bytes) / (1024 ** 3):.2f} GB and try again.',
            )

    if free_gb < 0.5:
        return _error_response(
            'low-disk-space',
            f'Your disk is running low on space ({free_gb:.2f} GB free). '
            f'Please free up some space and try again.',
        )

    return None

def _build_temp_output_template(request: dict[str, Any]) -> str:
    start_ms = int(round(request['startTimeSeconds'] * 1000))
    end_ms = int(round(request['endTimeSeconds'] * 1000))
    label_token = _sanitize_file_token(request['label']).lower()

    user_template = request.get('fileNamingTemplate')
    if user_template:
        if '%(ext)s' not in user_template:
            user_template = user_template + '.%(ext)s'
        # Insert .clip-dl-temp. before the extension so _derive_final_output_path
        # can replace it with the actual extension after the remux pass.
        user_template = user_template.replace('.%(ext)s', '.clip-dl-temp.%(ext)s')
        return user_template

    # yt-dlp writes into a temporary clip first. We then remux that file with a
    # second ffmpeg pass so timestamp/keyframe oddities from the initial section
    # extraction do not leak into the final file the user keeps.
    #return f'(%(upload_date>%Y-%m-%d)s) %(title).180B {label_token} {start_ms}-{end_ms} [%(id)s].clip-dl-temp.%(ext)s'
    return f'(%(upload_date>%Y-%m-%d)s)_%(title).180B_%(epoch)s_[%(id)s].clip-dl-temp.%(ext)s'

def _build_full_video_output_template(request: dict[str, Any]) -> str:
    user_template = request.get('fileNamingTemplate')
    if user_template:
        if '%(ext)s' not in user_template:
            user_template = user_template + '.%(ext)s'
        return user_template

    label_token = _sanitize_file_token(request['label']).lower()
    return f'(%(upload_date>%Y-%m-%d)s)_%(title).180B_%(epoch)s_[%(id)s].%(ext)s'

SOURCE_DOMAIN_MAP: dict[str, str] = {
    'youtube.com': 'YouTube',
    'twitch.tv': 'Twitch',
}


def _resolve_effective_path(downloads_path: Path, request: dict[str, Any]) -> Path:
    organize_by_date = request.get('organizeByDate', False)
    organize_by_source = request.get('organizeBySource', False)
    organize_by_uploader = request.get('organizeByUploader', False)

    effective_path = downloads_path

    if organize_by_date:
        now = time.localtime()
        date_subdir = f'{now.tm_year:04d}/{now.tm_mon:02d}'
        effective_path = effective_path / date_subdir
        logger.info(f'Path organization: adding date subdir {date_subdir}')

    if organize_by_source:
        url = request.get('url', '')
        parsed = urlparse(url)
        domain = parsed.netloc.lower().removeprefix('www.')
        source_name = SOURCE_DOMAIN_MAP.get(domain) or domain
        effective_path = effective_path / source_name
        logger.info(f'Path organization: adding source subdir {source_name} (domain={domain})')

    if organize_by_uploader:
        url = request.get('url', '')
        try:
            result = subprocess.run(
                ['yt-dlp', '--dump-json', '--no-download', '--skip-download', url],
                capture_output=True,
                text=True,
                timeout=30,
                encoding='utf-8',
                errors='replace',
            )
            if result.returncode == 0 and result.stdout.strip():
                info = json.loads(result.stdout)
                uploader = info.get('uploader', 'Unknown')
                uploader = _sanitize_file_token(uploader)
                effective_path = effective_path / uploader
                logger.info(f'Path organization: adding uploader subdir {uploader}')
            else:
                logger.warning(f'Could not fetch uploader info for {url}')
                effective_path = effective_path / 'Unknown'
        except Exception as e:
            logger.warning(f'Error fetching uploader info: {e}')
            effective_path = effective_path / 'Unknown'

    logger.info(f'Path organization: organizeByDate={organize_by_date}, organizeBySource={organize_by_source}, organizeByUploader={organize_by_uploader}')

    effective_path.mkdir(parents=True, exist_ok=True)
    logger.info(f'Effective download path: {effective_path}')
    return effective_path


def _build_download_command(request: dict[str, Any], downloads_path: Path) -> list[str]:
    audio_only = request.get('audioOnly', False)
    downloader = request.get('downloader', 'native')
    cookies_file = request.get('cookiesFile', '')

    effective_path = _resolve_effective_path(downloads_path, request)

    command = [
        'yt-dlp',
    ]

    # Add downloader flag if not using native
    if downloader != 'native':
        command.extend(['--downloader', downloader])

    command.extend([
        '--no-warnings',
        '--verbose',
        '--windows-filenames',  # Forces yt-dlp to be careful with Windows reserved names
        '--restrict-filenames',  # Swaps spaces and special chars for underscores
        '--progress',
        # This template forces a newline and a specific format Python can't miss
        '--progress-template', 'download:[download] %(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s',
        '--paths', f'home:{effective_path}',
        '--print', 'after_move:%(filepath)s',
        '--embed-metadata',  # Embeds all available metadata (title, uploader, URL, description, upload date, etc.)
        '--embed-thumbnail',  # Downloads and embeds the video thumbnail as poster image
    ])

    if isinstance(cookies_file, str) and cookies_file.strip():
        command.extend(['--cookies', cookies_file])

    if request['type'] == 'download-clip':
        # yt-dlp still owns the YouTube extraction/download phase. We keep the
        # section download here so only the requested range is fetched, but we do
        # not ask yt-dlp to force keyframes because that triggers an expensive
        # re-encode path.
        command.extend([
            '--download-sections',
            f'*{_format_yt_dlp_seconds(request["startTimeSeconds"])}-{_format_yt_dlp_seconds(request["endTimeSeconds"])}',
            '--output', _build_temp_output_template(request),
        ])
    else:
        command.extend([
            '--output', _build_full_video_output_template(request),
        ])

    if audio_only:
        command.extend(['-x', '--audio-format', 'mp3'])
    else:
        file_format = request.get('fileFormat', 'mkv')
        command.extend(['-t', file_format])

    # Add format selector if provided and not doing audio-only download
    format_selector = request.get('formatSelector')
    if format_selector and not audio_only:
        command.extend(['-f', format_selector])

    command.append(request['url'])
    return command


def _build_remux_command(input_path: Path, output_path: Path, audio_only: bool = False) -> list[str]:
    # This is the exact post-download ffmpeg shape requested by the user. The
    # extra remux pass resets the container timestamps/keyframe handling after
    # yt-dlp finishes producing the clip file.
    command = [
        'ffmpeg',
        '-y',
        '-ss',
        '0',
        '-i',
        str(input_path),
    ]

    if audio_only:
        command.extend(['-map', 'a', '-c', 'copy', str(output_path)])
    else:
        command.extend(['-map', '0', '-c', 'copy', str(output_path)])

    return command


def _derive_final_output_path(temp_download_path: Path) -> Path:
    file_name = temp_download_path.name.replace('.clip-dl-temp.', '.')
    if file_name == temp_download_path.name:
        file_name = f'{temp_download_path.stem}.remuxed{temp_download_path.suffix}'
    return temp_download_path.with_name(file_name)


def _extract_output_path(stdout: str) -> Path | None:
    for line in reversed(stdout.splitlines()):
        candidate = line.strip()
        if candidate and (':\\' in candidate or candidate.startswith('\\\\')):
            return Path(candidate)
    return None


def _is_process_alive(pid: int) -> bool:
    """Check if a process with the given PID is still alive (Windows-safe)."""
    try:
        # On Windows, os.kill with signal 0 can be used to check if process exists
        # This does not actually send a signal, just checks process validity
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def _clear_stale_lock() -> None:
    """Remove a lock file if it belongs to a dead process."""
    if not LOCK_FILE_PATH.exists():
        return
    
    try:
        lock_content = LOCK_FILE_PATH.read_text(encoding='utf-8', errors='replace').strip()
        if lock_content.isdigit():
            locked_pid = int(lock_content)
            if not _is_process_alive(locked_pid):
                logger.warning(f'Clearing stale lock from dead process {locked_pid}')
                LOCK_FILE_PATH.unlink()
    except Exception as e:
        logger.warning(f'Failed to check lock staleness: {e}')


@contextmanager
def _single_download_lock() -> Iterator[None]:
    # First, check for and clear any stale locks
    _clear_stale_lock()
    
    try:
        file_descriptor = os.open(str(LOCK_FILE_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as error:
        raise RuntimeError('busy') from error

    try:
        os.write(file_descriptor, str(os.getpid()).encode('utf-8'))
        os.close(file_descriptor)
        yield
    finally:
        try:
            LOCK_FILE_PATH.unlink()
        except FileNotFoundError:
            pass


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload), encoding='utf-8')


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def _run_visible_download(job_path: Path) -> int:
    job = _read_json(job_path)
    download_command = job['downloadCommand']
    request_type = job.get('requestType', 'download-clip')
    result_path = Path(job['resultPath'])
    stdout_path = Path(job['stdoutPath'])
    stderr_path = Path(job['stderrPath'])

    combined_output: list[str] = []
    downloaded_output_path: Path | None = None
    final_output_path: Path | None = None

    try:
        ctypes.windll.kernel32.SetConsoleTitleW(f"Clip-DL: Downloading {job.get('label', 'Clip')}...")
    except Exception:
        pass  # Fallback if not on Windows

    def run_and_stream(command: list[str], title: str) -> int:
        logger.info(title)
        logger.debug(f'Command: {" ".join(command)}')
        print(f'[clip-dl native host] {title}')
        print('[clip-dl native host] Command:')
        print(' '.join(command))
        print('')

        process = subprocess.Popen(
            command,
            shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
        )

        assert process.stdout is not None
        for line in process.stdout:
            print(line, end='')
            # Log yt-dlp/ffmpeg output lines as they arrive
            line_stripped = line.rstrip('\n\r')
            if line_stripped:
                logger.info(f'yt-dlp output: {line_stripped}')
            combined_output.append(line)

        process.wait()
        print('')
        return process.returncode

    logger.info('Starting yt-dlp download stage')
    download_returncode = run_and_stream(download_command, 'Running yt-dlp download stage in a visible console window')
    if download_returncode == 0:
        logger.info('yt-dlp download stage completed successfully')
        downloaded_output_path = _extract_output_path(''.join(combined_output))
        if downloaded_output_path:
            logger.info(f'download output path: {downloaded_output_path}')
    else:
        logger.error(f'yt-dlp download stage failed with return code {download_returncode}')

    remux_returncode = 0
    if download_returncode == 0 and request_type == 'download-clip' and downloaded_output_path is not None:
        final_output_path = _derive_final_output_path(downloaded_output_path)
        audio_only = job.get('audioOnly', False)
        logger.info(f'Starting ffmpeg remux stage: {downloaded_output_path} -> {final_output_path}')
        remux_command = _build_remux_command(downloaded_output_path, final_output_path, audio_only)
        remux_returncode = run_and_stream(remux_command, 'Running ffmpeg remux stage')
        if remux_returncode == 0:
            logger.info(f'ffmpeg remux stage completed successfully: {final_output_path}')
    elif download_returncode == 0 and request_type == 'download-full-video' and downloaded_output_path is not None:
        final_output_path = downloaded_output_path
        logger.info(f'Full video download does not require a remux stage: {final_output_path}')
    elif download_returncode == 0 and request_type == 'download-clip':
        logger.warning('yt-dlp succeeded but could not determine temp download path for ffmpeg remux')
        combined_output.append('clip-dl could not determine the temporary download path for the ffmpeg remux stage.\n')
        remux_returncode = 1
    elif download_returncode == 0:
        logger.warning('yt-dlp succeeded but could not determine the final download path')
        combined_output.append('clip-dl could not determine the download path produced by yt-dlp.\n')
        remux_returncode = 1

    output_text = ''.join(combined_output)
    stdout_path.write_text(output_text, encoding='utf-8')
    stderr_path.write_text(output_text, encoding='utf-8')

    overall_returncode = download_returncode if download_returncode != 0 else remux_returncode
    result = {
        'returncode': overall_returncode,
        'downloadType': request_type,
        'downloadedOutputPath': str(downloaded_output_path) if downloaded_output_path is not None else None,
        'finalOutputPath': str(final_output_path) if final_output_path is not None else None,
    }
    _write_json(result_path, result)

    if overall_returncode == 0:
        logger.info('Download completed successfully')
        print('')
        print('[clip-dl native host] Download completed.')
        if request_type == 'download-clip' and downloaded_output_path is not None and downloaded_output_path.exists():
            try:
                downloaded_output_path.unlink()
                logger.info(f'Removed temp clip: {downloaded_output_path}')
            except OSError:
                logger.warning(f'Failed to remove temp clip {downloaded_output_path}')
                print(f'[clip-dl native host] Warning: failed to remove temp clip {downloaded_output_path}')
        time.sleep(2)
    else:
        logger.error(f'Download failed with return code {overall_returncode}')
        print('')
        print('[clip-dl native host] Download failed. Leaving this window open briefly so the error is visible.')
        time.sleep(8)

    return overall_returncode


def _run_command_silently(request: dict[str, Any], downloads_path: Path) -> subprocess.CompletedProcess[str]:
    """Run yt-dlp/ffmpeg silently without spawning a visible console window."""
    download_command = _build_download_command(request, downloads_path)
    combined_output: list[str] = []

    logger.info('Starting yt-dlp download stage (silent mode)')
    download_returncode = 1
    downloaded_output_path: Path | None = None

    process = subprocess.run(
        download_command,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=3600,
    )
    combined_output.append(process.stdout)
    download_returncode = process.returncode

    if download_returncode == 0:
        logger.info('yt-dlp download stage completed successfully (silent mode)')
        downloaded_output_path = _extract_output_path(process.stdout)
        if downloaded_output_path:
            logger.info(f'download output path: {downloaded_output_path}')
    else:
        logger.error(f'yt-dlp download stage failed with return code {download_returncode} (silent mode)')

    final_output_path: Path | None = None
    if download_returncode == 0 and request['type'] == 'download-clip' and downloaded_output_path is not None:
        final_output_path = _derive_final_output_path(downloaded_output_path)
        audio_only = request.get('audioOnly', False)
        logger.info(f'Starting ffmpeg remux stage (silent mode): {downloaded_output_path} -> {final_output_path}')
        remux_command = _build_remux_command(downloaded_output_path, final_output_path, audio_only)
        remux_process = subprocess.run(
            remux_command,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=3600,
        )
        combined_output.append(remux_process.stdout)
        if remux_process.returncode != 0:
            download_returncode = remux_process.returncode
            logger.error(f'ffmpeg remux stage failed with return code {remux_process.returncode} (silent mode)')
        else:
            logger.info(f'ffmpeg remux stage completed successfully (silent mode): {final_output_path}')
    elif download_returncode == 0 and request['type'] == 'download-full-video' and downloaded_output_path is not None:
        final_output_path = downloaded_output_path
        logger.info(f'Full video download does not require a remux stage (silent mode): {final_output_path}')

    if download_returncode == 0 and request['type'] == 'download-clip' and downloaded_output_path is not None:
        try:
            downloaded_output_path.unlink()
            logger.info(f'Removed temp clip: {downloaded_output_path}')
        except OSError:
            logger.warning(f'Failed to remove temp clip {downloaded_output_path}')

    completed_process = subprocess.CompletedProcess(download_command, download_returncode, ''.join(combined_output), ''.join(combined_output))
    setattr(completed_process, 'resolved_final_output_path', final_output_path)
    return completed_process


def _run_command_with_visible_progress(download_command: list[str], request: dict[str, Any]) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory(prefix='clip-dl-progress-') as temp_directory:
        temp_path = Path(temp_directory)
        stdout_path = temp_path / 'stdout.txt'
        stderr_path = temp_path / 'stderr.txt'
        result_path = temp_path / 'result.json'
        job_path = temp_path / 'job.json'

        _write_json(job_path, {
            'downloadCommand': download_command,
            'requestType': request['type'],
            'resultPath': str(result_path),
            'stdoutPath': str(stdout_path),
            'stderrPath': str(stderr_path),
            'audioOnly': request.get('audioOnly', False),
            'label': request.get('label', 'Clip'),
        })

        helper_process = subprocess.Popen(
            [
                sys.executable,
                str(Path(__file__).resolve()),
                '--run-visible-download',
                str(job_path),
            ],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            shell=False,
        )
        helper_process.wait()

        stdout = stdout_path.read_text(encoding='utf-8', errors='replace') if stdout_path.exists() else ''
        stderr = stderr_path.read_text(encoding='utf-8', errors='replace') if stderr_path.exists() else ''

        resolved_final_output_path: Path | None = None
        if result_path.exists():
            result = _read_json(result_path)
            returncode = int(result['returncode'])
            if result.get('finalOutputPath'):
                resolved_final_output_path = Path(result['finalOutputPath'])
        else:
            returncode = helper_process.returncode if helper_process.returncode is not None else 1

        completed_process = subprocess.CompletedProcess(download_command, returncode, stdout, stderr)
        setattr(completed_process, 'resolved_final_output_path', resolved_final_output_path)
        return completed_process


def _run_self_test() -> int:
    logger.info('Running self-test')
    missing_tools: list[str] = []
    for tool_name in ('yt-dlp', 'ffmpeg', 'ffprobe'):
        if shutil.which(tool_name) is None:
            missing_tools.append(tool_name)

    if missing_tools:
        print('Missing tools:', ', '.join(missing_tools))
        logger.error(f'Self-test failed: missing tools: {", ".join(missing_tools)}')
        return 1

    print('All required tools are available on PATH.')
    print(f'Default downloads directory: {Path.home() / "Downloads"}')
    logger.info('Self-test passed')
    return 0


def _show_downloaded_clip_in_folder(output_path: str, highlight_file: bool) -> tuple[bool, str | None]:
    target_path = Path(output_path).expanduser()

    try:
        if target_path.exists() and target_path.is_dir():
            subprocess.Popen(['explorer', str(target_path)], shell=False)
            return True, None

        if target_path.exists() and target_path.is_file():
            if highlight_file:
                subprocess.Popen(['explorer', '/select,', str(target_path)], shell=False)
            else:
                subprocess.Popen(['explorer', str(target_path.parent)], shell=False)
            return True, None

        parent_directory = target_path.parent
        if parent_directory.exists() and parent_directory.is_dir():
            subprocess.Popen(['explorer', str(parent_directory)], shell=False)
            return True, None

        return False, f'Could not open Explorer because neither the file nor parent folder exists: {target_path}'
    except Exception as error:
        return False, f'Failed to open folder in Explorer: {error}'


def _delete_downloaded_file(output_path: str) -> tuple[bool, str | None]:
    target_path = Path(output_path).expanduser()

    try:
        if not target_path.exists():
            return False, f'File does not exist: {target_path}'

        if not target_path.is_file():
            return False, f'Path is not a file: {target_path}'

        target_path.unlink()
        return True, None
    except Exception as error:
        return False, f'Failed to delete file: {error}'


def _check_file_exists(output_path: str) -> tuple[bool, bool, str | None]:
    target_path = Path(output_path).expanduser()

    try:
        exists = target_path.exists()
        is_file = target_path.is_file() if exists else False
        return True, bool(exists and is_file), None
    except Exception as error:
        return False, False, f'Failed to check file availability: {error}'


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == '--self-test':
        return _run_self_test()

    if len(sys.argv) > 2 and sys.argv[1] == '--run-visible-download':
        return _run_visible_download(Path(sys.argv[2]))

    if sys.stdin.isatty():
        logger.info('No native messaging input detected. Use --self-test or launch through Chrome.')
        return 0

    message = _read_native_message()
    if message is None:
        logger.info('No native message received.')
        _write_native_message(_error_response('bad-request', 'No native message received.'))
        return 0

    logger.info(f'Raw received message: {json.dumps(message)}')
    logger.debug(f'Received request: type={message.get("type")}')

    request, validation_error = _validate_request(message)
    if validation_error:
        logger.warning(f'Validation error: {validation_error.get("code")}: {validation_error.get("message")}')
        _write_native_message(validation_error)
        return 0

    if request is None:
        logger.warning('No valid request payload provided.')
        _write_native_message(_error_response('bad-request', 'No valid request payload was provided.'))
        return 0

    logger.info(f'Validated request keys: {list(request.keys())}, organizeBySource={request.get("organizeBySource")!r}')

    if request['type'] == 'show-downloaded-clip-in-folder':
        logger.info(f'Showing downloaded clip in folder: {request["outputPath"]}')
        opened, error_message = _show_downloaded_clip_in_folder(request['outputPath'], request['highlightFile'])
        if not opened:
            logger.error(f'Failed to show clip in folder: {error_message}')
            _write_native_message(_error_response('show-file-failed', error_message or 'Failed to open folder in Explorer.'))
            return 0

        logger.info('Successfully opened folder in Explorer')
        _write_native_message({
            'ok': True,
            'opened': True,
            'outputPath': request['outputPath'],
            'highlighted': request['highlightFile'],
        })
        return 0

    if request['type'] == 'delete-file':
        logger.info(f'Deleting downloaded file: {request["outputPath"]}')
        deleted, error_message = _delete_downloaded_file(request['outputPath'])
        if not deleted:
            logger.error(f'Failed to delete file: {error_message}')
            _write_native_message(_error_response('delete-file-failed', error_message or 'Failed to delete file.'))
            return 0

        logger.info('Successfully deleted downloaded file')
        _write_native_message({
            'ok': True,
            'deleted': True,
            'outputPath': request['outputPath'],
        })
        return 0

    if request['type'] == 'check-file-exists':
        logger.info(f'Checking downloaded file availability: {request["outputPath"]}')
        checked, exists, error_message = _check_file_exists(request['outputPath'])
        if not checked:
            logger.error(f'Failed to check file availability: {error_message}')
            _write_native_message(_error_response('check-file-failed', error_message or 'Failed to check file availability.'))
            return 0

        _write_native_message({
            'ok': True,
            'exists': exists,
            'outputPath': request['outputPath'],
        })
        return 0

    if request['type'] == 'get-video-formats':
        logger.info(f'Fetching video formats for: {request["url"]}')
        _, missing_tool_error = _require_tool('yt-dlp')
        if missing_tool_error:
            logger.error(f'Missing yt-dlp: {missing_tool_error.get("message")}')
            _write_native_message(missing_tool_error)
            return 0

        formats = _get_video_formats(request['url'])
        logger.info(f'Found {len(formats)} formats for {request["url"]}')
        _write_native_message({
            'ok': True,
            'formats': formats,
        })
        return 0

    if request['type'] == 'pick-directory':
        logger.info('Picking directory via native file dialog')
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            directory_path = filedialog.askdirectory(parent=root, title='Select Download Directory')
            root.destroy()

            if directory_path:
                logger.info(f'Selected directory: {directory_path}')
                _write_native_message({
                    'ok': True,
                    'directory': directory_path,
                })
            else:
                logger.info('Directory selection cancelled')
                _write_native_message({
                    'ok': True,
                    'directory': None,
                })
        except Exception as error:
            logger.error(f'Failed to pick directory: {error}')
            _write_native_message(_error_response('pick-directory-failed', f'Failed to show directory picker: {error}'))
        return 0

    if request['type'] == 'pick-file':
        logger.info('Picking file via native file dialog')
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            file_path = filedialog.askopenfilename(
                parent=root,
                title='Select cookies.txt file',
                filetypes=[('Cookies files', '*.txt'), ('All files', '*.*')],
            )
            root.destroy()

            if file_path:
                logger.info(f'Selected file: {file_path}')
                _write_native_message({
                    'ok': True,
                    'filePath': file_path,
                })
            else:
                logger.info('File selection cancelled')
                _write_native_message({
                    'ok': True,
                    'filePath': None,
                })
        except Exception as error:
            logger.error(f'Failed to pick file: {error}')
            _write_native_message(_error_response('pick-file-failed', f'Failed to show file picker: {error}'))
        return 0

    user_downloads_path = request.get('downloadsPath', '')
    logger.info(f'[DEBUG] downloadsPath from request: "{user_downloads_path}" (type={type(user_downloads_path).__name__})')
    logger.info(f'[DEBUG] Full request keys: {list(request.keys())}')
    if user_downloads_path:
        downloads_path = Path(user_downloads_path)
        downloads_path.mkdir(parents=True, exist_ok=True)
    else:
        downloads_path = Path.home() / 'Downloads'
        downloads_path.mkdir(parents=True, exist_ok=True)
    logger.debug(f'Downloads path: {downloads_path}')

    for tool_name in ('yt-dlp', 'ffmpeg', 'ffprobe'):
        _, missing_tool_error = _require_tool(tool_name)
        if missing_tool_error:
            logger.error(f'Missing tool check failed: {missing_tool_error.get("message")}')
            _write_native_message(missing_tool_error)
            return 0

    estimated_size = _get_estimated_file_size(request['url'])
    disk_space_error = _check_disk_space(downloads_path, estimated_size)
    if disk_space_error:
        logger.warning(f'Disk space check failed: {disk_space_error.get("code")}: {disk_space_error.get("message")}')
        _write_native_message(disk_space_error)
        return 0

    if request['type'] == 'download-clip':
        logger.info(f'Processing download-clip request: url={request["url"]}, label={request["label"]}, start={request["startTimeSeconds"]}, end={request["endTimeSeconds"]}')
    else:
        logger.info(f'Processing download-full-video request: url={request["url"]}, label={request["label"]}')

    if request.get('organizeByDate', False):
        logger.info(f'Date organization enabled for this download')

    if request.get('organizeBySource', False):
        logger.info(f'Source organization enabled for this download')

    try:
        with _single_download_lock():
            download_command = _build_download_command(request, downloads_path)
            show_live = request.get('showLiveProcessLog', True)
            if show_live:
                logger.debug(f'Executing with visible progress window: {download_command!r}')
                completed_process = _run_command_with_visible_progress(download_command, request)
            else:
                logger.debug(f'Executing silently (live process log disabled): {download_command!r}')
                completed_process = _run_command_silently(request, downloads_path)
    except RuntimeError as error:
        if str(error) == 'busy':
            logger.warning('Another download is already running (busy lock)')
            _write_native_message(_error_response('busy', 'Another clip download is already running.'))
            return 0
        raise
    except Exception as error:
        logger.error(f'Failed to start yt-dlp: {error}')
        _write_native_message(_error_response('download-failed', f'Failed to start yt-dlp: {error}'))
        return 0

    stdout = completed_process.stdout.strip()
    stderr = completed_process.stderr.strip()

    if completed_process.returncode != 0:
        logger.error(f'yt-dlp/ffmpeg failed with return code {completed_process.returncode}')
        if stdout:
            logger.error(f'yt-dlp/ffmpeg stdout:\n{stdout}')
        if stderr:
            logger.error(f'yt-dlp/ffmpeg stderr:\n{stderr}')
        error_text = stderr or stdout or f'yt-dlp/ffmpeg exited with code {completed_process.returncode}.'
        _write_native_message(_error_response('download-failed', error_text))
        return 0

    output_path = getattr(completed_process, 'resolved_final_output_path', None)
    if output_path is None or not output_path.exists():
        logger.error('Download finished but the final output file was not found')
        _write_native_message(_error_response('download-failed', 'Download finished but the output file was not found.'))
        return 0

    logger.info(f'Download completed successfully: {output_path}')
    if request['type'] == 'download-clip':
        _write_native_message({
            'ok': True,
            'downloadType': 'clip',
            'outputPath': str(output_path),
            'fileName': output_path.name,
            'clipRange': {
                'startTimeSeconds': request['startTimeSeconds'],
                'endTimeSeconds': request['endTimeSeconds'],
            },
        })
    else:
        _write_native_message({
            'ok': True,
            'downloadType': 'full-video',
            'outputPath': str(output_path),
            'fileName': output_path.name,
        })
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
