import { storage } from '#imports';

// Define settings storage items
export const playSfxEnabledSetting = storage.defineItem('local:playSfxEnabled', {
    fallback: true,
});

export const showLiveProcessLogSetting = storage.defineItem('local:showLiveProcessLog', {
    fallback: true,
});

export const organizeByDateSetting = storage.defineItem('local:organizeByDate', {
    fallback: false,
});

export const organizeBySourceSetting = storage.defineItem('local:organizeBySource', {
    fallback: false,
});

// Getter functions
export async function getPlaySfxEnabled(): Promise<boolean> {
    return await playSfxEnabledSetting.getValue();
}

export async function getShowLiveProcessLog(): Promise<boolean> {
    return await showLiveProcessLogSetting.getValue();
}

export async function getOrganizeByDate(): Promise<boolean> {
    return await organizeByDateSetting.getValue();
}

export async function getOrganizeBySource(): Promise<boolean> {
    return await organizeBySourceSetting.getValue();
}

// Setter functions
export async function setPlaySfxEnabled(enabled: boolean): Promise<void> {
    await playSfxEnabledSetting.setValue(enabled);
}

export async function setShowLiveProcessLog(enabled: boolean): Promise<void> {
    await showLiveProcessLogSetting.setValue(enabled);
}

export async function setOrganizeByDate(enabled: boolean): Promise<void> {
    await organizeByDateSetting.setValue(enabled);
}

export async function setOrganizeBySource(enabled: boolean): Promise<void> {
    await organizeBySourceSetting.setValue(enabled);
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

export function watchOrganizeByDate(callback: (value: boolean) => void) {
    return organizeByDateSetting.watch((newValue) => {
        callback(newValue);
    });
}

export function watchOrganizeBySource(callback: (value: boolean) => void) {
    return organizeBySourceSetting.watch((newValue) => {
        callback(newValue);
    });
}
