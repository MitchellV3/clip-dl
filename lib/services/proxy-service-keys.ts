import type { ProxyServiceKey } from '@webext-core/proxy-service';
import type { DownloadHistoryRepo } from '../repos/download-history-repo';
import type { NativeClipDownloaderRepo } from '../repos/native-clip-downloader-repo';

export const CLIP_DOWNLOADER_KEY = 'clip-downloader' as ProxyServiceKey<ReturnType<typeof NativeClipDownloaderRepo>>;
export const DOWNLOAD_HISTORY_KEY = 'download-history' as ProxyServiceKey<ReturnType<typeof DownloadHistoryRepo>>;
