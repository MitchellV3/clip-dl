@echo off
REM Chrome launches this wrapper from the native messaging manifest. Keeping the
REM Python invocation in a tiny .cmd file makes the manifest stable even if the
REM repo path changes and keeps the Python entrypoint obvious for debugging.
python "%~dp0clip_downloader.py"
