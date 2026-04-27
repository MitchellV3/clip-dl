const NATIVE_HOST_NAME = 'com.clip_dl.clip_downloader'

export interface ClipDownloadRequest {
    type: 'download-clip'
    url: string
    startTimeSeconds: number
    endTimeSeconds: number
    label: string
}

export interface ShowDownloadedClipInFolderRequest {
    type: 'show-downloaded-clip-in-folder'
    outputPath: string
    highlightFile?: boolean
}

export interface SuccessfulClipDownloadResult {
    ok: true
    outputPath: string
    fileName: string
    clipRange: {
        startTimeSeconds: number
        endTimeSeconds: number
    }
}

export interface FailedClipDownloadResult {
    ok: false
    code: 'busy' | 'native-host-unavailable' | 'missing-tool' | 'download-failed' | 'bad-request'
    message: string
}

export type ClipDownloadResult = SuccessfulClipDownloadResult | FailedClipDownloadResult

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

            return response as ClipDownloadResult
        } catch (error) {
            console.warn('[clip-dl] Native clip downloader error:', error)
            return normalizeNativeError(error)
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

    return {
        downloadClip,
        showDownloadedClipInFolder,
    }


}
