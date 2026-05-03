import { saveDownloadHistoryEntry } from './download-history-repo'
import { getCookiesFile, getDownloadDirectory, getDownloader, getDownloadFileFormat, getFileNamingTemplate } from './settings-repo'

const NATIVE_HOST_NAME = 'com.clip_dl.clip_downloader'

export interface ClipRangeDownloadRequest {
    type: 'download-clip'
    url: string
    startTimeSeconds: number
    endTimeSeconds: number
    label: string
    audioOnly?: boolean
    formatSelector?: string
    fileFormat?: string
    fileNamingTemplate?: string
    showLiveProcessLog?: boolean
    organizeByDate?: boolean
    organizeBySource?: boolean
    organizeByUploader?: boolean
    downloadsPath?: string
    downloader?: string
    cookiesFile?: string
}

export interface FullVideoDownloadRequest {
    type: 'download-full-video'
    url: string
    label: string
    audioOnly?: boolean
    formatSelector?: string
    fileFormat?: string
    fileNamingTemplate?: string
    showLiveProcessLog?: boolean
    organizeByDate?: boolean
    organizeBySource?: boolean
    organizeByUploader?: boolean
    downloadsPath?: string
    downloader?: string
    cookiesFile?: string
}

export type ClipDownloadRequest = ClipRangeDownloadRequest | FullVideoDownloadRequest

export interface ClipQualityFormat {
    label: string
    value: string
}

export interface GetVideoFormatsRequest {
    type: 'get-video-formats'
    url: string
}

export interface SuccessfulGetVideoFormatsResult {
    ok: true
    formats: ClipQualityFormat[]
}

export interface FailedGetVideoFormatsResult {
    ok: false
    code: 'busy' | 'native-host-unavailable' | 'missing-tool' | 'download-failed' | 'bad-request' | 'insufficient-disk-space' | 'low-disk-space' | 'disk-error'
    message: string
}

export type GetVideoFormatsResult = SuccessfulGetVideoFormatsResult | FailedGetVideoFormatsResult

export interface ShowDownloadedClipInFolderRequest {
    type: 'show-downloaded-clip-in-folder'
    outputPath: string
    highlightFile?: boolean
}

export interface PickFileRequest {
    type: 'pick-file'
}

export interface SuccessfulClipRangeDownloadResult {
    ok: true
    downloadType: 'clip'
    outputPath: string
    fileName: string
    clipRange: {
        startTimeSeconds: number
        endTimeSeconds: number
    }
}

export interface SuccessfulFullVideoDownloadResult {
    ok: true
    downloadType: 'full-video'
    outputPath: string
    fileName: string
}

export interface FailedClipDownloadResult {
    ok: false
    code: 'busy' | 'native-host-unavailable' | 'missing-tool' | 'download-failed' | 'bad-request' | 'insufficient-disk-space' | 'low-disk-space' | 'disk-error'
    message: string
}

export type ClipDownloadResult =
    | SuccessfulClipRangeDownloadResult
    | SuccessfulFullVideoDownloadResult
    | FailedClipDownloadResult

function normalizeNativeError(error: unknown): FailedClipDownloadResult {
    const errorText = String(error)

    // Native messaging can fail before the host starts, usually because the host is
    // not installed or the manifest no longer matches the extension ID. The content
    // script cannot call the host directly, so this normalization lives in the
    // background-facing repo that wraps browser.runtime.sendNativeMessage.
    if (errorText.includes('Native host has exited') || errorText.includes('Specified native messaging host not found')) {
        return {
            ok: false,
            code: 'native-host-unavailable',
            message: 'The clip downloader host is not available. Reinstall the native host and restart Chrome.',
        }
    }

    return {
        ok: false,
        code: 'download-failed',
        message: errorText,
    }
}

export function NativeClipDownloaderRepo() {
    const downloadClip = async (payload: ClipDownloadRequest): Promise<ClipDownloadResult> => {
        try {
            const downloadsPath = await getDownloadDirectory();
            const downloader = await getDownloader();
            const fileFormat = await getDownloadFileFormat();
            const fileNamingTemplate = await getFileNamingTemplate();
            const cookiesFile = await getCookiesFile();
            const requestPayload = { ...payload, downloadsPath, downloader, fileFormat, fileNamingTemplate, cookiesFile } as ClipDownloadRequest;
            console.warn(`[clip-dl] downloadClip: downloadsPath="${downloadsPath}", downloader="${downloader}", type=${requestPayload.type}`);
            console.warn(`[clip-dl] Native message payload: ${JSON.stringify(requestPayload)}`);
            // The background script owns native messaging. Content scripts must proxy
            // through it because Chrome only exposes sendNativeMessage to extension
            // pages and the background/service-worker context.
            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, requestPayload)
            const normalizedResponse = response as ClipDownloadResult

            try {
                await saveDownloadHistoryEntry(payload, normalizedResponse)
            } catch (historyError) {
                console.warn('[clip-dl] Failed to save download history entry:', historyError)
            }

            return normalizedResponse
        } catch (error) {
            console.warn('[clip-dl] Native clip downloader error:', error)
            const normalizedError = normalizeNativeError(error)

            try {
                await saveDownloadHistoryEntry(payload, normalizedError)
            } catch (historyError) {
                console.warn('[clip-dl] Failed to save failed download history entry:', historyError)
            }

            return normalizedError
        }
    }

    const showDownloadedClipInFolder = async (outputPath: string, highlightFile = true): Promise<boolean> => {
        try {
            const payload: ShowDownloadedClipInFolderRequest = {
                type: 'show-downloaded-clip-in-folder',
                outputPath,
                highlightFile,
            }

            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload) as {
                ok?: boolean
                opened?: boolean
            }

            return Boolean(response?.ok && response?.opened)
        } catch (error) {
            console.warn('[clip-dl] Show downloaded clip in folder error:', error)
            return false
        }
    }

    const getVideoFormats = async (url: string): Promise<GetVideoFormatsResult> => {
        try {
            const payload: GetVideoFormatsRequest = {
                type: 'get-video-formats',
                url,
            }

            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload)

            return response as GetVideoFormatsResult
        } catch (error) {
            console.warn('[clip-dl] Get video formats error:', error)
            return normalizeNativeError(error) as GetVideoFormatsResult
        }
    }

    const pickDirectory = async (): Promise<string | null> => {
        try {
            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, {
                type: 'pick-directory',
            }) as { ok: boolean; directory: string | null };

            if (response.ok && response.directory) {
                return response.directory;
            }
            return null;
        } catch (error) {
            console.warn('[clip-dl] Failed to pick directory:', error);
            return null;
        }
    }

    const pickFile = async (): Promise<string | null> => {
        try {
            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, {
                type: 'pick-file',
            }) as { ok: boolean; filePath: string | null };

            if (response.ok && response.filePath) {
                return response.filePath;
            }
            return null;
        } catch (error) {
            console.warn('[clip-dl] Failed to pick file:', error);
            return null;
        }
    }

    return {
        downloadClip,
        showDownloadedClipInFolder,
        getVideoFormats,
        pickDirectory,
        pickFile,
    }



}
