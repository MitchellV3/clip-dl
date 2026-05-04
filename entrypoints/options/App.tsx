import { Provider } from '@/components/ui/provider';
import { DownloadHistoryList } from '@/entrypoints/options/download-history-list';
import { CLIP_DOWNLOADER_KEY, DOWNLOAD_HISTORY_KEY } from '@/lib/services/proxy-service-keys';
import {
    DOWNLOAD_HISTORY_PAGE_SIZE,
    type DownloadHistoryEntry,
    type DownloadHistoryPage,
    type DownloadHistoryStatus,
} from '@/lib/repos/download-history-repo';
import { getPlaySfxEnabled, setPlaySfxEnabled, getShowLiveProcessLog, setShowLiveProcessLog, watchPlaySfxEnabled, watchShowLiveProcessLog, getOrganizeByDate, setOrganizeByDate, getOrganizeBySource, setOrganizeBySource, watchOrganizeByDate, watchOrganizeBySource, getOrganizeByUploader, setOrganizeByUploader, watchOrganizeByUploader, getDownloadDirectory, setDownloadDirectory, watchDownloadDirectory, getDownloader, setDownloader, watchDownloader, getDownloadFileFormat, setDownloadFileFormat, watchDownloadFileFormat, getFileNamingTemplate, setFileNamingTemplate, watchFileNamingTemplate, getEnableScreenshotButton, setEnableScreenshotButton, watchEnableScreenshotButton, getCookiesFile, setCookiesFile, watchCookiesFile, getLiveStreamMode, setLiveStreamMode, watchLiveStreamMode } from '@/lib/repos/settings-repo';
import { createProxyService } from '@webext-core/proxy-service';
import { Box, Button, CheckboxCard, CheckboxGroup, Field, Grid, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const clipDownloader = createProxyService(CLIP_DOWNLOADER_KEY);
const historyRepo = createProxyService(DOWNLOAD_HISTORY_KEY);
const HISTORY_PAGE_SIZE = DOWNLOAD_HISTORY_PAGE_SIZE;

export default function App() {
    const [historyPage, setHistoryPage] = useState<DownloadHistoryPage | null>(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyPageIndex, setHistoryPageIndex] = useState(1);
    const [historyStatusFilter, setHistoryStatusFilter] = useState<DownloadHistoryStatus | 'all'>('all');
    const [historyQuery, setHistoryQuery] = useState('');
    const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
    const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
    const [unavailableFileEntryIds, setUnavailableFileEntryIds] = useState<string[]>([]);
    const [playSfxEnabled, setPlaySfxEnabledState] = useState(true);
    const [showLiveProcessLogEnabled, setShowLiveProcessLogState] = useState(false);
    const [organizeByDate, setOrganizeByDateState] = useState(false);
    const [organizeBySource, setOrganizeBySourceState] = useState(false);
    const [organizeByUploader, setOrganizeByUploaderState] = useState(false);
    const [selectedOrganize, setSelectedOrganize] = useState<string[]>([]);
    const [downloadDirectory, setDownloadDirectoryState] = useState('');
    const [selectedDownloader, setSelectedDownloaderState] = useState('native');
    const [selectedFileFormat, setSelectedFileFormatState] = useState('mkv');
    const [fileNamingTemplate, setFileNamingTemplateState] = useState('');
    const [templateSelection, setTemplateSelectionState] = useState('');
    const [enableScreenshotButton, setEnableScreenshotButtonState] = useState(true);
    const [cookiesFile, setCookiesFileState] = useState('');
    const [livestreamMode, setLiveStreamModeState] = useState(false);

    const checkboxItems = [
        { value: 'date', title: 'Date', description: 'Organize clips by date (Year -> Month)' },
        { value: 'source', title: 'Source', description: 'Organize clips by website (YouTube/Twitch)' },
        { value: 'uploader', title: 'Uploader', description: 'Organize clips by uploader/channel name' },
    ];

    const filterOptions = useMemo(() => ([
        { value: 'all', label: 'All Statuses' },
        { value: 'completed', label: 'Completed' },
        { value: 'error', label: 'Errors' },
        { value: 'cancelled', label: 'Cancelled' },
    ]), []);

    const downloaderList = useMemo(() => ([
        { value: 'native', label: 'Native' },
        { value: 'aria2c', label: 'Aria2' },
        { value: 'axel', label: 'Axel' },
        { value: 'curl', label: 'Curl' },
        { value: 'wget', label: 'Wget' },
        { value: 'httpie', label: 'HTTPie' },
        { value: 'ffmpeg', label: 'FFmpeg' },
    ]), []);

    const fileFormatList = useMemo(() => ([
        { value: 'mkv', label: 'MKV (Recommended)' },
        { value: 'mp4', label: 'MP4' },
    ]), []);

    const templateSelectionList = useMemo(() => ([
        { value: 'id', label: 'id', group: 'Basic Info' },
        { value: 'title', label: 'title', group: 'Basic Info' },
        { value: 'fulltitle', label: 'fulltitle', group: 'Basic Info' },
        { value: 'alt_title', label: 'alt_title', group: 'Basic Info' },
        { value: 'display_id', label: 'display_id', group: 'Basic Info' },
        { value: 'ext', label: 'ext', group: 'Basic Info' },
        { value: 'description', label: 'description', group: 'Basic Info' },
        { value: 'uploader', label: 'uploader', group: 'Basic Info' },
        { value: 'uploader_id', label: 'uploader_id', group: 'Basic Info' },
        { value: 'channel', label: 'channel', group: 'Basic Info' },
        { value: 'extractor', label: 'extractor', group: 'Basic Info' },
        { value: 'extractor_key', label: 'extractor_key', group: 'Basic Info' },
        { value: 'timestamp', label: 'timestamp', group: 'Date/Time' },
        { value: 'upload_date', label: 'upload_date', group: 'Date/Time' },
        { value: 'release_date', label: 'release_date', group: 'Date/Time' },
        { value: 'modified_date', label: 'modified_date', group: 'Date/Time' },
        { value: 'release_year', label: 'release_year', group: 'Date/Time' },
        { value: 'epoch', label: 'epoch', group: 'Date/Time' },
        { value: 'duration', label: 'duration', group: 'Duration/Stats' },
        { value: 'duration_string', label: 'duration_string', group: 'Duration/Stats' },
        { value: 'view_count', label: 'view_count', group: 'Duration/Stats' },
        { value: 'like_count', label: 'like_count', group: 'Duration/Stats' },
        { value: 'comment_count', label: 'comment_count', group: 'Duration/Stats' },
        { value: 'playlist_id', label: 'playlist_id', group: 'Playlist' },
        { value: 'playlist_title', label: 'playlist_title', group: 'Playlist' },
        { value: 'playlist_index', label: 'playlist_index', group: 'Playlist' },
        { value: 'playlist_count', label: 'playlist_count', group: 'Playlist' },
        { value: 'n_entries', label: 'n_entries', group: 'Playlist' },
        { value: 'autonumber', label: 'autonumber', group: 'Playlist' },
        { value: 'playlist_uploader', label: 'playlist_uploader', group: 'Playlist' },
        { value: 'playlist_uploader_id', label: 'playlist_uploader_id', group: 'Playlist' },
        { value: 'webpage_url', label: 'webpage_url', group: 'URLs' },
        { value: 'webpage_url_domain', label: 'webpage_url_domain', group: 'URLs' },
        { value: 'original_url', label: 'original_url', group: 'URLs' },
        { value: 'section_title', label: 'section_title', group: 'Chapters/Sections' },
        { value: 'section_number', label: 'section_number', group: 'Chapters/Sections' },
        { value: 'section_start', label: 'section_start', group: 'Chapters/Sections' },
        { value: 'section_end', label: 'section_end', group: 'Chapters/Sections' },
        { value: 'chapter', label: 'chapter', group: 'Chapters/Sections' },
        { value: 'chapter_number', label: 'chapter_number', group: 'Chapters/Sections' },
        { value: 'series', label: 'series', group: 'Series/Episode' },
        { value: 'season', label: 'season', group: 'Series/Episode' },
        { value: 'episode', label: 'episode', group: 'Series/Episode' },
        { value: 'season_number', label: 'season_number', group: 'Series/Episode' },
        { value: 'episode_number', label: 'episode_number', group: 'Series/Episode' },
        { value: 'track', label: 'track', group: 'Music/Track' },
        { value: 'album', label: 'album', group: 'Music/Track' },
        { value: 'artists', label: 'artists', group: 'Music/Track' },
        { value: 'genre', label: 'genre', group: 'Music/Track' },
        { value: 'disc_number', label: 'disc_number', group: 'Music/Track' },
        { value: 'live_status', label: 'live_status', group: 'Live/Availability' },
        { value: 'is_live', label: 'is_live', group: 'Live/Availability' },
        { value: 'was_live', label: 'was_live', group: 'Live/Availability' },
        { value: 'availability', label: 'availability', group: 'Live/Availability' },
        { value: 'age_limit', label: 'age_limit', group: 'Live/Availability' },
        { value: 'tags', label: 'tags', group: 'Other' },
        { value: 'categories', label: 'categories', group: 'Other' },
        { value: 'cast', label: 'cast', group: 'Other' },
        { value: 'license', label: 'license', group: 'Other' },
        { value: 'location', label: 'location', group: 'Other' },
        { value: 'channel_follower_count', label: 'channel_follower_count', group: 'Other' },
        { value: 'channel_is_verified', label: 'channel_is_verified', group: 'Other' },
    ]), []);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError(null);

        try {
            const offset = (historyPageIndex - 1) * HISTORY_PAGE_SIZE;
            const page = await historyRepo.getHistory({
                offset,
                limit: HISTORY_PAGE_SIZE,
                status: historyStatusFilter,
                query: historyQuery,
            }) as DownloadHistoryPage;

            setHistoryPage(page);
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : String(error));
            setHistoryPage({ entries: [], total: 0, offset: 0, limit: HISTORY_PAGE_SIZE, hasMore: false });
        } finally {
            setHistoryLoading(false);
        }
    }, [historyPageIndex, historyQuery, historyStatusFilter]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    // Load settings from storage on mount
    useEffect(() => {
        const loadSettings = async () => {
            const playSfx = await getPlaySfxEnabled();
            setPlaySfxEnabledState(playSfx);
            const showLog = await getShowLiveProcessLog();
            setShowLiveProcessLogState(showLog);
            const orgDate = await getOrganizeByDate();
            setOrganizeByDateState(orgDate);
            const orgSource = await getOrganizeBySource();
            setOrganizeBySourceState(orgSource);
            const orgUploader = await getOrganizeByUploader();
            setOrganizeByUploaderState(orgUploader);
            const dlDir = await getDownloadDirectory();
            setDownloadDirectoryState(dlDir);
            const downloader = await getDownloader();
            setSelectedDownloaderState(downloader);
            const fileFormat = await getDownloadFileFormat();
            setSelectedFileFormatState(fileFormat);
            const namingTemplate = await getFileNamingTemplate();
            setFileNamingTemplateState(namingTemplate);
            const cookiesPath = await getCookiesFile();
            setCookiesFileState(cookiesPath);
            const screenshotEnabled = await getEnableScreenshotButton();
            setEnableScreenshotButtonState(screenshotEnabled);
            const livestreamed = await getLiveStreamMode();
            setLiveStreamModeState(livestreamed);
            setSelectedOrganize([
                orgDate ? 'date' : null,
                orgSource ? 'source' : null,
                orgUploader ? 'uploader' : null,
            ].filter((v): v is string => v !== null));
        };
        void loadSettings();

        // Subscribe to setting changes
        watchPlaySfxEnabled((value) => {
            setPlaySfxEnabledState(value);
        });
        watchShowLiveProcessLog((value) => {
            setShowLiveProcessLogState(value);
        });
        watchOrganizeByDate((value) => {
            setOrganizeByDateState(value);
            setSelectedOrganize(prev => value ? [...prev, 'date'] : prev.filter(v => v !== 'date'));
        });
        watchOrganizeBySource((value) => {
            setOrganizeBySourceState(value);
            setSelectedOrganize(prev => value ? [...prev, 'source'] : prev.filter(v => v !== 'source'));
        });
        watchOrganizeByUploader((value) => {
            setOrganizeByUploaderState(value);
            setSelectedOrganize(prev => value ? [...prev, 'uploader'] : prev.filter(v => v !== 'uploader'));
        });
        watchDownloadDirectory((value) => {
            setDownloadDirectoryState(value);
        });
        watchDownloader((value) => {
            setSelectedDownloaderState(value);
        });
        watchDownloadFileFormat((value) => {
            setSelectedFileFormatState(value);
        });
        watchFileNamingTemplate((value) => {
            setFileNamingTemplateState(value);
        });
        watchCookiesFile((value) => {
            setCookiesFileState(value);
        });
        watchEnableScreenshotButton((value) => {
            setEnableScreenshotButtonState(value);
        });
        watchLiveStreamMode((value) => {
            setLiveStreamModeState(value);
        });
    }, []);

    const handleStatusFilterChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
        setHistoryPageIndex(1);
        setHistoryStatusFilter(event.target.value as DownloadHistoryStatus | 'all');
    }, []);

    const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setHistoryPageIndex(1);
        setHistoryQuery(event.target.value);
    }, []);

    const handleShowFile = useCallback(async (entry: DownloadHistoryEntry) => {
        if (!entry.outputPath) return;
        setBusyEntryId(entry.id);
        try {
            const opened = await clipDownloader.showDownloadedClipInFolder(entry.outputPath, true);
            if (!opened) {
                setUnavailableFileEntryIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);
            }
        } finally {
            setBusyEntryId(null);
        }
    }, []);

    const handleDeleteFile = useCallback(async (entry: DownloadHistoryEntry, removeEntryFromHistory: boolean) => {
        if (!entry.outputPath || entry.status !== 'completed') return;

        setBusyEntryId(entry.id);
        setDeletingEntryId(entry.id);
        try {
            const deleted = await clipDownloader.deleteFile(entry.outputPath);
            if (!deleted) {
                setUnavailableFileEntryIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);
                setHistoryError('Failed to delete the downloaded file. It may already be missing or locked by another process.');
                return;
            }

            setUnavailableFileEntryIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);

            if (removeEntryFromHistory) {
                await historyRepo.removeEntry(entry.id);
                await loadHistory();
            }

            setHistoryError(null);
        } finally {
            setBusyEntryId(null);
            setDeletingEntryId(null);
        }
    }, [loadHistory]);

    const refreshFileAvailability = useCallback(async (entries: DownloadHistoryEntry[]) => {
        const completedEntriesWithOutput = entries.filter((entry) => entry.status === 'completed' && Boolean(entry.outputPath));
        if (completedEntriesWithOutput.length === 0) {
            setUnavailableFileEntryIds([]);
            return;
        }

        const availabilityChecks = await Promise.all(
            completedEntriesWithOutput.map(async (entry) => {
                const exists = await clipDownloader.fileExists(entry.outputPath as string);
                return {
                    id: entry.id,
                    exists,
                };
            }),
        );

        setUnavailableFileEntryIds(availabilityChecks.filter((check) => !check.exists).map((check) => check.id));
    }, []);

    useEffect(() => {
        if (!historyPage) {
            setUnavailableFileEntryIds([]);
            return;
        }

        void refreshFileAvailability(historyPage.entries);
    }, [historyPage, refreshFileAvailability]);

    const handleRetry = useCallback(async (entry: DownloadHistoryEntry) => {
        setBusyEntryId(entry.id);
        try {
            await clipDownloader.downloadClip(entry.request);
            await loadHistory();
        } finally {
            setBusyEntryId(null);
        }
    }, [loadHistory]);

    const handleRemove = useCallback(async (entry: DownloadHistoryEntry) => {
        setBusyEntryId(entry.id);
        try {
            await historyRepo.removeEntry(entry.id);
            await loadHistory();
        } finally {
            setBusyEntryId(null);
        }
    }, [loadHistory]);

    const handleClear = useCallback(async () => {
        setBusyEntryId('clear');
        try {
            await historyRepo.clearHistory();
            setHistoryPageIndex(1);
            await loadHistory();
        } finally {
            setBusyEntryId(null);
        }
    }, [loadHistory]);

    const handlePlaySfxChange = useCallback(async (enabled: boolean) => {
        setPlaySfxEnabledState(enabled);
        await setPlaySfxEnabled(enabled);
    }, []);

    const handleShowLiveProcessLogChange = useCallback(async (enabled: boolean) => {
        setShowLiveProcessLogState(enabled);
        await setShowLiveProcessLog(enabled);
    }, []);

    const handleLiveStreamModeChange = useCallback(async (enabled: boolean) => {
        setLiveStreamModeState(enabled);
        await setLiveStreamMode(enabled);
    }, []);

    const handleOrganizeChange = useCallback(async (values: string[]) => {
        setSelectedOrganize(values);
        const newDate = values.includes('date');
        const newSource = values.includes('source');
        const newUploader = values.includes('uploader');
        setOrganizeByDateState(newDate);
        setOrganizeBySourceState(newSource);
        setOrganizeByUploaderState(newUploader);
        await Promise.all([
            setOrganizeByDate(newDate),
            setOrganizeBySource(newSource),
            setOrganizeByUploader(newUploader),
        ]);
    }, []);

    const handleDownloadDirectoryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDownloadDirectoryState(e.target.value);
        void setDownloadDirectory(e.target.value);
    }, []);

    const handleBrowse = useCallback(async () => {
        const path = await clipDownloader.pickDirectory();
        if (path) {
            setDownloadDirectoryState(path);
            await setDownloadDirectory(path);
        }
    }, []);

    const handleDownloaderChange = useCallback(async (downloader: string) => {
        setSelectedDownloaderState(downloader);
        await setDownloader(downloader);
    }, []);

    const handleFileFormatChange = useCallback(async (format: string) => {
        setSelectedFileFormatState(format);
        await setDownloadFileFormat(format);
    }, []);

    const handleFileNamingTemplateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFileNamingTemplateState(e.target.value);
        void setFileNamingTemplate(e.target.value);
    }, []);

    const handleCookiesFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setCookiesFileState(e.target.value);
        void setCookiesFile(e.target.value);
    }, []);

    const handleBrowseFile = useCallback(async () => {
        const path = await clipDownloader.pickFile();
        if (path) {
            setCookiesFileState(path);
            await setCookiesFile(path);
        }
    }, []);

    const handleFileNamingTemplateSelectionChange = useCallback(async (field: string) => {
        setTemplateSelectionState('');
        const newTemplate = fileNamingTemplate + (fileNamingTemplate.trim() ? ' ' : '') + `%(${field})s`;
        setFileNamingTemplateState(newTemplate);
        void setFileNamingTemplate(newTemplate);
    }, [fileNamingTemplate]);

    const handleScreenshotButtonChange = useCallback(async (enabled: boolean) => {
        setEnableScreenshotButtonState(enabled);
        await setEnableScreenshotButton(enabled);
    }, []);

    const totalPages = historyPage ? Math.max(1, Math.ceil(historyPage.total / HISTORY_PAGE_SIZE)) : 1;

    return (
        <Provider>
            <Box className="settings-wrapper" padding="10" borderRadius="md" boxShadow="0 4px 8px rgba(0,0,0,1)" maxWidth="760px" margin="20px auto" minWidth="50rem" backgroundColor="whiteAlpha.100" alignItems="center" justifyContent="center" textAlign="center">
                <Heading>Organization Options</Heading>

                <Box className="setting-group" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                    <VStack width="full">
                        <Field.Root >
                            <Field.Label fontSize="md" fontWeight="medium">
                                Download Directory:
                            </Field.Label>
                            <HStack gap="2" width="100%">
                                <Input type="text" id="download-directory" placeholder="Default Directory" variant="subtle" size="md" border="1px whiteAlpha.100 solid" borderRadius="md" bg="whiteAlpha.100" value={downloadDirectory} onChange={handleDownloadDirectoryChange} />
                                <Button id="browse" onClick={handleBrowse} border="1px whiteAlpha.100 solid" borderRadius="md" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Browse</Button>
                            </HStack>
                        </Field.Root>
                        <Text className="help-text">Leave blank to use the default downloads directory.</Text>
                    </VStack>
                    <VStack width="full">
                        <Field.Root >
                            <Field.Label fontSize="md" fontWeight="medium">
                                File Naming Template:
                            </Field.Label>
                            <HStack gap="2" width="100%">
                                <Input
                                    type="text"
                                    id="file-naming-template"
                                    placeholder="(%(upload_date>%Y-%m-%d)s)_%(title).180B_%(epoch)s_[%(id)s]"
                                    variant="subtle"
                                    size="md"
                                    border="1px whiteAlpha.100 solid"
                                    borderRadius="md"
                                    bg="whiteAlpha.100"
                                    value={fileNamingTemplate}
                                    onChange={handleFileNamingTemplateChange} />
                                <Box>
                                    <select
                                        name='template-selection'
                                        className="template-select"
                                        aria-label="Add field to template"
                                        value={templateSelection}
                                        onChange={(e) => void handleFileNamingTemplateSelectionChange(e.target.value)}
                                    >
                                        <option value="">Select field</option>
                                        {(() => {
                                            const groups = new Map<string, typeof templateSelectionList>();
                                            for (const option of templateSelectionList) {
                                                const existing = groups.get(option.group ?? '');
                                                if (existing) {
                                                    existing.push(option);
                                                } else {
                                                    groups.set(option.group ?? '', [option]);
                                                }
                                            }
                                            const result: React.ReactNode[] = [];
                                            let first = true;
                                            for (const [groupName, options] of groups) {
                                                if (!first) {
                                                    result.push(null);
                                                }
                                                first = false;
                                                result.push(
                                                    <optgroup key={groupName} label={groupName}>
                                                        {options.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            }
                                            return result;
                                        })()}
                                    </select>
                                </Box>
                            </HStack>

                        </Field.Root>
                        <Text className="help-text">Leave blank to use the default file naming template.</Text>
                    </VStack>
                </Box>

                <Box className="setting-group">
                    <Box flex={1}>
                        <CheckboxGroup value={selectedOrganize} onValueChange={handleOrganizeChange}>
                            <Text fontSize="md" fontWeight="medium">
                                Organize files by:
                            </Text>
                            <Grid gap="2" display="flex" flexDirection="row">
                                {checkboxItems.map((item) => (
                                    <CheckboxCard.Root key={item.value} value={item.value} bg="whiteAlpha.100" width="50%">
                                        <CheckboxCard.HiddenInput />
                                        <CheckboxCard.Control>
                                            <CheckboxCard.Content>
                                                <CheckboxCard.Label>{item.title}</CheckboxCard.Label>
                                                <CheckboxCard.Description>
                                                    {item.description}
                                                </CheckboxCard.Description>
                                            </CheckboxCard.Content>
                                            <CheckboxCard.Indicator />
                                        </CheckboxCard.Control>
                                    </CheckboxCard.Root>
                                ))}
                            </Grid>
                        </CheckboxGroup>
                    </Box>
                </Box>


                {/*
                <Box className="setting-group">
                    <Heading>Hotkey Settings</Heading>
                    <Text className="help-text">Click on an input field and press the desired key combination. Press Esc to cancel.</Text>
                    <Box alignItems="center" justifyContent="center" display="flex" flexDirection="column" gap="2" w={'100%'}>
                        <HStack w={"full"}>
                            <VStack w={"full"}>
                                <Text fontSize="md" fontWeight="medium">15s Clip (Default: Ctrl+Shift+1):</Text>
                                <HStack w={'100%'}>
                                    <Input type="text" id="hotkey-15s" className="hotkey-input" placeholder="Press keys..." readOnly size="xs" bg="whiteAlpha.100" flex={1} w={'100%'} />
                                    <Button data-for="hotkey-15s" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Reset</Button>
                                </HStack>
                            </VStack>
                            <VStack w={"full"}>
                                <Text fontSize="md" fontWeight="medium">30s Clip (Default: Ctrl+Shift+2):</Text>
                                <HStack w={'100%'}>
                                    <Input type="text" id="hotkey-30s" className="hotkey-input" placeholder="Press keys..." readOnly size="xs" bg="whiteAlpha.100" flex={1} />
                                    <Button data-for="hotkey-30s" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Reset</Button>
                                </HStack>
                            </VStack>
                        </HStack>
                        <HStack w={"full"}>
                            <VStack w={"full"}>
                                <Text fontSize="md" fontWeight="medium">60s Clip (Default: Ctrl+Shift+3):</Text>
                                <HStack w={'100%'}>
                                    <Input type="text" id="hotkey-60s" className="hotkey-input" placeholder="Press keys..." readOnly size="xs" bg="whiteAlpha.100" flex={1} />
                                    <Button data-for="hotkey-60s" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Reset</Button>
                                </HStack>
                            </VStack>
                            <VStack w={"full"}>
                                <Text fontSize="md" fontWeight="medium">Full Video (Default: Ctrl+Shift+4):</Text>
                                <HStack w={'100%'}>
                                    <Input type="text" id="hotkey-60s" className="hotkey-input" placeholder="Press keys..." readOnly size="xs" bg="whiteAlpha.100" flex={1} />
                                    <Button data-for="hotkey-60s" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Reset</Button>
                                </HStack>
                            </VStack>
                        </HStack>
                    </Box>
                </Box>

*/}
                {/*
                <Box className="setting-group">
                    <Heading>Clip Length Presets</Heading>
                    <Text className="help-text">Drag and drop presets to reorder. Click × to remove a preset.</Text>

                    <Box className="presets-section">
                        <HStack className="preset-controls">
                            <HStack className="preset-input-group">
                                <Input type="number" placeholder="Enter duration in seconds" min="1" bg="whiteAlpha.100" border="none" />
                                <Button bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }} border="none" color="white">Add Preset</Button>
                            </HStack>
                            <Button className="secondary-button" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }} border="none" color="white">Reset to Defaults</Button>
                        </HStack>
                    </Box>
                </Box>

                */}


                <Box className="setting-group">
                    <Heading>Download Settings</Heading>
                    <HStack height={"auto"}>
                        <CheckboxCard.Root value={"playSfx"} bg="whiteAlpha.100" checked={playSfxEnabled} onCheckedChange={(state) => void handlePlaySfxChange(typeof state.checked === 'boolean' ? state.checked : false)} height={"100%"}>
                            <CheckboxCard.HiddenInput />
                            <CheckboxCard.Control>
                                <CheckboxCard.Content>
                                    <CheckboxCard.Label>Play sound effects</CheckboxCard.Label>
                                    <CheckboxCard.Description>Adds sound effects that are played on clip creation, successful downloads, errors, etc.</CheckboxCard.Description>
                                </CheckboxCard.Content>
                                <CheckboxCard.Indicator />
                            </CheckboxCard.Control>
                        </CheckboxCard.Root>
                        <CheckboxCard.Root value={"showLiveProcessLog"} bg="whiteAlpha.100" checked={showLiveProcessLogEnabled} onCheckedChange={(state) => void handleShowLiveProcessLogChange(typeof state.checked === 'boolean' ? state.checked : false)} height={"100%"}>
                            <CheckboxCard.HiddenInput />
                            <CheckboxCard.Control>
                                <CheckboxCard.Content>
                                    <CheckboxCard.Label>Show live process log</CheckboxCard.Label>
                                    <CheckboxCard.Description>When a clip is downloading the live log window will open automatically allowing you to see the download progress.</CheckboxCard.Description>
                                </CheckboxCard.Content>
                                <CheckboxCard.Indicator />
                            </CheckboxCard.Control>
                        </CheckboxCard.Root>
                        <CheckboxCard.Root value={"livestreamMode"} bg="whiteAlpha.100" checked={livestreamMode} onCheckedChange={(state) => void handleLiveStreamModeChange(typeof state.checked === 'boolean' ? state.checked : false)} height={"100%"}>
                            <CheckboxCard.HiddenInput />
                            <CheckboxCard.Control>
                                <CheckboxCard.Content>
                                    <CheckboxCard.Label>Livestream mode (default)</CheckboxCard.Label>
                                    <CheckboxCard.Description>Enable livestream mode by default when you open the clipper. You can still toggle it on/off in the clipper UI per session.</CheckboxCard.Description>
                                </CheckboxCard.Content>
                                <CheckboxCard.Indicator />
                            </CheckboxCard.Control>
                        </CheckboxCard.Root>
                    </HStack>
                    <VStack >
                        <HStack justifyContent="space-between" alignItems="start" marginBottom="4" gap="3">
                            <Box flex={1}>
                                <Text fontSize="md" fontWeight="medium">
                                    Downloader:
                                </Text>
                                <select
                                    className="downloader-select"
                                    name='downloader-selection'
                                    aria-label="Select yt-dlp downloader"
                                    value={selectedDownloader}
                                    onChange={(e) => void handleDownloaderChange(e.target.value)}
                                >
                                    {downloaderList.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <Text className="help-text">Using anything other than 'Native' requires the selected downloader to be installed on your system and added to your PATH.</Text>
                            </Box>
                            <Box flex={1}>
                                <Text fontSize="md" fontWeight="medium">
                                    File format:
                                </Text>
                                <select
                                    className="format-select"
                                    name='format-selection'
                                    aria-label="Select yt-dlp downloader"
                                    value={selectedFileFormat}
                                    onChange={(e) => void handleFileFormatChange(e.target.value)}
                                >
                                    {fileFormatList.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <Text className="help-text">Note that using mp4 limits the amount of metadata that can be saved.</Text>
                            </Box>
                        </HStack>
                        <HStack justifyContent="space-between" alignItems="start" marginBottom="4" gap="3">
                            <CheckboxCard.Root value={"enableScreenshotButton"} bg="whiteAlpha.100" checked={enableScreenshotButton} onCheckedChange={(state) => void handleScreenshotButtonChange(typeof state.checked === 'boolean' ? state.checked : false)} height={"100%"} flex={1}>
                                <CheckboxCard.HiddenInput />
                                <CheckboxCard.Control>
                                    <CheckboxCard.Content>
                                        <CheckboxCard.Label>Show screenshot button</CheckboxCard.Label>
                                        <CheckboxCard.Description>Display a camera icon on Twitch/YouTube that saves a screenshot of that moment</CheckboxCard.Description>
                                    </CheckboxCard.Content>
                                    <CheckboxCard.Indicator />
                                </CheckboxCard.Control>
                            </CheckboxCard.Root>

                            <VStack width="full" flex={1} alignItems="start">
                                <Field.Root >
                                    <Field.Label fontSize="md" fontWeight="medium">
                                        Use Cookies:
                                    </Field.Label>
                                    <HStack gap="2" width="100%">
                                        <Input type="text" id="cookies-file" placeholder="Enter the location of your cookies.txt file" variant="subtle" size="md" border="1px whiteAlpha.100 solid" borderRadius="md" bg="whiteAlpha.100" value={cookiesFile} onChange={handleCookiesFileChange} />
                                        <Button id="browse-cookies" onClick={handleBrowseFile} border="1px whiteAlpha.100 solid" borderRadius="md" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Browse</Button>
                                    </HStack>
                                </Field.Root>
                                <Text className="help-text">Use of cookies is required to download age-restricted content and can also help bypass certain download restrictions. Export your cookies from your browser and point the downloader to the cookies.txt file. Note that the cookies file will need to be re-exported and updated here periodically as cookies expire. This is theoretically bannable by the content provider so use at your own risk.</Text>
                            </VStack>
                        </HStack>

                    </VStack>
                </Box>



                <Box className="setting-group">
                    <Heading>Download History</Heading>

                    <HStack justifyContent="space-between" alignItems="center" marginBottom="4" >
                        <Input
                            name='history-query'
                            id="history-query"
                            type="text"
                            placeholder="Filter by URL, file name, or error..."
                            variant="subtle"
                            size="md"
                            border="1px whiteAlpha.100 solid"
                            borderRadius="md"
                            bg="whiteAlpha.100"
                            _hover={{ backgroundColor: 'whiteAlpha.200' }}
                            value={historyQuery}
                            onChange={handleQueryChange}
                            flex={1}
                        />

                        <Box >
                            <select
                                aria-label="Filter history by status"
                                className="history-status-select"
                                value={historyStatusFilter}
                                onChange={handleStatusFilterChange}
                            >
                                {filterOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Box>
                    </HStack>



                    <DownloadHistoryList
                        entries={historyPage?.entries ?? []}
                        loading={historyLoading}
                        error={historyError}
                        total={historyPage?.total ?? 0}
                        page={historyPageIndex}
                        pageSize={HISTORY_PAGE_SIZE}
                        onPreviousPage={() => setHistoryPageIndex((current) => Math.max(1, current - 1))}
                        onNextPage={() => setHistoryPageIndex((current) => Math.min(totalPages, current + 1))}
                        onShowFile={handleShowFile}
                        onDeleteFile={handleDeleteFile}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onClear={handleClear}
                        onConfirmClear={handleClear}
                        busyEntryId={busyEntryId}
                        deletingEntryId={deletingEntryId}
                        unavailableFileEntryIds={unavailableFileEntryIds}
                    />
                </Box>




                <Box className="settings-footer">
                    <Text>Version 0.5</Text>
                </Box>
            </Box>
        </Provider>
    );
}
