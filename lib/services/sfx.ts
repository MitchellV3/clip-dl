type SfxName = 'error' | 'success' | 'start_recording' | 'stop_recording'

const SFX_PATHS: Record<SfxName, string> = {
    error: '/sfx/sfx_error.wav',
    success: '/sfx/sfx_success.wav',
    start_recording: '/sfx/sfx_start_recording.wav',
    stop_recording: '/sfx/sfx_stop_recording.wav',
}

const isDevelopment = import.meta.env.DEV

function getRuntimeUrl(path: string) {
    const runtimeApi = (globalThis as typeof globalThis & {
        browser?: { runtime?: { getURL: (value: string) => string } }
        chrome?: { runtime?: { getURL: (value: string) => string } }
    }).browser?.runtime ?? (globalThis as typeof globalThis & {
        browser?: { runtime?: { getURL: (value: string) => string } }
        chrome?: { runtime?: { getURL: (value: string) => string } }
    }).chrome?.runtime

    if (runtimeApi?.getURL) {
        return runtimeApi.getURL(path)
    }

    return path
}

function debugLog(message: string, detail?: unknown) {
    if (!isDevelopment) {
        return
    }

    if (detail !== undefined) {
        console.debug(`[clip-dl][sfx] ${message}`, detail)
        return
    }

    console.debug(`[clip-dl][sfx] ${message}`)
}

export function playSfx(name: SfxName) {
    const path = SFX_PATHS[name]
    const url = getRuntimeUrl(path)

    try {
        const audio = new Audio(url)
        audio.preload = 'auto'
        audio.volume = 1

        void audio.play().catch((error) => {
            debugLog(`playback failed for ${name}`, error)
        })

        debugLog(`playing ${name}`, url)
    } catch (error) {
        debugLog(`could not create audio for ${name}`, error)
    }
}

export type { SfxName }