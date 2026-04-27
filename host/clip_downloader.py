from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator
import ctypes  
from pathvalidate import sanitize_filename 

LOCK_FILE_PATH = Path(tempfile.gettempdir()) / 'clip-dl-native-host.lock'

#TODO: Create a log file within the project that the host can write to for debugging purposes, instead of relying on the console output. All of the progress that the host makes should be logged to this file. For example: ALL of the output from the yt-dlp and ffmpeg processes, when they start and finish, any errors that occur, when the host receives a request, when it sends a response, etc.
def _log(message: str) -> None:
    print(f'[clip-dl native host] {message}', file=sys.stderr, flush=True)


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

#TODO: Make sure that the we check there is enough disk space before starting the download, and return a clear error message if not.
def _validate_download_clip_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
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


def _validate_request(message: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    request_type = message.get('type')

    if request_type == 'download-clip':
        return _validate_download_clip_request(message)

    if request_type == 'show-downloaded-clip-in-folder':
        return _validate_show_downloaded_clip_in_folder_request(message)

    return None, _error_response('bad-request', "Expected request type 'download-clip' or 'show-downloaded-clip-in-folder'.")


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

#TODO: I want to change the default filetype that yt-dlp downloads to mkv. Later on, in the extension settings we can allow the user to configure the default output format. For now though, we just want to ensure that webm is no longer the default. I am not sure if this should be done through the yt-dlp download step or the ffmpeg remux step.
def _build_output_template(request: dict[str, Any]) -> str:
    start_ms = int(round(request['startTimeSeconds'] * 1000))
    end_ms = int(round(request['endTimeSeconds'] * 1000))
    
    # Sanitize the label and a placeholder for the title
    label_token = sanitize_filename(request['label']).lower().replace(" ", "-")
    
    # We tell yt-dlp to limit the title length and we use its internal 
    # restricted filenames logic as a first layer of defense.
    return f'%(title).100s [%(id)s] {label_token} {start_ms}-{end_ms}.%(ext)s'

def _build_temp_output_template(request: dict[str, Any]) -> str:
    start_ms = int(round(request['startTimeSeconds'] * 1000))
    end_ms = int(round(request['endTimeSeconds'] * 1000))
    label_token = _sanitize_file_token(request['label']).lower()

    # yt-dlp writes into a temporary clip first. We then remux that file with a
    # second ffmpeg pass so timestamp/keyframe oddities from the initial section
    # extraction do not leak into the final file the user keeps.
    return f'%(title).180B [%(id)s] {label_token} {start_ms}-{end_ms}.clip-dl-temp.%(ext)s'


def _build_download_command(request: dict[str, Any], downloads_path: Path) -> list[str]:
    duration_seconds = request['endTimeSeconds'] - request['startTimeSeconds']
    output_template = _build_temp_output_template(request)

    # yt-dlp still owns the YouTube extraction/download phase. We keep the
    # section download here so only the requested range is fetched, but we do
    # not ask yt-dlp to force keyframes because that triggers an expensive
    # re-encode path.

    return [
        'yt-dlp',
        '--no-warnings',
        '--windows-filenames', # Forces yt-dlp to be careful with Windows reserved names
        '--restrict-filenames', # Swaps spaces and special chars for underscores
        '--progress',
        # This template forces a newline and a specific format Python can't miss
        '--progress-template', 'download:[download] %(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s',
        '--download-sections',
        f'*{_format_yt_dlp_seconds(request["startTimeSeconds"])}-{_format_yt_dlp_seconds(request["endTimeSeconds"])}',
        '--paths', f'home:{downloads_path}',
        '--output', output_template,
        '--print', 'after_move:%(filepath)s',
        request['url'],
    ]


def _build_remux_command(input_path: Path, output_path: Path) -> list[str]:
    # This is the exact post-download ffmpeg shape requested by the user. The
    # extra remux pass resets the container timestamps/keyframe handling after
    # yt-dlp finishes producing the clip file.
    return [
        'ffmpeg',
        '-y',
        '-ss',
        '0',
        '-i',
        str(input_path),
        '-map',
        '0',
        '-c',
        'copy',
        str(output_path),
    ]


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


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload), encoding='utf-8')


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def _run_visible_download(job_path: Path) -> int:
    job = _read_json(job_path)
    download_command = job['downloadCommand']
    result_path = Path(job['resultPath'])
    stdout_path = Path(job['stdoutPath'])
    stderr_path = Path(job['stderrPath'])

    combined_output: list[str] = []
    temp_download_path: Path | None = None
    final_output_path: Path | None = None
# SET THE WINDOW TITLE HERE
    try:
        ctypes.windll.kernel32.SetConsoleTitleW(f"Clip-DL: Downloading {job.get('label', 'Clip')}...")
    except Exception:
        pass # Fallback if not on Windows
    
    def run_and_stream(command: list[str], title: str) -> int:
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
            combined_output.append(line)

        process.wait()
        print('')
        return process.returncode

    download_returncode = run_and_stream(download_command, 'Running yt-dlp download stage in a visible console window')
    if download_returncode == 0:
        temp_download_path = _extract_output_path(''.join(combined_output))

    remux_returncode = 0
    if download_returncode == 0 and temp_download_path is not None:
        final_output_path = _derive_final_output_path(temp_download_path)
        remux_command = _build_remux_command(temp_download_path, final_output_path)
        remux_returncode = run_and_stream(remux_command, 'Running ffmpeg remux stage')
    elif download_returncode == 0:
        combined_output.append('clip-dl could not determine the temporary download path for the ffmpeg remux stage.\n')
        remux_returncode = 1

    output_text = ''.join(combined_output)
    stdout_path.write_text(output_text, encoding='utf-8')
    stderr_path.write_text(output_text, encoding='utf-8')

    overall_returncode = download_returncode if download_returncode != 0 else remux_returncode
    result = {
        'returncode': overall_returncode,
        'tempDownloadPath': str(temp_download_path) if temp_download_path is not None else None,
        'finalOutputPath': str(final_output_path) if final_output_path is not None else None,
    }
    _write_json(result_path, result)

    if overall_returncode == 0:
        print('')
        print('[clip-dl native host] Clip download completed.')
        if temp_download_path is not None and temp_download_path.exists():
            try:
                temp_download_path.unlink()
            except OSError:
                print(f'[clip-dl native host] Warning: failed to remove temp clip {temp_download_path}')
        time.sleep(2)
    else:
        print('')
        print('[clip-dl native host] Clip download failed. Leaving this window open briefly so the error is visible.')
        time.sleep(8)

    return overall_returncode


def _run_command_with_visible_progress(download_command: list[str]) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory(prefix='clip-dl-progress-') as temp_directory:
        temp_path = Path(temp_directory)
        stdout_path = temp_path / 'stdout.txt'
        stderr_path = temp_path / 'stderr.txt'
        result_path = temp_path / 'result.json'
        job_path = temp_path / 'job.json'

        _write_json(job_path, {
            'downloadCommand': download_command,
            'resultPath': str(result_path),
            'stdoutPath': str(stdout_path),
            'stderrPath': str(stderr_path),
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


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == '--self-test':
        return _run_self_test()

    if len(sys.argv) > 2 and sys.argv[1] == '--run-visible-download':
        return _run_visible_download(Path(sys.argv[2]))

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

    if request is None:
        _write_native_message(_error_response('bad-request', 'No valid request payload was provided.'))
        return 0

    if request['type'] == 'show-downloaded-clip-in-folder':
        opened, error_message = _show_downloaded_clip_in_folder(request['outputPath'], request['highlightFile'])
        if not opened:
            _write_native_message(_error_response('show-file-failed', error_message or 'Failed to open folder in Explorer.'))
            return 0

        _write_native_message({
            'ok': True,
            'opened': True,
            'outputPath': request['outputPath'],
            'highlighted': request['highlightFile'],
        })
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
            download_command = _build_download_command(request, downloads_path)
            _log(f'Executing with visible progress window: {download_command!r}')
            completed_process = _run_command_with_visible_progress(download_command)
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

    output_path = getattr(completed_process, 'resolved_final_output_path', None)
    if output_path is None or not output_path.exists():
        _write_native_message(_error_response('download-failed', 'ffmpeg finished but the final output file was not found.'))
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
