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

export const organizeByUploaderSetting = storage.defineItem('local:organizeByUploader', {
    fallback: false,
});

export const downloadDirectorySetting = storage.defineItem('local:downloadDirectory', {
    fallback: '',
});

export const cookiesFileSetting = storage.defineItem('local:cookiesFile', {
    fallback: '',
});

export const downloaderSetting = storage.defineItem('local:downloader', {
    fallback: 'native',
});

export const downloadFileFormatSetting = storage.defineItem('local:downloadFileFormat', {
    fallback: 'mkv',
});

export const fileNamingTemplateSetting = storage.defineItem('local:fileNamingTemplate', {
    fallback: '',
});

export const enableScreenshotButtonSetting = storage.defineItem('local:enableScreenshotButton', {
    fallback: true,
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

export async function getOrganizeByUploader(): Promise<boolean> {
    return await organizeByUploaderSetting.getValue();
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

export async function setOrganizeByUploader(enabled: boolean): Promise<void> {
    await organizeByUploaderSetting.setValue(enabled);
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

export function watchOrganizeByUploader(callback: (value: boolean) => void) {
    return organizeByUploaderSetting.watch((newValue) => {
        callback(newValue);
    });
}

// Downloader functions
export async function getDownloader(): Promise<string> {
    return await downloaderSetting.getValue();
}

export async function setDownloader(downloader: string): Promise<void> {
    await downloaderSetting.setValue(downloader);
}

export function watchDownloader(callback: (value: string) => void) {
    return downloaderSetting.watch((newValue) => {
        callback(newValue);
    });
}

// Download directory functions
export async function getDownloadDirectory(): Promise<string> {
    const value = await downloadDirectorySetting.getValue();
    console.warn(`[clip-dl] getDownloadDirectory() => "${value}"`);
    return value;
}

export async function setDownloadDirectory(path: string): Promise<void> {
    await downloadDirectorySetting.setValue(path);
}

export function watchDownloadDirectory(callback: (value: string) => void) {
    return downloadDirectorySetting.watch((newValue) => {
        callback(newValue);
    });
}

// Cookies file functions
export async function getCookiesFile(): Promise<string> {
    return await cookiesFileSetting.getValue();
}

export async function setCookiesFile(path: string): Promise<void> {
    await cookiesFileSetting.setValue(path);
}

export function watchCookiesFile(callback: (value: string) => void) {
    return cookiesFileSetting.watch((newValue) => {
        callback(newValue);
    });
}

// File format functions
export async function getDownloadFileFormat(): Promise<string> {
    return await downloadFileFormatSetting.getValue();
}

export async function setDownloadFileFormat(format: string): Promise<void> {
    await downloadFileFormatSetting.setValue(format);
}

export function watchDownloadFileFormat(callback: (value: string) => void) {
    return downloadFileFormatSetting.watch((newValue) => {
        callback(newValue);
    });
}

// File naming template functions
export async function getFileNamingTemplate(): Promise<string> {
    return await fileNamingTemplateSetting.getValue();
}

export async function setFileNamingTemplate(template: string): Promise<void> {
    await fileNamingTemplateSetting.setValue(template);
}

export function watchFileNamingTemplate(callback: (value: string) => void) {
    return fileNamingTemplateSetting.watch((newValue) => {
        callback(newValue);
    });
}

// Screenshot button setting
export async function getEnableScreenshotButton(): Promise<boolean> {
    return await enableScreenshotButtonSetting.getValue();
}

export async function setEnableScreenshotButton(enabled: boolean): Promise<void> {
    await enableScreenshotButtonSetting.setValue(enabled);
}

export function watchEnableScreenshotButton(callback: (value: boolean) => void) {
    return enableScreenshotButtonSetting.watch((newValue) => {
        callback(newValue);
    });
}
