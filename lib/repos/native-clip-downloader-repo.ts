import { saveDownloadHistoryEntry } from './download-history-repo'

const NATIVE_HOST_NAME = 'com.clip_dl.clip_downloader'

export interface ClipRangeDownloadRequest {
    type: 'download-clip'
    url: string
    startTimeSeconds: number
    endTimeSeconds: number
    label: string
    audioOnly?: boolean
    formatSelector?: string
    showLiveProcessLog?: boolean
}

export interface FullVideoDownloadRequest {
    type: 'download-full-video'
    url: string
    label: string
    audioOnly?: boolean
    formatSelector?: string
    showLiveProcessLog?: boolean
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
            // The background script owns native messaging. Content scripts must proxy
            // through it because Chrome only exposes sendNativeMessage to extension
            // pages and the background/service-worker context.
            const response = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload)
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

    return {
        downloadClip,
        showDownloadedClipInFolder,
        getVideoFormats,
    }



}
