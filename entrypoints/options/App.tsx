import { Provider } from '@/components/ui/provider';
import { DownloadHistoryList } from '@/components/ui/download-history-list';
import { CLIP_DOWNLOADER_KEY, DOWNLOAD_HISTORY_KEY } from '@/lib/services/proxy-service-keys';
import {
    DOWNLOAD_HISTORY_PAGE_SIZE,
    type DownloadHistoryEntry,
    type DownloadHistoryPage,
    type DownloadHistoryStatus,
} from '@/lib/repos/download-history-repo';
import { getPlaySfxEnabled, setPlaySfxEnabled, getShowLiveProcessLog, setShowLiveProcessLog, watchPlaySfxEnabled, watchShowLiveProcessLog, getOrganizeByDate, setOrganizeByDate, getOrganizeBySource, setOrganizeBySource, watchOrganizeByDate, watchOrganizeBySource } from '@/lib/repos/settings-repo';
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
    const [playSfxEnabled, setPlaySfxEnabledState] = useState(true);
    const [showLiveProcessLogEnabled, setShowLiveProcessLogState] = useState(false);
    const [organizeByDate, setOrganizeByDateState] = useState(false);
    const [organizeBySource, setOrganizeBySourceState] = useState(false);
    const [selectedOrganize, setSelectedOrganize] = useState<string[]>([]);

    const checkboxItems = [
        { value: 'date', title: 'Date', description: 'Organize clips by date (Year -> Month)' },
        { value: 'source', title: 'Source', description: 'Organize clips by website (YouTube/Twitch)' },
    ];

    const filterOptions = useMemo(() => ([
        { value: 'all', label: 'All Statuses' },
        { value: 'completed', label: 'Completed' },
        { value: 'error', label: 'Errors' },
        { value: 'cancelled', label: 'Cancelled' },
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
            setSelectedOrganize([
                orgDate ? 'date' : null,
                orgSource ? 'source' : null,
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
            await clipDownloader.showDownloadedClipInFolder(entry.outputPath, true);
        } finally {
            setBusyEntryId(null);
        }
    }, []);

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

    const handleOrganizeChange = useCallback(async (values: string[]) => {
        setSelectedOrganize(values);
        const newDate = values.includes('date');
        const newSource = values.includes('source');
        setOrganizeByDateState(newDate);
        setOrganizeBySourceState(newSource);
        await Promise.all([
            setOrganizeByDate(newDate),
            setOrganizeBySource(newSource),
        ]);
    }, []);

    const totalPages = historyPage ? Math.max(1, Math.ceil(historyPage.total / HISTORY_PAGE_SIZE)) : 1;

    return (
        <Provider>
            <Box className="settings-wrapper" padding="10" borderRadius="md" boxShadow="0 4px 8px rgba(0,0,0,1)" maxWidth="760px" margin="20px auto" minWidth="50rem" backgroundColor="whiteAlpha.100" alignItems="center" justifyContent="center" textAlign="center">
                <Heading>Organization Options</Heading>

                <Box className="setting-group" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                    <VStack width="full">
                        <Field.Root required>
                            <Field.Label fontSize="md" fontWeight="medium">
                                Download Directory:
                            </Field.Label>
                            <HStack gap="2" width="100%">
                                <Input type="text" id="download-directory" placeholder="Default Directory" variant="subtle" size="md" border="1px whiteAlpha.100 solid" borderRadius="md" bg="whiteAlpha.100" />
                                <Button id="browse" border="1px whiteAlpha.100 solid" borderRadius="md" size="lg" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Browse</Button>
                            </HStack>
                        </Field.Root>
                        <Text className="help-text">Leave blank to use the default downloads directory.</Text>
                    </VStack>
                    <VStack width="full">
                        <Field.Root required>
                            <Field.Label fontSize="md" fontWeight="medium">
                                File Naming Template:
                            </Field.Label>
                            <HStack gap="2" width="100%">
                                <Input
                                    type="text"
                                    id="download-directory"
                                    placeholder="%(title) [%(id)s] {start_ms}-{end_ms}"
                                    variant="subtle"
                                    size="md"
                                    border="1px whiteAlpha.100 solid"
                                    borderRadius="md"
                                    bg="whiteAlpha.100" />
                            </HStack>
                        </Field.Root>
                        <Text className="help-text">Leave blank to use the default file naming template.</Text>
                    </VStack>
                </Box>

                {/*TODO: Add the option to organize downloads into subfolders by date or website or both. This will require changes to the backend to support dynamic subfolder paths based on the download date and source website. If 'Organize files by date' is selected*/}
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



                <Box className="setting-group">
                    <Heading>Other Settings</Heading>
                    <HStack height={"8rem"}>
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
                    </HStack>
                </Box>



                <Box className="setting-group">
                    <Heading>Download History</Heading>

                    <HStack justifyContent="space-between" alignItems="center" marginBottom="4" gap="3">
                        <Input
                            type="text"
                            placeholder="Filter by URL, file name, or error..."
                            size="md"
                            bg="whiteAlpha.100"
                            border="none"
                            _hover={{ backgroundColor: 'whiteAlpha.200' }}
                            value={historyQuery}
                            onChange={handleQueryChange}
                        />

                        <Box minW="200px">
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
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onClear={handleClear}
                        onConfirmClear={handleClear}
                        busyEntryId={busyEntryId}
                    />
                </Box>




                <Box className="settings-footer">
                    <Text>Version 0.3</Text>
                </Box>
            </Box>
        </Provider>
    );
}
