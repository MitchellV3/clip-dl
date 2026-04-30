import { registerService } from '@webext-core/proxy-service';
import { CLIP_DOWNLOADER_KEY, DOWNLOAD_HISTORY_KEY } from '@/lib/services/proxy-service-keys';
import { DownloadHistoryRepo } from '../../lib/repos/download-history-repo';
import { NativeClipDownloaderRepo } from '../../lib/repos/native-clip-downloader-repo';

export default defineBackground(() => {

    // proxy-service registration must happen synchronously while the background
    // entrypoint is loading. If this moved behind an await, content scripts could
    // race the startup path and fail to find the service.
    registerService(CLIP_DOWNLOADER_KEY, NativeClipDownloaderRepo())
    registerService(DOWNLOAD_HISTORY_KEY, DownloadHistoryRepo())

})
