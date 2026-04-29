import type { ClipDownloadRequest, ClipDownloadResult } from './native-clip-downloader-repo';

export const DOWNLOAD_HISTORY_STORAGE_KEY = 'downloadHistory';
export const DOWNLOAD_HISTORY_RETENTION_LIMIT = 500;
export const DOWNLOAD_HISTORY_PAGE_SIZE = 10;

export type DownloadHistoryStatus = 'completed' | 'error' | 'cancelled';

export type DownloadHistoryDownloadType = 'clip' | 'full-video';

export interface DownloadHistoryEntry {
    id: string;
    createdAt: number;
    updatedAt: number;
    status: DownloadHistoryStatus;
    downloadType: DownloadHistoryDownloadType;
    url: string;
    label: string;
    request: ClipDownloadRequest;
    outputPath?: string;
    fileName?: string;
    startTimeSeconds?: number;
    endTimeSeconds?: number;
    durationSeconds?: number;
    errorCode?: string;
    errorMessage?: string;
}

export interface DownloadHistoryQuery {
    offset?: number;
    limit?: number;
    status?: DownloadHistoryStatus | 'all';
    query?: string;
}

export interface DownloadHistoryPage {
    entries: DownloadHistoryEntry[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
}

let historyMutationQueue: Promise<void> = Promise.resolve();

function withHistoryLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = historyMutationQueue.then(operation, operation);
    historyMutationQueue = next.then(() => undefined, () => undefined);
    return next;
}

function createHistoryId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDownloadHistoryEntry(value: unknown): value is DownloadHistoryEntry {
    if (!value || typeof value !== 'object') return false;

    const entry = value as Partial<DownloadHistoryEntry>;
    return typeof entry.id === 'string'
        && typeof entry.createdAt === 'number'
        && typeof entry.updatedAt === 'number'
        && typeof entry.status === 'string'
        && typeof entry.downloadType === 'string'
        && typeof entry.url === 'string'
        && typeof entry.label === 'string'
        && typeof entry.request === 'object';
}

async function readStoredHistory(): Promise<DownloadHistoryEntry[]> {
    const stored = await browser.storage.local.get(DOWNLOAD_HISTORY_STORAGE_KEY) as Record<string, unknown>;
    const raw = stored[DOWNLOAD_HISTORY_STORAGE_KEY];

    if (!Array.isArray(raw)) {
        return [];
    }

    return raw.filter(isDownloadHistoryEntry);
}

function normalizeHistoryEntries(entries: DownloadHistoryEntry[]): DownloadHistoryEntry[] {
    return entries
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, DOWNLOAD_HISTORY_RETENTION_LIMIT);
}

async function writeStoredHistory(entries: DownloadHistoryEntry[]): Promise<void> {
    await browser.storage.local.set({
        [DOWNLOAD_HISTORY_STORAGE_KEY]: normalizeHistoryEntries(entries),
    });
}

function inferDownloadType(request: ClipDownloadRequest): DownloadHistoryDownloadType {
    return request.type === 'download-clip' ? 'clip' : 'full-video';
}

function createHistoryEntryFromResult(
    request: ClipDownloadRequest,
    result: ClipDownloadResult,
    createdAt: number,
): DownloadHistoryEntry {
    const baseEntry: DownloadHistoryEntry = {
        id: createHistoryId(),
        createdAt,
        updatedAt: createdAt,
        status: result.ok ? 'completed' : 'error',
        downloadType: inferDownloadType(request),
        url: request.url,
        label: request.label,
        request,
    };

    if (request.type === 'download-clip') {
        baseEntry.startTimeSeconds = request.startTimeSeconds;
        baseEntry.endTimeSeconds = request.endTimeSeconds;
        baseEntry.durationSeconds = Number((request.endTimeSeconds - request.startTimeSeconds).toFixed(3));
    }

    if (result.ok) {
        baseEntry.outputPath = result.outputPath;
        baseEntry.fileName = result.fileName;

        if (result.downloadType === 'clip') {
            baseEntry.startTimeSeconds = result.clipRange.startTimeSeconds;
            baseEntry.endTimeSeconds = result.clipRange.endTimeSeconds;
            baseEntry.durationSeconds = Number((result.clipRange.endTimeSeconds - result.clipRange.startTimeSeconds).toFixed(3));
        }

        return baseEntry;
    }

    baseEntry.errorCode = result.code;
    baseEntry.errorMessage = result.message;
    return baseEntry;
}

export async function getDownloadHistory(query: DownloadHistoryQuery = {}): Promise<DownloadHistoryPage> {
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    const limit = Math.max(1, Math.floor(query.limit ?? DOWNLOAD_HISTORY_PAGE_SIZE));
    const status = query.status ?? 'all';
    const search = query.query?.trim().toLowerCase() ?? '';

    const entries = await readStoredHistory();
    const filtered = entries.filter((entry) => {
        if (status !== 'all' && entry.status !== status) {
            return false;
        }

        if (!search) {
            return true;
        }

        const haystack = [
            entry.url,
            entry.label,
            entry.fileName ?? '',
            entry.outputPath ?? '',
            entry.errorMessage ?? '',
            entry.errorCode ?? '',
        ].join(' ').toLowerCase();

        return haystack.includes(search);
    });

    const pageEntries = filtered.slice(offset, offset + limit);

    return {
        entries: pageEntries,
        total: filtered.length,
        offset,
        limit,
        hasMore: offset + limit < filtered.length,
    };
}

export async function saveDownloadHistoryEntry(request: ClipDownloadRequest, result: ClipDownloadResult): Promise<void> {
    await withHistoryLock(async () => {
        const entries = await readStoredHistory();
        const createdAt = Date.now();
        const nextEntries = [createHistoryEntryFromResult(request, result, createdAt), ...entries];

        await writeStoredHistory(nextEntries);
    });
}

export async function removeDownloadHistoryEntry(entryId: string): Promise<void> {
    await withHistoryLock(async () => {
        const entries = await readStoredHistory();
        await writeStoredHistory(entries.filter((entry) => entry.id !== entryId));
    });
}

export async function clearDownloadHistory(): Promise<void> {
    await withHistoryLock(async () => {
        await browser.storage.local.remove(DOWNLOAD_HISTORY_STORAGE_KEY);
    });
}

export function DownloadHistoryRepo() {
    return {
        getHistory: getDownloadHistory,
        saveEntry: saveDownloadHistoryEntry,
        removeEntry: removeDownloadHistoryEntry,
        clearHistory: clearDownloadHistory,
    };
}
