Command-Line Interface
======================

.. toctree::
    :maxdepth: 3
    :caption: Table of Contents

    Command-line usage <self>
    Tutorial <cli/tutorial>
    Configuration file <cli/config>
    Plugin sideloading <cli/plugin-sideloading>
    Streaming protocols <cli/protocols>
    Proxy support <cli/proxy>
    Metadata <cli/metadata>
    Plugin specific usage <cli/plugins>

Command-line usage
------------------

.. code-block:: console

    streamlink [OPTIONS] <URL> [STREAM]

.. argparse::

Command-line usage
streamlink [OPTIONS] <URL> [STREAM]
Positional arguments
URL
A URL to attempt to extract streams from.

Usually, the protocol of http(s) URLs can be omitted (https://), depending on the implementation of the plugin being used.

Alternatively, the URL can also be specified by using the --url option.

STREAM
Stream to play.

Use best or worst for selecting the highest or lowest available quality.

Fallback streams can be specified by using a comma-separated list:

"720p,480p,best"
If no stream is specified and --default-stream is not used, then a list of available streams will be printed.

General options
-h
--help
Show this help message and exit.

-V
--version
Show version string and exit.

--version-check
Run a version check and exit.

--auto-version-check {yes,true,1,on,no,false,0,off}
Enable or disable the automatic check for a new version of Streamlink.

Default is: "no".

--config FILENAME
Load options from this config file.

Can be repeated to load multiple files, in which case the options are merged on top of each other where the last config has highest priority.

--no-config
Disable loading any default or custom config files.

--locale LOCALE
Override the system's locale setting, for selecting the preferred subtitle and audio language.

The locale is formatted as [language_code]_[country_code], e.g. en_US or es_ES.

Default is: system locale.

Logging arguments
-l LEVEL
--loglevel LEVEL
Set the log message threshold.

Valid levels are, in order of increasing verbosity:

none, critical, error, warning, info, debug, trace, all

Default is: "info".

--logformat FORMAT
Set a custom logging format.

See the Python standard library's logging.Formatter docs for more information about the logging format and the available LogRecord attributes. Streamlink's formatter uses the curly brace style.

The default format depends on the chosen log level.

For verbose levels (trace and all):

Default is: "[{asctime}][{threadName}][{name}][{levelname}] {message}".

Otherwise:

Default is: "[{name}][{levelname}] {message}".

--logdateformat DATEFORMAT
Set a custom logging date format.

This formats the LogRecord's asctime attribute via strftime().

The default date format depends on the chosen log level.

For verbose levels (trace and all):

Default is: "%H:%M:%S.%f".

Otherwise:

Default is: "%H:%M:%S".

--logfile FILE
Append log output to FILE instead of writing to stdout/stderr.

User prompts and download progress won't be written to FILE.

A value of - (dash) will set the file name to an ISO8601-like string and will choose the following default log directories.

Windows:

%TEMP%\streamlink\logs
macOS:

${HOME}/Library/Logs/streamlink
Linux/BSD:

${XDG_STATE_HOME:-${HOME}/.local/state}/streamlink/logs
-Q
--quiet
Suppress all console and log output, and also disable user prompts.

-j
--json
Output JSON representations instead of the normal text output.

Useful for external scripting.

Plugin options
--plugins
Print a list of all currently installed plugins.

--show-matchers PLUGIN
Show the list of matchers of a specific plugin (URL regex pattern with opt. priority and opt. name).

The output is a human-readable pseudo YAML format. Please use --json when reading matcher data programmatically.

--can-handle-url URL
Check if Streamlink has a plugin that can handle the specified URL.

Status code is 0 on success, 1 on failure.

Useful for external scripting.

--can-handle-url-no-redirect URL
Same as --can-handle-url, but without following redirects when looking up the URL.

--no-plugin-cache
Disable I/O of the plugin key-value store.

If disabled, plugins won't be able to load or store data like cookies, authentication data, etc. The data which is loaded or stored depends on each plugin implementation.

--no-plugin-sideloading
Disable automatic sideloading of third-party plugins from the default location.

See the plugin-sideloading documentation for where third-party plugins are loaded from.

--plugin-dir DIRECTORY
Load additional plugins from this directory.

Can be set multiple times to load plugins from multiple directories.

--plugin-dirs DIRECTORY
Load additional plugins from a list of comma-separated directories. (deprecated)

Network arguments
--interface INTERFACE
Select the network interface, either by IP address or by interface name.

The following optional prefixes are supported:

if!<name> interface name

host!<name> IP address or hostname

ifhost!<interface>!<host> interface name and IP address or hostname

Note

On Windows, only IP addresses are supported and prefixes are ignored.

-4
--ipv4
Resolve address names to IPv4 only. This option overrides --ipv6.

-6
--ipv6
Resolve address names to IPv6 only. This option overrides --ipv4.

Player options
-p PATH
--player PATH
Set the player executable that will be launched (unless a different output method was chosen).

Either set an absolute or relative path to the player executable, or just set the executable's name if it can be resolved from the paths of the system's PATH environment variable.

In addition to setting the player executable path, custom player arguments can be set via --player-args.

Note

In the past, --player allowed defining additional player arguments, which as a consequence required wrapping player paths that contained spaces in quotation marks. This is unsupported since release 6.0.0.

Default is: VLC player, if available.

-a ARGUMENTS
--player-args ARGUMENTS
Set a string of custom --player launch arguments that will be parsed and tokenized.

The value can contain formatting variables surrounded by curly braces, { and }. Curly brace characters can be escaped by doubling, e.g. {{ and }}.

Available formatting variables:

{playerinput}
This is the input argument that the --player will receive. For standard input (stdin), it is - (dash), but it can also be a file path or URL, depending on the options used. If unset, then the player input argument will be appended to the parsed player arguments list.

{playertitleargs}
The automatically generated player title arguments, if a supported --player was found. See --title for more. If unset, automatically generated player title arguments will be prepended to the parsed player arguments list.

Example:

streamlink -p vlc -a "--play-and-exit --no-one-instance" <url> [stream]
Default is: "".

--player-env KEY=VALUE
Add an additional environment variable to the spawned --player process, in addition to the ones inherited from the Streamlink/Python parent process. This allows setting player environment variables in config files.

Can be repeated to add multiple environment variables.

-v
--player-verbose
Write the --player's stdout/stderr output to Streamlink's stdout/stderr output.

--verbose-player
Deprecated in favor of --player-verbose.

-n
--player-fifo
Make the --player read the stream through a named pipe instead of the stdin pipe.

--fifo
Deprecated in favor of --player-fifo.

--player-http
Make the --player read the stream through HTTP instead of the stdin pipe.

--player-continuous-http
Make the --player read the stream through HTTP, but unlike --player-http, it will continuously try to open the stream if the player requests it.

This enables the handling of stream disconnects if the player is capable of reconnecting to a HTTP stream. This is usually done by setting the player to a "repeat mode".

--player-external-http
Serve stream data through HTTP without opening the --player. This is useful to allow external devices like smartphones or streaming boxes to watch streams they wouldn't be able to otherwise.

The default behavior is similar to the --player-continuous-http option, but no player program will be started, and the server will listen on all available connections instead of just in the local (loopback) interface.

See --player-external-http-interface for choosing a specific network interface, and see --player-external-http-port for choosing a non-randomized port.

Optionally, the --player-external-http-continuous option allows for disabling the continuous run-mode, so that Streamlink will stop when the stream ends.

The URLs that can be used to access the stream will be printed to the console, and the server can be interrupted using CTRL-C.

--player-external-http-continuous {yes,true,1,on,no,false,0,off}
Set the run-mode of --player-external-http to continuous or non-continuous.

In the continuous run-mode, Streamlink will keep running after the stream has ended and will wait for the next HTTP request being made unless it gets shut down via CTRL-C.

If set to non-continuous, Streamlink will stop once the stream has ended.

Default is: true.

--player-external-http-interface INTERFACE
Set the network interface on which the HTTP server will be listening on. If unset or set to 0.0.0.0, all available interfaces will be bound.

--player-external-http-port PORT
Set the port of the external HTTP server if that mode is enabled. Omit or set to 0 to use a random high ( >1024) port.

--player-passthrough TYPES
A comma-delimited list of stream types to pass to the --player as a URL to let it handle the transport of the stream instead of Streamlink.

Stream types that can be converted into a playable URL are:

hls, http

Make sure the player can handle the stream type when using this.

--player-no-close
By default, Streamlink will close the --player when the stream ends. This is to avoid "dead" GUI players lingering after Streamlink has exited.

It does however have the side-effect of sometimes closing a player before it has played back all of its cached data.

This option will instead let the player decide when to exit.

-t TITLE
--title TITLE
Change the title of the --player's window.

Please see the "Metadata variables" section of Streamlink's CLI documentation for all available metadata variables, as well as the "Plugins" section for the list of metadata variables defined in each plugin.

Only the following players are supported:

mpv

PotPlayer

VLC

Example:

streamlink -p mpv --title "{author} - {category} - {title}" <URL> [STREAM]
File output options
-O
--stdout
Write stream data to stdout instead of playing it in the --player.

-o FILENAME
--output FILENAME
Write stream data to FILENAME instead of playing it in the --player. If FILENAME is set to - (dash), then the stream data will be written to stdout, similar to the --stdout argument.

Directories and subdirectories will be created if they do not exist, if filesystem permissions allow.

Unless --force is set, Streamlink will ask for confirmation before writing if FILENAME already exists.

Please see the "Metadata variables" section of Streamlink's CLI documentation for all available metadata variables, as well as the "Plugins" section for the list of metadata variables defined in each plugin.

Unsupported characters in substituted variables will be replaced with an underscore.

Example:

streamlink --output "~/recordings/{author}/{category}/{id}-{time:%Y%m%d%H%M%S}.ts" <URL> [STREAM]
-r FILENAME
--record FILENAME
Write stream data to FILENAME while at the same time allowing playback in the --player or writing it to --stdout. If FILENAME is set to - (dash), then the stream data will be written to stdout, similar to the --stdout argument, while still opening the player.

Directories and subdirectories will be created if they do not exist, if filesystem permissions allow.

Unless --force is set, Streamlink will ask for confirmation before writing if FILENAME already exists.

Please see the "Metadata variables" section of Streamlink's CLI documentation for all available metadata variables, as well as the "Plugins" section for the list of metadata variables defined in each plugin.

Unsupported characters in substituted variables will be replaced with an underscore.

Example:

streamlink --record "~/recordings/{author}/{category}/{id}-{time:%Y%m%d%H%M%S}.ts" <URL> [STREAM]
-R FILENAME
--record-and-pipe FILENAME
Deprecated in favor of --stdout --record=FILENAME.

--fs-safe-rules {POSIX,Windows}
The rules used to make formatting variables filesystem-safe are chosen automatically according to the type of system in use. This overrides the automatic detection.

Intended for use when Streamlink is running on a UNIX-like OS but writing to Windows filesystems such as NTFS; USB devices using VFAT or exFAT; CIFS shares that are enforcing Windows filename limitations, etc.

These characters are replaced with an underscore for the rules in use:

POSIX: \x00-\x1F /

Windows: \x00-\x1F \x7F " * / : < > ? \ |

-f
--force
When using --output or --record, always write to file even if it already exists (overwrite).

--skip
When using --output or --record, never write to file if it already exists (don't prompt).

Takes precedence over --force.

--progress {yes,force,no}
When using --output or --record, show or hide the download progress bar, or force it if there's no terminal.

Default is: yes.

Stream options
--url URL
A URL to attempt to extract streams from.

Usually, the protocol of http(s) URLs can be omitted (https://), depending on the implementation of the plugin being used.

This is an alternative to setting the URL using a positional argument and can be useful if set in a config file.

--default-stream STREAM
Stream to play.

Use best or worst for selecting the highest or lowest available quality.

Fallback streams can be specified by using a comma-separated list:

"720p,480p,best"
This is an alternative to setting the stream using a positional argument and can be useful if set in a config file.

--stream-url
If possible, translate the resolved stream to a URL and print it.

--retry-streams DELAY
Retry fetching the list of available streams until streams are found while waiting DELAY second(s) between each attempt.

The number of retry attempts can be capped with --retry-max. A default value of 1 is implied for non-zero values of --retry-max.

If both --retry-streams and --retry-max are set to 0, then only one attempt will be made to fetch the list of available streams. This is the default behavior.

--retry-max COUNT
Stop fetching the list of available streams after COUNT retry attempt(s).

A value of 0 makes Streamlink fetch streams indefinitely if --retry-streams is set to a non-zero value. If --retry-streams is unset, then the default delay between fetching available streams is 1 second.

--retry-open ATTEMPTS
After a successful fetch, try ATTEMPTS time(s) to open the stream until giving up.

Default is: 1.

--stream-types TYPES
--stream-priority TYPES
A comma-delimited list of stream types to allow.

The order will be used to separate streams when there are multiple streams with the same name but different stream types. Any stream type not listed will be omitted from the available streams list. An * (asterisk) can be used as a wildcard to match any other type of stream, e.g. dash.

Default is: "hls,http,*".

--stream-sorting-excludes STREAMS
Fine-tune the best and worst stream name synonyms by excluding unwanted streams.

If all of the available streams get excluded, best and worst will become inaccessible and new special stream synonyms best-unfiltered and worst-unfiltered can be used as a fallback selection method.

The filter-expression's format is:

[operator]<value>
Valid operators are >, >=, < and <=. If no operator is specified then equality is tested.

For example this will exclude streams ranked higher than "480p":

--stream-sorting-excludes ">480p"
Multiple filters can be used by separating each expression with a comma.

For example this will exclude streams from two quality types:

--stream-sorting-excludes ">480p,>medium"
Stream transport options
--ringbuffer-size SIZE
The maximum size of the ringbuffer.

Mebibytes or kibibytes (base 2) can be specified via the M or K suffix respectively.

The ringbuffer is used as a temporary storage between the stream and the player. This allows Streamlink to download the stream faster than the player which reads the data from the ringbuffer.

The smaller the size of the ringbuffer, the higher the chance of the player buffering if the download speed decreases, and the higher the size, the more data can be use as a storage to recover from volatile download speeds.

Most players have their own additional cache and will read the ringbuffer's content as soon as data is available. If the player stops reading data while playback is paused, Streamlink will continue to download the stream in the background as long as the ringbuffer doesn't get full.

Default is: "16M".

--stream-segment-attempts ATTEMPTS
The number of download attempts of each stream segment before giving up.

This applies to all different kinds of segmented stream types, such as DASH, HLS, etc.

Default is: 3.

--stream-segment-threads THREADS
The size of the thread pool used to download segments. Minimum value is 1 and maximum is 10.

This applies to all different kinds of segmented stream types, such as DASH, HLS, etc.

Default is: 1.

--stream-segment-timeout TIMEOUT
The maximum time to wait for each segment to start downloading.

This applies to all different kinds of segmented stream types, such as DASH, HLS, etc.

Default is: 10.0.

--stream-segmented-duration [[XX:]XX:]XX[.XX] | [XXh][XXm][XX[.XX]s]
Limit the output duration of segmented streams, like HLS and DASH. The actual duration may be slightly longer, as it is rounded to the nearest segment.

Set to 0 to disable.

Default is: 0.

--stream-segmented-queue-deadline FACTOR
A multiplication factor of the time frame in which new segments must be queued in order to prevent playback issues due to lack of video/audio data. If this segment-queue-deadline has not been met, the stream will be stopped early.

The intention of this segment-queue-deadline is to be able to stop early when the end of a stream is not announced by the server, so Streamlink doesn't have to wait until a buffer read-timeout occurs. See --stream-timeout.

The base time this multiplication factor is applied to depends on the specific stream implementation and the respective values returned by the streaming server. This deadline check is done after trying to fetch new data.

Set to 0 to disable.

Default is: 3.0.

By default, wait three times as long for new segments to be made available than the server's advertised time frame.

--stream-timeout TIMEOUT
The maximum time to wait for an unfiltered stream to continue outputting data.

This applies to all different kinds of stream types, such as DASH, HLS, HTTP, etc.

Default is: 60.0.

--mux-subtitles
Automatically mux available subtitles into the output stream.

Needs to be supported by the used plugin.

HLS options
--hls-live-edge SEGMENTS
Number of segments from the live stream's current live position to begin streaming. The size or length of each segment is determined by the streaming provider.

Lower values will decrease the latency, but will also increase the chance of buffering, as there is less time for Streamlink to download segments and write their data to the output buffer. The number of parallel segment downloads can be set with --stream-segment-threads and the HLS playlist reload time to fetch and queue new segments can be overridden with --hls-playlist-reload-time.

Default is: 3.

Note

During live playback, the caching/buffering settings of the used player will add additional latency. To adjust this, please refer to the player's own documentation for the required configuration. Player parameters can be set via --player-args.

--hls-segment-stream-data
Immediately write segment data into output buffer while downloading.

--hls-playlist-reload-attempts ATTEMPTS
The maximum number of attempts when reloading the HLS playlist before giving up.

Default is: 3.

--hls-playlist-reload-time TIME
Set a custom HLS playlist reload time value, either in seconds or by using one of the following keywords:

segment: The duration of the last segment in the current playlist

live-edge: The sum of segment durations of the live edge value minus one

default: The playlist's target duration metadata

Default is: default.

--hls-segment-queue-threshold FACTOR
Deprecated in favor of --stream-segmented-queue-deadline.

--hls-segment-ignore-names NAMES
A comma-delimited list of segment names that will get filtered out.

Example: --hls-segment-ignore-names 000,001,002

This will ignore every segment that ends with 000.ts, 001.ts and 002.ts

Default is: None.

--hls-segment-key-uri URI
Override the segment encryption key URIs for encrypted streams.

The value can be templated using the following variables, which will be replaced with their respective part from the source segment URI:

{url} {scheme} {netloc} {path} {query}
Examples:

--hls-segment-key-uri "<https://example.com/hls/encryption_key>"
--hls-segment-key-uri "{scheme}://1.2.3.4{path}{query}"
--hls-segment-key-uri "{scheme}://{netloc}/custom/path/to/key"
Default is: None.

--hls-audio-select CODE
Select one or more specific audio sources by language code or name. Can be set to * (asterisk) to include all audio sources.

Examples:

--hls-audio-select "English,German"
--hls-audio-select "en,de"
--hls-audio-select "*"
Note

This is only useful in special circumstances where the regular locale option fails, such as when multiple sources of the same language exist.

--hls-start-offset [[XX:]XX:]XX[.XX] | [XXh][XXm][XX[.XX]s]
The amount of time to skip from the beginning of the stream. For live streams, this is a negative offset from the end of the stream (rewind).

Default is: 0.

--hls-duration [[XX:]XX:]XX[.XX] | [XXh][XXm][XX[.XX]s]
Deprecated in favor of --stream-segmented-duration.

--hls-live-restart
Skip to the beginning of a live stream, or as far back as possible.

DASH options
--dash-manifest-reload-attempts ATTEMPTS
The maximum number of attempts when reloading the DASH manifest before giving up.

Default is: 3.

FFmpeg options
--ffmpeg-ffmpeg FILENAME
Set the location of the FFmpeg executable if it can't be resolved from the paths of the system's PATH environment variable.

FFmpeg is required to access or mux separate video and audio streams, e.g. in DASH streams or HLS streams with multiple sources.

Example: --ffmpeg-ffmpeg "/usr/local/bin/ffmpeg"

--ffmpeg-no-validation
Disable FFmpeg validation and version logging.

--ffmpeg-verbose
Write FFmpeg's stderr output to Streamlink's stderr output.

--ffmpeg-verbose-path PATH
Write FFmpeg's stderr output to PATH.

--ffmpeg-loglevel LOGLEVEL
Change FFmpeg's -loglevel value to LOGLEVEL.

Unless --ffmpeg-verbose or --ffmpeg-verbose-path is set, changing the log level won't have any effect.

Default is: "info".

--ffmpeg-fout OUTFORMAT
Set the output format to OUTFORMAT. This only applies to streams which require muxing.

Default is: "matroska".

Example: --ffmpeg-fout "mpegts"

--ffmpeg-video-transcode CODEC
Transcode the video to CODEC. This only applies to streams which require muxing.

Default is: "copy".

Example: --ffmpeg-video-transcode "h264"

--ffmpeg-audio-transcode CODEC
Transcode the audio to CODEC. This only applies to streams which require muxing.

Default is: "copy".

Example: --ffmpeg-audio-transcode "aac"

--ffmpeg-copyts
Set the -copyts FFmpeg option, so input timestamps won't be processed and the initial start time offset value be kept.

--ffmpeg-start-at-zero
Enable the -start_at_zero FFmpeg option when using --ffmpeg-copyts.

--ffmpeg-validation-timeout SECONDS
Timeout in seconds for FFmpeg version validation.

Default is: 4.0.

Increase this on low-power systems if FFmpeg startup is slow.

HTTP options
--http-proxy HTTP_PROXY
An HTTP proxy to use for all HTTP and HTTPS requests, including WebSocket connections.

Example: --http-proxy "<http://hostname:port/>"

--http-cookie KEY=VALUE
A cookie to add to each HTTP request.

Can be repeated to add multiple cookies.

--http-cookies-file PATH
A path to a cookies file whose cookie data will be added to HTTP requests.

Can be repeated to add multiple cookie files.

The file format must adhere to the Netscape HTTP Cookie File format (MozillaCookieJar, curl, etc.), also known as cookies.txt. Be aware that this format loses information about RFC 2965 cookies, and also about newer or non-standard cookie-attributes such as port.

Unlike --http-cookie, which sends data with every request, this option enables granular control by respecting domain, path, and other cookie attributes.

--http-header KEY=VALUE
A header to add to each HTTP request.

Can be repeated to add multiple headers.

--http-query-param KEY=VALUE
A query parameter to add to each HTTP request.

Can be repeated to add multiple query parameters.

--http-ignore-env
Ignore HTTP settings set in the environment, such as environment variables (HTTP_PROXY, etc) or ~/.netrc authentication.

--http-no-ssl-verify
Don't attempt to verify TLS/SSL certificates.

Use with caution, as it has TLS/SSL security implications.

--http-disable-dh
Disable Diffie Hellman key exchange.

Use with caution, as it has TLS/SSL security implications.

--http-ssl-cert PEM_FILENAME
SSL certificate to use: a .pem file.

--http-ssl-cert-crt-key CRT_FILENAME KEY_FILENAME
SSL certificate to use: a .crt and a .key file.

--http-timeout TIMEOUT
Set the general timeout value used by all HTTP requests except the ones covered by other options.

Default is: 20.0.

Web browser options
--webbrowser {yes,true,1,on,no,false,0,off}
Enable or disable support for Streamlink's webbrowser API.

Streamlink's webbrowser API allows plugins which implement it to launch a web browser and extract data from websites which they otherwise couldn't do via the regular HTTP session in Python due to specific JavaScript restrictions.

The web browser is run isolated and in a clean environment without access to regular user data.

Streamlink currently only supports Chromium-based web browsers using the Chrome Devtools Protocol (CDP). This includes Chromium itself, Google Chrome, Microsoft Edge, Brave, Vivaldi, and others, but full support for third party Chromium forks is not guaranteed. Please try Chromium or Google Chrome when encountering any issues.

Default is: true.

--webbrowser-executable PATH
Path to the web browser's executable.

By default, it is looked up automatically according to the rules of the used webbrowser API implementation. This usually involves a list of known executable names and fallback paths on all supported operating systems.

--webbrowser-timeout TIME
The maximum amount of time which the web browser can take to launch and execute.

--webbrowser-cdp-host HOST
Host for the web browser's inter-process communication interface (CDP specific).

Default is: 127.0.0.1.

--webbrowser-cdp-port PORT
Port for the web browser's inter-process communication interface (CDP specific).

Tries to find a free port by default.

--webbrowser-cdp-timeout TIME
The maximum amount of time for waiting on a single CDP command response.

--webbrowser-headless {yes,true,1,on,no,false,0,off}
Whether to launch the web browser in headless mode or not. When enabled, it stays completely hidden and doesn't require a desktop environment to run.

Please be aware that headless mode might be blocked by websites which implement bot detections.

Default is: false.

Tutorial
========

Introduction
------------

Streamlink is a command-line application, which means that the commands described
here should be typed into a terminal, or to be more precise, into a command-line shell.

On Windows, you have to open either the `Windows Terminal`_(recommended), `PowerShell`_ or `Command Prompt`_(discouraged).
On macOS, open the `Terminal <macOS Terminal_>`_ app, and if you're on Linux or BSD,
the terminal emulator depends on your desktop environment and its configuration.

The way Streamlink works is that it's only a means to extract and transport
the streams, and the playback is done by an external video player. Streamlink
works best with `VLC`_or `mpv`_, which are also cross-platform, but other players
may be compatible too, see the :ref:`Players <players:Players>` page for a complete overview.

Getting started
---------------

Now to get into actually using Streamlink, let's say you want to watch the
stream located on ``https://www.twitch.tv/CHANNEL``, you start off by telling Streamlink
where to attempt to extract streams from. This is done by setting the URL as the
first argument on the :command:`streamlink` command:

.. code-block:: console

    $ streamlink twitch.tv/CHANNEL
    [cli][info] Found matching plugin twitch for URL twitch.tv/CHANNEL
    Available streams: audio_only, 160p (worst), 360p, 480p, 720p60, 1080p60 (best)

.. note::
    You don't need to include the protocol when dealing with HTTP(s) URLs,
    e.g. just ``twitch.tv/CHANNEL`` is enough and quicker to type.

.. caution::

    Depending on the command-line shell in use, any kind of command argument like the input URL for example
    may need to get quoted or escaped. See the `Shell syntax`_ section down below.

This command will tell Streamlink to attempt to extract streams from the URL
specified via its :ref:`plugins system <plugins:Plugins>` which is responsible for resolving streams from specific
streaming services. If it's successful, Streamlink will print out a list of available streams to choose from.

In addition to Streamlink's plugins system, direct stream URLs can be played via the
:ref:`supported streaming protocols <cli/protocols:Streaming protocols>`, which also support playback of local files
using the ``file://`` protocol. Relative file paths and absolute paths are supported. All path separators are ``/``,
even on Windows.

.. code-block:: console

    $ streamlink hls://file://C:/hls/playlist.m3u8
    [cli][info] Found matching plugin stream for URL hls://file://C:/hls/playlist.m3u8
    Available streams: 180p (worst), 272p, 408p, 554p, 818p, 1744p (best)

To select a stream and start playback, simply add the stream name as a second
argument to the :command:`streamlink` command:

.. code-block:: console

    $ streamlink twitch.tv/CHANNEL 1080p60
    [cli][info] Found matching plugin twitch for URL twitch.tv/CHANNEL
    [cli][info] Opening stream: 1080p60 (hls)
    [cli][info] Starting player: vlc

The stream you chose should now be playing in the player. It's a common use case
to just want to start the highest quality stream and not be bothered with what it's
named. To do this, just specify ``best`` as the stream name and Streamlink will
attempt to rank the streams and open the one of highest quality. You can also
specify ``worst`` to get the lowest quality.

Now that you have a basic grasp of how Streamlink works, you may want to look
into customizing it to your own needs, such as:

- Creating a :ref:`configuration file <cli/config:Configuration file>` of options you want to use.
- Setting up your player to cache some data before playing the stream to help avoiding buffering issues
  or reducing its default buffering values for being able to watch low-latency streams.

.. _Command Prompt: <https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/windows-commands>
.._PowerShell: <https://docs.microsoft.com/en-us/powershell/>
.. _Windows Terminal: <https://docs.microsoft.com/en-us/windows/terminal/get-started>
.._macOS Terminal: <https://support.apple.com/guide/terminal/welcome/mac>
.. _VLC: <https://videolan.org/>
.._mpv: <https://mpv.io/>

Shell syntax
------------

Depending on your used command-line shell and how you've entered the command,
input strings like the URL or other command arguments may need to get `escaped <escape-character_>`_ or quoted,
because command-line shells interpret and treat certain characters as special symbols which can alter the shell's behavior,
like characters for substituting/expanding strings, delimiting commands, path/file globbing, etc.

The most relevant characters (among others) for input URLs that can cause unexpected results are

- ``&``, ``;`` (command delimiting)
- ``$``, ``%`` (variable substitution)
- ``?``, ``*`` (path globbing)

The quoting and escaping behavior varies wildly between each shell and its configuration,
so please take a look at your shell's documentation about all the details, if you're unsure.

**Quoting and character escaping examples:**

URL: ``https://example/path?a=$one&b=%two%&c=*three*;&``

.. tab-set::

    .. tab-item:: POSIX compliant

        - `BASH manual <bash_>`_
        - `ZSH manual <zsh_>`_

        .. code-block:: sh

            streamlink 'https://example/path?a=$one&b=%two%&c=*three*;&'
            streamlink "https://example/path?a=\$one&b=%two%&c=*three*;&"
            streamlink https://example/path?a=\$one\&b=%two%\&c=*three*\;\&

    .. tab-item:: FISH

        - `FISH language documentation <fish_>`_

        .. code-block:: fish

            streamlink 'https://example/path?a=$one&b=%two%&c=*three*;&'
            streamlink "https://example/path?a=\$one&b=%two%&c=*three*;&"
            streamlink https://example/path\?a=\$one&b=%two%&c=\*three\*\;\&

    .. tab-item:: PowerShell

        - `PowerShell language specification <pwsh_>`_

        .. code-block:: pwsh

            streamlink 'https://example/path?a=$one&b=%two%&c=*three*;&'
            streamlink "https://example/path?a=`$one&b=%two%&c=*three*;&"
            streamlink https://example/path?a=`$one`&b=%two%`&c=*three*`;`&

    .. tab-item:: Windows Batch

        - `Escape characters, delimiters and quotes <batch-ss64_>`_
        - `Percent sign escaping <batch-so_>`_

        .. code-block:: bat

            streamlink "https://example/path?a=$one&b="%"two"%"&c=*three*;&"
            streamlink https://example/path?a=$one^&b=^%two^%^&c=*three*^;^&

.. _escape-character: <https://en.wikipedia.org/wiki/Escape_character>
.._bash: <https://www.gnu.org/software/bash/manual/bash.html>
.. _zsh: <https://zsh.sourceforge.io/Doc/Release/zsh_toc.html>
.._fish: <https://fishshell.com/docs/current/language.html>
.. _pwsh: <https://learn.microsoft.com/en-us/powershell/scripting/lang-spec/chapter-02>
.._batch-ss64: <https://ss64.com/nt/syntax-esc.html>
.. _batch-so: <https://stackoverflow.com/a/31420292>

Metadata
========

Variables
---------

Streamlink supports a number of metadata variables that can be used in the following CLI arguments:

- :option:`--title`
- :option:`--output`
- :option:`--record`
- :option:`--record-and-pipe`

Metadata variables are surrounded by curly braces and can be escaped by doubling the curly brace characters,
e.g. ``{variable}`` and ``{{not-a-variable}}``.

.. warning::

    The availability of each variable depends on the used plugin and whether that plugin supports this kind of metadata
    (:ref:`check the metadata availability of each plugin here <plugins:Plugins>`). Be aware that depending on the stream,
    certain metadata might not be available (yet), despite the plugin's implementation.

    If no metadata is available for a specific variable, then its substitution will either be a short placeholder text
    (:option:`--title`) or an empty string (:option:`--output`, :option:`--record`, :option:`--record-and-pipe`).

**Conditional variables**

.. list-table::
    :header-rows: 1
    :class: table-custom-layout table-custom-layout-platform-locations

    * - Variable
      - Description
    * - ``id``
      - The unique ID of the stream, e.g. an internal numeric ID or randomized string.
    * - ``author``
      - The stream's author, e.g. a channel or broadcaster name.
    * - ``category``
      - The stream's category, e.g. the name of a game being played, a music genre, etc.
    * - ``game``
      - Alias for ``category``.
    * - ``title``
      - The stream's title, usually a short descriptive text.

**Generic variables**

.. list-table::
    :header-rows: 1
    :class: table-custom-layout table-custom-layout-platform-locations

    * - Variable
      - Description
    * - ``plugin``
      - The name of the resolved plugin. See :ref:`Plugins <plugins:Plugins>` for the name of each built-in plugin.
    * - ``url``
      - The resolved URL of the stream.
    * - ``time``
      - The current timestamp. Can optionally be formatted via ``{time:format}``.

        The format parameter string is passed to Python's `datetime.strftime()`_ method,
        so all the usual time directives are available.

        The default format is ``%Y-%m-%d_%H-%M-%S``.

.. _datetime.strftime(): <https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes>

Examples
--------

.. code-block:: console

    streamlink --title "{author} - {category} - {title}" <URL> [STREAM]
    streamlink --output "~/recordings/{author}/{category}/{id}-{time:%Y%m%d%H%M%S}.ts" <URL> [STREAM]

The :option:`--json` argument always lists the conditional metadata.

.. code-block:: console

    streamlink --json twitch.tv/bobross | jq .metadata

.. code-block:: json

    {
      "id": "49163597677",
      "author": "BobRoss",
      "category": "Art",
      "title": "A Happy Little Weekend Marathon!"
    }

.. note::

    Streamlink is not designed as a tool for general-purpose metadata retrieval. If your goal is to extract metadata from
    specific streaming sites, then it's usually a better idea to implement this metadata retrieval yourself using
    the available APIs of those sites or other means.
