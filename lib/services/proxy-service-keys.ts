import type { ProxyServiceKey } from '@webext-core/proxy-service';
import type { NativeClipDownloaderRepo } from '../repos/native-clip-downloader-repo';

export const CLIP_DOWNLOADER_KEY = 'clip-downloader' as ProxyServiceKey<ReturnType<typeof NativeClipDownloaderRepo>>;
