# OUTPUT TEMPLATE

The `-o` option is used to indicate a template for the output file names while `-P` option is used to specify the path each type of file should be saved to.

<!-- MANPAGE: BEGIN EXCLUDED SECTION -->
**tl;dr:** [navigate me to examples](#output-template-examples).
<!-- MANPAGE: END EXCLUDED SECTION -->

The simplest usage of `-o` is not to set any template arguments when downloading a single file, like in `yt-dlp -o funny_video.flv "https://some/video"` (hard-coding file extension like this is _not_ recommended and could break some post-processing).

It may however also contain special sequences that will be replaced when downloading each video. The special sequences may be formatted according to [Python string formatting operations](https://docs.python.org/3/library/stdtypes.html#printf-style-string-formatting), e.g. `%(NAME)s` or `%(NAME)05d`. To clarify, that is a percent symbol followed by a name in parentheses, followed by formatting operations.

The field names themselves (the part inside the parenthesis) can also have some special formatting:

1. **Object traversal**: The dictionaries and lists available in metadata can be traversed by using a dot `.` separator; e.g. `%(tags.0)s`, `%(subtitles.en.-1.ext)s`. You can do Python slicing with colon `:`; E.g. `%(id.3:7)s`, `%(id.6:2:-1)s`, `%(formats.:.format_id)s`. Curly braces `{}` can be used to build dictionaries with only specific keys; e.g. `%(formats.:.{format_id,height})#j`. An empty field name `%()s` refers to the entire infodict; e.g. `%(.{id,title})s`. Note that all the fields that become available using this method are not listed below. Use `-j` to see such fields

1. **Arithmetic**: Simple arithmetic can be done on numeric fields using `+`, `-` and `*`. E.g. `%(playlist_index+10)03d`, `%(n_entries+1-playlist_index)d`

1. **Date/time Formatting**: Date/time fields can be formatted according to [strftime formatting](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes) by specifying it separated from the field name using a `>`. E.g. `%(duration>%H-%M-%S)s`, `%(upload_date>%Y-%m-%d)s`, `%(epoch-3600>%H-%M-%S)s`

1. **Alternatives**: Alternate fields can be specified separated with a `,`. E.g. `%(release_date>%Y,upload_date>%Y|Unknown)s`

1. **Replacement**: A replacement value can be specified using a `&` separator according to the [`str.format` mini-language](https://docs.python.org/3/library/string.html#format-specification-mini-language). If the field is _not_ empty, this replacement value will be used instead of the actual field content. This is done after alternate fields are considered; thus the replacement is used if _any_ of the alternative fields is _not_ empty. E.g. `%(chapters&has chapters|no chapters)s`, `%(title&TITLE={:>20}|NO TITLE)s`

1. **Default**: A literal default value can be specified for when the field is empty using a `|` separator. This overrides `--output-na-placeholder`. E.g. `%(uploader|Unknown)s`

1. **More Conversions**: In addition to the normal format types `diouxXeEfFgGcrs`, yt-dlp additionally supports converting to `B` = **B**ytes, `j` = **j**son (flag `#` for pretty-printing, `+` for Unicode), `h` = HTML escaping, `l` = a comma-separated **l**ist (flag `#` for `\n` newline-separated), `q` = a string **q**uoted for the terminal (flag `#` to split a list into different arguments), `D` = add **D**ecimal suffixes (e.g. 10M) (flag `#` to use 1024 as factor), and `S` = **S**anitize as filename (flag `#` for restricted)

1. **Unicode normalization**: The format type `U` can be used for NFC [Unicode normalization](https://docs.python.org/3/library/unicodedata.html#unicodedata.normalize). The alternate form flag (`#`) changes the normalization to NFD and the conversion flag `+` can be used for NFKC/NFKD compatibility equivalence normalization. E.g. `%(title)+.100U` is NFKC

To summarize, the general syntax for a field is:

```
%(name[.keys][addition][>strf][,alternate][&replacement][|default])[flags][width][.precision][length]type
```

Additionally, you can set different output templates for the various metadata files separately from the general output template by specifying the type of file followed by the template separated by a colon `:`. The different file types supported are `subtitle`, `thumbnail`, `description`, `annotation` (deprecated), `infojson`, `link`, `pl_thumbnail`, `pl_description`, `pl_infojson`, `chapter`, `pl_video`. E.g. `-o "%(title)s.%(ext)s" -o "thumbnail:%(title)s\%(title)s.%(ext)s"` will put the thumbnails in a folder with the same name as the video. If any of the templates is empty, that type of file will not be written. E.g. `--write-thumbnail -o "thumbnail:"` will write thumbnails only for playlists and not for video.

<a id="outtmpl-postprocess-note"></a>

**Note**: Due to post-processing (i.e. merging etc.), the actual output filename might differ. Use `--print after_move:filepath` to get the name after all post-processing is complete.

The available fields are:

- `id` (string): Video identifier
- `title` (string): Video title
- `fulltitle` (string): Video title ignoring live timestamp and generic title
- `ext` (string): Video filename extension
- `alt_title` (string): A secondary title of the video
- `description` (string): The description of the video
- `display_id` (string): An alternative identifier for the video
- `uploader` (string): Full name of the video uploader
- `uploader_id` (string): Nickname or id of the video uploader
- `uploader_url` (string): URL to the video uploader's profile
- `license` (string): License name the video is licensed under
- `creators` (list): The creators of the video
- `creator` (string): The creators of the video; comma-separated
- `timestamp` (numeric): UNIX timestamp of the moment the video became available
- `upload_date` (string): Video upload date in UTC (YYYYMMDD)
- `release_timestamp` (numeric): UNIX timestamp of the moment the video was released
- `release_date` (string): The date (YYYYMMDD) when the video was released in UTC
- `release_year` (numeric): Year (YYYY) when the video or album was released
- `modified_timestamp` (numeric): UNIX timestamp of the moment the video was last modified
- `modified_date` (string): The date (YYYYMMDD) when the video was last modified in UTC
- `channel` (string): Full name of the channel the video is uploaded on
- `channel_id` (string): Id of the channel
- `channel_url` (string): URL of the channel
- `channel_follower_count` (numeric): Number of followers of the channel
- `channel_is_verified` (boolean): Whether the channel is verified on the platform
- `location` (string): Physical location where the video was filmed
- `duration` (numeric): Length of the video in seconds
- `duration_string` (string): Length of the video (HH:mm:ss)
- `view_count` (numeric): How many users have watched the video on the platform
- `concurrent_view_count` (numeric): How many users are currently watching the video on the platform.
- `like_count` (numeric): Number of positive ratings of the video
- `dislike_count` (numeric): Number of negative ratings of the video
- `repost_count` (numeric): Number of reposts of the video
- `average_rating` (numeric): Average rating given by users, the scale used depends on the webpage
- `comment_count` (numeric): Number of comments on the video (For some extractors, comments are only downloaded at the end, and so this field cannot be used)
- `save_count` (numeric): Number of times the video has been saved or bookmarked
- `age_limit` (numeric): Age restriction for the video (years)
- `live_status` (string): One of "not_live", "is_live", "is_upcoming", "was_live", "post_live" (was live, but VOD is not yet processed)
- `is_live` (boolean): Whether this video is a live stream or a fixed-length video
- `was_live` (boolean): Whether this video was originally a live stream
- `playable_in_embed` (string): Whether this video is allowed to play in embedded players on other sites
- `availability` (string): Whether the video is "private", "premium_only", "subscriber_only", "needs_auth", "unlisted" or "public"
- `media_type` (string): The type of media as classified by the site, e.g. "episode", "clip", "trailer"
- `start_time` (numeric): Time in seconds where the reproduction should start, as specified in the URL
- `end_time` (numeric): Time in seconds where the reproduction should end, as specified in the URL
- `extractor` (string): Name of the extractor
- `extractor_key` (string): Key name of the extractor
- `epoch` (numeric): Unix epoch of when the information extraction was completed
- `autonumber` (numeric): Number that will be increased with each download, starting at `--autonumber-start`, padded with leading zeros to 5 digits
- `video_autonumber` (numeric): Number that will be increased with each video
- `n_entries` (numeric): Total number of extracted items in the playlist
- `playlist_id` (string): Identifier of the playlist that contains the video
- `playlist_title` (string): Name of the playlist that contains the video
- `playlist` (string): `playlist_title` if available or else `playlist_id`
- `playlist_count` (numeric): Total number of items in the playlist. May not be known if entire playlist is not extracted
- `playlist_index` (numeric): Index of the video in the playlist padded with leading zeros according the final index
- `playlist_autonumber` (numeric): Position of the video in the playlist download queue padded with leading zeros according to the total length of the playlist
- `playlist_uploader` (string): Full name of the playlist uploader
- `playlist_uploader_id` (string): Nickname or id of the playlist uploader
- `playlist_channel` (string): Display name of the channel that uploaded the playlist
- `playlist_channel_id` (string): Identifier of the channel that uploaded the playlist
- `playlist_webpage_url` (string): URL of the playlist webpage
- `webpage_url` (string): A URL to the video webpage which, if given to yt-dlp, should yield the same result again
- `webpage_url_basename` (string): The basename of the webpage URL
- `webpage_url_domain` (string): The domain of the webpage URL
- `original_url` (string): The URL given by the user (or the same as `webpage_url` for playlist entries)
- `categories` (list): List of categories the video belongs to
- `tags` (list): List of tags assigned to the video
- `cast` (list): List of cast members

All the fields in [Filtering Formats](#filtering-formats) can also be used

Available for the video that belongs to some logical chapter or section:

- `chapter` (string): Name or title of the chapter the video belongs to
- `chapter_number` (numeric): Number of the chapter the video belongs to
- `chapter_id` (string): Id of the chapter the video belongs to

Available for the video that is an episode of some series or program:

- `series` (string): Title of the series or program the video episode belongs to
- `series_id` (string): Id of the series or program the video episode belongs to
- `season` (string): Title of the season the video episode belongs to
- `season_number` (numeric): Number of the season the video episode belongs to
- `season_id` (string): Id of the season the video episode belongs to
- `episode` (string): Title of the video episode
- `episode_number` (numeric): Number of the video episode within a season
- `episode_id` (string): Id of the video episode

Available for the media that is a track or a part of a music album:

- `track` (string): Title of the track
- `track_number` (numeric): Number of the track within an album or a disc
- `track_id` (string): Id of the track
- `artists` (list): Artist(s) of the track
- `artist` (string): Artist(s) of the track; comma-separated
- `genres` (list): Genre(s) of the track
- `genre` (string): Genre(s) of the track; comma-separated
- `composers` (list): Composer(s) of the piece
- `composer` (string): Composer(s) of the piece; comma-separated
- `album` (string): Title of the album the track belongs to
- `album_type` (string): Type of the album
- `album_artists` (list): All artists appeared on the album
- `album_artist` (string): All artists appeared on the album; comma-separated
- `disc_number` (numeric): Number of the disc or other physical medium the track belongs to

Available only when using `--download-sections` and for `chapter:` prefix when using `--split-chapters` for videos with internal chapters:

- `section_title` (string): Title of the chapter
- `section_number` (numeric): Number of the chapter within the file
- `section_start` (numeric): Start time of the chapter in seconds
- `section_end` (numeric): End time of the chapter in seconds

Available only when used in `--print`:

- `urls` (string): The URLs of all requested formats, one in each line
- `filename` (string): Name of the video file. Note that the [actual filename may differ](#outtmpl-postprocess-note)
- `formats_table` (table): The video format table as printed by `--list-formats`
- `thumbnails_table` (table): The thumbnail format table as printed by `--list-thumbnails`
- `subtitles_table` (table): The subtitle format table as printed by `--list-subs`
- `automatic_captions_table` (table): The automatic subtitle format table as printed by `--list-subs`

 Available only after the video is downloaded (`post_process`/`after_move`):

- `filepath`: Actual path of downloaded video file

Available only in `--sponsorblock-chapter-title`:

- `start_time` (numeric): Start time of the chapter in seconds
- `end_time` (numeric): End time of the chapter in seconds
- `categories` (list): The [SponsorBlock categories](https://wiki.sponsor.ajay.app/w/Types#Category) the chapter belongs to
- `category` (string): The smallest SponsorBlock category the chapter belongs to
- `category_names` (list): Friendly names of the categories
- `name` (string): Friendly name of the smallest category
- `type` (string): The [SponsorBlock action type](https://wiki.sponsor.ajay.app/w/Types#Action_Type) of the chapter

Each aforementioned sequence when referenced in an output template will be replaced by the actual value corresponding to the sequence name. E.g. for `-o %(title)s-%(id)s.%(ext)s` and an mp4 video with title `yt-dlp test video` and id `BaW_jenozKc`, this will result in a `yt-dlp test video-BaW_jenozKc.mp4` file created in the current directory.

**Note**: Some of the sequences are not guaranteed to be present, since they depend on the metadata obtained by a particular extractor. Such sequences will be replaced with placeholder value provided with `--output-na-placeholder` (`NA` by default).

**Tip**: Look at the `-j` output to identify which fields are available for the particular URL

For numeric sequences, you can use [numeric related formatting](https://docs.python.org/3/library/stdtypes.html#printf-style-string-formatting); e.g. `%(view_count)05d` will result in a string with view count padded with zeros up to 5 characters, like in `00042`.

Output templates can also contain arbitrary hierarchical path, e.g. `-o "%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"` which will result in downloading each video in a directory corresponding to this path template. Any missing directory will be automatically created for you.

To use percent literals in an output template use `%%`. To output to stdout use `-o -`.

The current default template is `%(title)s [%(id)s].%(ext)s`.

In some cases, you don't want special characters such as 中, spaces, or &, such as when transferring the downloaded filename to a Windows system or the filename through an 8bit-unsafe channel. In these cases, add the `--restrict-filenames` flag to get a shorter title.

#### Output template examples

```bash
$ yt-dlp --print filename -o "test video.%(ext)s" BaW_jenozKc
test video.webm    # Literal name with correct extension

$ yt-dlp --print filename -o "%(title)s.%(ext)s" BaW_jenozKc
youtube-dl test video ''_ä↭𝕐.webm    # All kinds of weird characters

$ yt-dlp --print filename -o "%(title)s.%(ext)s" BaW_jenozKc --restrict-filenames
youtube-dl_test_video_.webm    # Restricted file name

# Download YouTube playlist videos in separate directory indexed by video order in a playlist
$ yt-dlp -o "%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" "https://www.youtube.com/playlist?list=PLwiyx1dc3P2JR9N8gQaQN_BCvlSlap7re"

# Download YouTube playlist videos in separate directories according to their uploaded year
$ yt-dlp -o "%(upload_date>%Y)s/%(title)s.%(ext)s" "https://www.youtube.com/playlist?list=PLwiyx1dc3P2JR9N8gQaQN_BCvlSlap7re"

# Prefix playlist index with " - " separator, but only if it is available
$ yt-dlp -o "%(playlist_index&{} - |)s%(title)s.%(ext)s" BaW_jenozKc "https://www.youtube.com/user/TheLinuxFoundation/playlists"

# Download all playlists of YouTube channel/user keeping each playlist in separate directory:
$ yt-dlp -o "%(uploader)s/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" "https://www.youtube.com/user/TheLinuxFoundation/playlists"

# Download Udemy course keeping each chapter in separate directory under MyVideos directory in your home
$ yt-dlp -u user -p password -P "~/MyVideos" -o "%(playlist)s/%(chapter_number)s - %(chapter)s/%(title)s.%(ext)s" "https://www.udemy.com/java-tutorial"

# Download entire series season keeping each series and each season in separate directory under C:/MyVideos
$ yt-dlp -P "C:/MyVideos" -o "%(series)s/%(season_number)s - %(season)s/%(episode_number)s - %(episode)s.%(ext)s" "https://videomore.ru/kino_v_detalayah/5_sezon/367617"

# Download video as "C:\MyVideos\uploader\title.ext", subtitles as "C:\MyVideos\subs\uploader\title.ext"
# and put all temporary files in "C:\MyVideos\tmp"
$ yt-dlp -P "C:/MyVideos" -P "temp:tmp" -P "subtitle:subs" -o "%(uploader)s/%(title)s.%(ext)s" BaW_jenozKc --write-subs

# Download video as "C:\MyVideos\uploader\title.ext" and subtitles as "C:\MyVideos\uploader\subs\title.ext"
$ yt-dlp -P "C:/MyVideos" -o "%(uploader)s/%(title)s.%(ext)s" -o "subtitle:%(uploader)s/subs/%(title)s.%(ext)s" BaW_jenozKc --write-subs

# Stream the video being downloaded to stdout
$ yt-dlp -o - BaW_jenozKc
```
