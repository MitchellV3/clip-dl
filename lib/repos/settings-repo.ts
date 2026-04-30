import { storage } from '#imports';

// Define settings storage items
export const playSfxEnabledSetting = storage.defineItem('local:playSfxEnabled', {
    fallback: true,
});

export const showLiveProcessLogSetting = storage.defineItem('local:showLiveProcessLog', {
    fallback: true,
});

// Getter functions
export async function getPlaySfxEnabled(): Promise<boolean> {
    return await playSfxEnabledSetting.getValue();
}

export async function getShowLiveProcessLog(): Promise<boolean> {
    return await showLiveProcessLogSetting.getValue();
}

// Setter functions
export async function setPlaySfxEnabled(enabled: boolean): Promise<void> {
    await playSfxEnabledSetting.setValue(enabled);
}

export async function setShowLiveProcessLog(enabled: boolean): Promise<void> {
    await showLiveProcessLogSetting.setValue(enabled);
}

// Watch for changes to reactive updates
export function watchPlaySfxEnabled(callback: (value: boolean) => void) {
    return playSfxEnabledSetting.watch((newValue) => {
        callback(newValue);
    });
}

export function watchShowLiveProcessLog(callback: (value: boolean) => void): () => void {
    return showLiveProcessLogSetting.watch((newValue) => {
        callback(newValue);
    });
}
