import { Box, Button, Dialog, HStack, Portal, Text, VStack } from '@chakra-ui/react';
import type { DownloadHistoryEntry } from '@/lib/repos/download-history-repo';
import { useCallback, useState } from 'react';
import { CustomSpinner } from '@/components/ui/custom-spinner';

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
    onDeleteFile,
    onRetry,
    onRemove,
    onClear,
    onConfirmClear,
    busyEntryId,
    deletingEntryId,
    unavailableFileEntryIds,
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
    onDeleteFile: (entry: DownloadHistoryEntry, removeEntryFromHistory: boolean) => Promise<void> | void;
    onRetry: (entry: DownloadHistoryEntry) => void;
    onRemove: (entry: DownloadHistoryEntry) => void;
    onClear: () => void;
    onConfirmClear: () => void;
    busyEntryId: string | null;
    deletingEntryId: string | null;
    unavailableFileEntryIds: string[];
}) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<DownloadHistoryEntry | null>(null);
    const [deleteAlsoRemoveEntry, setDeleteAlsoRemoveEntry] = useState(false);
    const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);

    const handleConfirm = useCallback(() => {
        setConfirmOpen(false);
        onConfirmClear();
    }, [onConfirmClear]);

    const handleOpenDeleteConfirm = useCallback((entry: DownloadHistoryEntry) => {
        setDeleteConfirmEntry(entry);
        setDeleteAlsoRemoveEntry(false);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteConfirmEntry) return;

        setDeleteConfirmLoading(true);
        try {
            await Promise.resolve(onDeleteFile(deleteConfirmEntry, deleteAlsoRemoveEntry));
            setDeleteConfirmEntry(null);
            setDeleteAlsoRemoveEntry(false);
        } finally {
            setDeleteConfirmLoading(false);
        }
    }, [deleteAlsoRemoveEntry, deleteConfirmEntry, onDeleteFile]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <VStack align="stretch" gap="3" width="full" height={"full"} className='download-history-wrapper'>
            <HStack justify="space-between" align="center">
                <Text color="whiteAlpha.800" fontSize="sm">
                    Showing page {page} of {totalPages} · {total} entr{total === 1 ? 'y' : 'ies'}
                </Text>
                <Dialog.Root open={confirmOpen} onOpenChange={(e) => setConfirmOpen(e.open)} modal={true} >
                    <Dialog.Trigger asChild>
                        <Button
                            size="sm"
                            bg="whiteAlpha.100"
                            border="none"
                            _hover={{ backgroundColor: 'whiteAlpha.200' }}
                            disabled={loading || total === 0}
                        >
                            Clear History
                        </Button>
                    </Dialog.Trigger>

                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content backgroundColor={"blackAlpha.900"}>
                            <Dialog.Header>
                                <Dialog.Title>Clear Download History</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body display="flex" flexDirection="column">
                                <Text>Are you sure you want to clear all download history?</Text>
                                <Text color="red.500"
                                >This action cannot be undone.</Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Dialog.ActionTrigger asChild>
                                    <Button variant="outline" bg="whiteAlpha.100" _hover={{ backgroundColor: 'whiteAlpha.200' }}>Cancel</Button>
                                </Dialog.ActionTrigger>
                                <Button bg="red.500" _hover={{ backgroundColor: 'red.600' }} onClick={handleConfirm}>Clear All</Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>

                </Dialog.Root>

                <Dialog.Root
                    open={Boolean(deleteConfirmEntry)}
                    onOpenChange={(e) => {
                        if (!e.open && !deleteConfirmLoading) {
                            setDeleteConfirmEntry(null);
                            setDeleteAlsoRemoveEntry(false);
                        }
                    }}
                    modal={true}
                >
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content backgroundColor={'blackAlpha.900'}>
                            <Dialog.Header>
                                <Dialog.Title>Delete Downloaded File</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body display="flex" flexDirection="column" gap="3">
                                <Text>
                                    Are you sure you want to delete this downloaded file from disk?
                                </Text>
                                {deleteConfirmEntry?.fileName && (
                                    <Text fontSize="sm" color="whiteAlpha.700" wordBreak="break-all">
                                        {truncate(deleteConfirmEntry.fileName, 120)}
                                    </Text>
                                )}
                                <HStack align="center" gap="2">
                                    <input
                                        id="delete-also-remove-entry"
                                        type="checkbox"
                                        title="Also remove this history entry"
                                        checked={deleteAlsoRemoveEntry}
                                        onChange={(event) => setDeleteAlsoRemoveEntry(event.target.checked)}
                                        disabled={deleteConfirmLoading}
                                    />
                                    <label htmlFor="delete-also-remove-entry" className="delete-entry-checkbox-label">
                                        Also remove this history entry
                                    </label>
                                </HStack>
                                <Text color="red.500" fontSize="sm">
                                    This deletes the downloaded file permanently.
                                </Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Dialog.ActionTrigger asChild>
                                    <Button
                                        variant="outline"
                                        bg="whiteAlpha.100"
                                        _hover={{ backgroundColor: 'whiteAlpha.200' }}
                                        disabled={deleteConfirmLoading}
                                    >
                                        Cancel
                                    </Button>
                                </Dialog.ActionTrigger>
                                <Button
                                    bg="red.500"
                                    _hover={{ backgroundColor: 'red.600' }}
                                    onClick={() => void handleConfirmDelete()}
                                    disabled={deleteConfirmLoading}
                                    minW="120px"
                                >
                                    {deleteConfirmLoading ? (
                                        <HStack gap="2">
                                            <CustomSpinner size="xs" />
                                            <Text>Deleting…</Text>
                                        </HStack>
                                    ) : (
                                        'Delete file'
                                    )}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Dialog.Root>
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
                    const fileUnavailable = unavailableFileEntryIds.includes(entry.id);
                    const showFileDisabled = !entry.outputPath || fileUnavailable;
                    const canDeleteFile = entry.status === 'completed' && Boolean(entry.outputPath) && !fileUnavailable;
                    const busy = busyEntryId === entry.id;
                    const deletingThisEntry = deletingEntryId === entry.id;

                    return (
                        <Box key={entry.id} p="4" borderBottom="1px solid rgba(255,255,255,0.08)" _last={{ borderBottom: 'none' }}>
                            <HStack justify="space-between" align="start" gap="4" alignItems="flex-start">
                                <VStack align="start" gap="1" flex="1" minW="0" opacity={fileUnavailable ? 0.55 : 1}>
                                    <HStack gap="2" wrap="wrap">
                                        <Text fontWeight="600" color="white" textDecoration={fileUnavailable ? 'line-through' : 'none'}>
                                            {truncate(entry.label, 50)}
                                        </Text>
                                        <Text fontSize="xs" px="2" py="0.5" borderRadius="full" bg="whiteAlpha.200" color={statusColor(entry.status)}>
                                            {statusLabel(entry.status)}
                                        </Text>
                                    </HStack>
                                    {entry.fileName && (
                                        <Box fontSize="md" fontWeight="600" wordBreak="break-all" textDecoration={fileUnavailable ? 'line-through' : 'none'} textAlign={"left"}>
                                            {truncate(entry.fileName, 100)}
                                        </Box>
                                    )}
                                    <Text fontSize="sm" color="whiteAlpha.800" wordBreak="break-all">
                                        {truncate(entry.url, 120)}
                                    </Text>

                                    <Text fontSize="xs" color="whiteAlpha.600">
                                        {formatDateTime(entry.createdAt)} · {entry.downloadType} · {formatDuration(entry)}
                                    </Text>

                                    {fileUnavailable && (
                                        <Text fontSize="xs" color="whiteAlpha.500" fontStyle="italic">
                                            File unavailable (already deleted or inaccessible)
                                        </Text>
                                    )}
                                    {entry.errorMessage && (
                                        <Text fontSize="xs" color="red.200" wordBreak="break-word">
                                            {entry.errorCode ? `${entry.errorCode}: ` : ''}{entry.errorMessage}
                                        </Text>
                                    )}
                                </VStack>

                                <HStack gap="2" flexWrap="wrap" justify="flex-end" flexDir={"column"} align={"flex-end"}>
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

                                    {entry.status === 'error' && (
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
                                    )}
                                    <Button
                                        size="sm"
                                        bg="whiteAlpha.100"
                                        border="none"
                                        _hover={{ backgroundColor: 'whiteAlpha.200' }}
                                        onClick={() => onRemove(entry)}
                                        disabled={busy}
                                    >
                                        Remove from history
                                    </Button>
                                    {canDeleteFile && (
                                        <Button
                                            size="sm"
                                            bg="red.500"
                                            _hover={{ backgroundColor: 'red.600' }}
                                            border="none"
                                            onClick={() => handleOpenDeleteConfirm(entry)}
                                            disabled={busy}
                                            minW="108px"
                                        >
                                            {deletingThisEntry ? (
                                                <HStack gap="2">
                                                    <CustomSpinner size="xs" />
                                                    <Text>Deleting…</Text>
                                                </HStack>
                                            ) : (
                                                'Delete file'
                                            )}
                                        </Button>
                                    )}
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
