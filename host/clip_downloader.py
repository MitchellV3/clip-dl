from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


LOCK_FILE_PATH = Path(tempfile.gettempdir()) / 'clip-dl-native-host.lock'


def _log(message: str) -> None:
    print(f'[clip-dl native host] {message}', file=sys.stderr, flush=True)


def _read_native_message() -> dict[str, Any] | None:
    # Chrome native messaging uses a 4-byte little-endian length prefix followed
    # by a UTF-8 JSON payload on stdin/stdout. The browser owns process startup;
    # our job is just to read one request, write one response, and exit cleanly.
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


def _validate_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if message.get('type') != 'download-clip':
        return None, _error_response('bad-request', "Expected request type 'download-clip'.")

    url = message.get('url')
    label = message.get('label')
    start_time_seconds = message.get('startTimeSeconds')
    end_time_seconds = message.get('endTimeSeconds')

    if not isinstance(url, str) or not url:
        return None, _error_response('bad-request', 'A non-empty video URL is required.')

    if not isinstance(label, str) or not label:
        return None, _error_response('bad-request', 'A non-empty clip label is required.')

    if not isinstance(start_time_seconds, (int, float)) or not isinstance(end_time_seconds, (int, float)):
        return None, _error_response('bad-request', 'Clip start/end times must be numeric.')

    start_time_seconds = float(start_time_seconds)
    end_time_seconds = float(end_time_seconds)

    if start_time_seconds < 0 or end_time_seconds < 0:
        return None, _error_response('bad-request', 'Clip start/end times cannot be negative.')

    if end_time_seconds <= start_time_seconds:
        return None, _error_response('bad-request', 'Clip end time must be greater than start time.')

    return {
        'type': 'download-clip',
        'url': url,
        'label': label,
        'startTimeSeconds': round(start_time_seconds, 3),
        'endTimeSeconds': round(end_time_seconds, 3),
    }, None


def _require_tool(tool_name: str) -> tuple[str | None, dict[str, Any] | None]:
    tool_path = shutil.which(tool_name)
    if tool_path:
        return tool_path, None

    return None, _error_response(
        'missing-tool',
        f"'{tool_name}' was not found on PATH. Install it and make sure a new terminal can run `{tool_name} --version`.",
    )


def _sanitize_file_token(value: str) -> str:
    return ''.join(character if character.isalnum() else '-' for character in value).strip('-') or 'clip'


def _format_yt_dlp_seconds(seconds: float) -> str:
    return f'{seconds:.3f}'


def _build_output_template(request: dict[str, Any]) -> str:
    start_ms = int(round(request['startTimeSeconds'] * 1000))
    end_ms = int(round(request['endTimeSeconds'] * 1000))
    label_token = _sanitize_file_token(request['label']).lower()

    # The suffix embeds the exact requested range so repeated downloads from the
    # same source video do not overwrite each other.
    return f'%(title).180B [%(id)s] {label_token} {start_ms}-{end_ms}.%(ext)s'


def _build_command(request: dict[str, Any], downloads_path: Path) -> list[str]:
    section_expression = f"*{_format_yt_dlp_seconds(request['startTimeSeconds'])}-{_format_yt_dlp_seconds(request['endTimeSeconds'])}"
    output_template = _build_output_template(request)

    # yt-dlp delegates section cutting to ffmpeg. That is why the host checks
    # both executables up front and why `--force-keyframes-at-cuts` lives here
    # instead of in the extension UI code.
    return [
        'yt-dlp',
        '--no-warnings',
        '--windows-filenames',
        '--force-keyframes-at-cuts',
        '--download-sections',
        section_expression,
        '--paths',
        f'home:{downloads_path}',
        '--output',
        output_template,
        '--print',
        'after_move:%(filepath)s',
        request['url'],
    ]


def _extract_output_path(stdout: str) -> Path | None:
    for line in reversed(stdout.splitlines()):
        candidate = line.strip()
        if candidate:
            return Path(candidate)
    return None


@contextmanager
def _single_download_lock() -> Iterator[None]:
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


def _run_self_test() -> int:
    missing_tools: list[str] = []
    for tool_name in ('yt-dlp', 'ffmpeg', 'ffprobe'):
        if shutil.which(tool_name) is None:
            missing_tools.append(tool_name)

    if missing_tools:
        print('Missing tools:', ', '.join(missing_tools))
        return 1

    print('All required tools are available on PATH.')
    print(f'Default downloads directory: {Path.home() / "Downloads"}')
    return 0


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == '--self-test':
        return _run_self_test()

    if sys.stdin.isatty():
        _log('No native messaging input detected. Use --self-test or launch through Chrome.')
        return 0

    message = _read_native_message()
    if message is None:
        _write_native_message(_error_response('bad-request', 'No native message received.'))
        return 0

    request, validation_error = _validate_request(message)
    if validation_error:
        _write_native_message(validation_error)
        return 0

    downloads_path = Path.home() / 'Downloads'
    downloads_path.mkdir(parents=True, exist_ok=True)

    for tool_name in ('yt-dlp', 'ffmpeg', 'ffprobe'):
        _, missing_tool_error = _require_tool(tool_name)
        if missing_tool_error:
            _write_native_message(missing_tool_error)
            return 0

    try:
        with _single_download_lock():
            command = _build_command(request, downloads_path)
            _log(f'Executing: {command!r}')

            completed_process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                shell=False,
            )
    except RuntimeError as error:
        if str(error) == 'busy':
            _write_native_message(_error_response('busy', 'Another clip download is already running.'))
            return 0
        raise
    except Exception as error:
        _write_native_message(_error_response('download-failed', f'Failed to start yt-dlp: {error}'))
        return 0

    stdout = completed_process.stdout.strip()
    stderr = completed_process.stderr.strip()

    if completed_process.returncode != 0:
        _log(f'yt-dlp failed with code {completed_process.returncode}: {stderr}')
        error_text = stderr or stdout or f'yt-dlp exited with code {completed_process.returncode}.'
        _write_native_message(_error_response('download-failed', error_text))
        return 0

    output_path = _extract_output_path(stdout)
    if output_path is None:
        _write_native_message(_error_response('download-failed', 'yt-dlp finished without reporting the output file path.'))
        return 0

    _write_native_message({
        'ok': True,
        'outputPath': str(output_path),
        'fileName': output_path.name,
        'clipRange': {
            'startTimeSeconds': request['startTimeSeconds'],
            'endTimeSeconds': request['endTimeSeconds'],
        },
    })
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
