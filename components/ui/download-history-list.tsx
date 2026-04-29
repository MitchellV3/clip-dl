import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import type { DownloadHistoryEntry } from '@/lib/repos/download-history-repo';

function formatDateTime(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
}

function formatDuration(entry: DownloadHistoryEntry): string {
    if (typeof entry.durationSeconds === 'number' && Number.isFinite(entry.durationSeconds)) {
        const duration = entry.durationSeconds;
        return duration >= 60 ? `${(duration / 60).toFixed(1)} min` : `${duration.toFixed(3)} s`;
    }

    return '—';
}

function statusLabel(status: DownloadHistoryEntry['status']): string {
    if (status === 'completed') return 'Completed';
    if (status === 'error') return 'Failed';
    return 'Cancelled';
}

function statusColor(status: DownloadHistoryEntry['status']): string {
    if (status === 'completed') return '#4ade80';
    if (status === 'error') return '#f87171';
    return '#fbbf24';
}

function truncate(value: string, maxLength = 84): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}…`;
}

export function DownloadHistoryList({
    entries,
    loading,
    error,
    total,
    page,
    pageSize,
    onPreviousPage,
    onNextPage,
    onShowFile,
    onRetry,
    onRemove,
    onClear,
    busyEntryId,
}: {
    entries: DownloadHistoryEntry[];
    loading: boolean;
    error: string | null;
    total: number;
    page: number;
    pageSize: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onShowFile: (entry: DownloadHistoryEntry) => void;
    onRetry: (entry: DownloadHistoryEntry) => void;
    onRemove: (entry: DownloadHistoryEntry) => void;
    onClear: () => void;
    busyEntryId: string | null;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <VStack align="stretch" gap="3" width="full" height={"full"}>
            <HStack justify="space-between" align="center">
                <Text color="whiteAlpha.800" fontSize="sm">
                    Showing page {page} of {totalPages} · {total} entr{total === 1 ? 'y' : 'ies'}
                </Text>
                <Button
                    size="sm"
                    bg="whiteAlpha.100"
                    border="none"
                    _hover={{ backgroundColor: 'whiteAlpha.200' }}
                    onClick={onClear}
                    disabled={loading || total === 0}
                >
                    Clear History
                </Button>
            </HStack>

            {error && (
                <Box borderRadius="md" bg="rgba(248, 113, 113, 0.15)" border="1px solid rgba(248, 113, 113, 0.35)" p="3">
                    <Text color="red.200" fontSize="sm">
                        {error}
                    </Text>
                </Box>
            )}

            <Box className="history-container" borderRadius="md" border="1px solid rgba(255,255,255,0.12)" overflow="auto">
                {loading && (
                    <Box p="4">
                        <Text color="whiteAlpha.700">Loading history…</Text>
                    </Box>
                )}

                {!loading && entries.length === 0 && (
                    <Box p="4">
                        <Text color="whiteAlpha.700">No download history found for this filter.</Text>
                    </Box>
                )}

                {!loading && entries.map((entry) => {
                    const showFileDisabled = !entry.outputPath;
                    const busy = busyEntryId === entry.id;

                    return (
                        <Box key={entry.id} p="4" borderBottom="1px solid rgba(255,255,255,0.08)" _last={{ borderBottom: 'none' }}>
                            <HStack justify="space-between" align="start" gap="4" alignItems="flex-start">
                                <VStack align="start" gap="1" flex="1" minW="0">
                                    <HStack gap="2" wrap="wrap">
                                        <Text fontWeight="600" color="white">
                                            {truncate(entry.label, 50)}
                                        </Text>
                                        <Text fontSize="xs" px="2" py="0.5" borderRadius="full" bg="whiteAlpha.200" color={statusColor(entry.status)}>
                                            {statusLabel(entry.status)}
                                        </Text>
                                    </HStack>
                                    <Text fontSize="sm" color="whiteAlpha.800" wordBreak="break-all">
                                        {truncate(entry.url, 120)}
                                    </Text>
                                    <Text fontSize="xs" color="whiteAlpha.600">
                                        {formatDateTime(entry.createdAt)} · {entry.downloadType} · {formatDuration(entry)}
                                    </Text>
                                    {entry.fileName && (
                                        <Text fontSize="xs" color="whiteAlpha.600" wordBreak="break-all">
                                            File: {truncate(entry.fileName, 100)}
                                        </Text>
                                    )}
                                    {entry.errorMessage && (
                                        <Text fontSize="xs" color="red.200" wordBreak="break-word">
                                            {entry.errorCode ? `${entry.errorCode}: ` : ''}{entry.errorMessage}
                                        </Text>
                                    )}
                                </VStack>

                                <HStack gap="2" flexWrap="wrap" justify="flex-end">
                                    <Button
                                        size="sm"
                                        bg="whiteAlpha.100"
                                        border="none"
                                        _hover={{ backgroundColor: 'whiteAlpha.200' }}
                                        onClick={() => onShowFile(entry)}
                                        disabled={showFileDisabled || busy}
                                    >
                                        Show file
                                    </Button>
                                    <Button
                                        size="sm"
                                        bg="whiteAlpha.100"
                                        border="none"
                                        _hover={{ backgroundColor: 'whiteAlpha.200' }}
                                        onClick={() => onRetry(entry)}
                                        disabled={busy}
                                    >
                                        Retry
                                    </Button>
                                    <Button
                                        size="sm"
                                        bg="whiteAlpha.100"
                                        border="none"
                                        _hover={{ backgroundColor: 'whiteAlpha.200' }}
                                        onClick={() => onRemove(entry)}
                                        disabled={busy}
                                    >
                                        Remove
                                    </Button>
                                </HStack>
                            </HStack>
                        </Box>
                    );
                })}
            </Box>

            <HStack justify="space-between" align="center">
                <Button
                    bg="whiteAlpha.100"
                    border="none"
                    _hover={{ backgroundColor: 'whiteAlpha.200' }}
                    onClick={onPreviousPage}
                    disabled={loading || page <= 1}
                >
                    Previous
                </Button>
                <Button
                    bg="whiteAlpha.100"
                    border="none"
                    _hover={{ backgroundColor: 'whiteAlpha.200' }}
                    onClick={onNextPage}
                    disabled={loading || page >= totalPages}
                >
                    Next
                </Button>
            </HStack>
        </VStack>
    );
}
