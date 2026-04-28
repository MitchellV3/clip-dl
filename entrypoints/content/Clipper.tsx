import { useState, useCallback, useEffect } from 'react'
import { Box, Popover, Button, Text, Bleed, NativeSelect } from '@chakra-ui/react'
import { createProxyService } from '@webext-core/proxy-service'
import { toaster } from '@/components/ui/toaster'
import { CLIP_DOWNLOADER_KEY } from '@/lib/services/proxy-service-keys'
import type { ClipDownloadRequest, ClipDownloadResult } from '@/lib/repos/native-clip-downloader-repo'
import './style.css'

const clipDownloader = createProxyService(CLIP_DOWNLOADER_KEY)
const PAGE_DEBUG_EVENT = '__clip_dl_native_debug__'
const FORMAT_PLACEHOLDER_MESSAGE = 'Format selection is not implemented in this first host-backed version.'
const CUSTOM_CLIP_LABEL = 'Custom Clip'
type TimeSelectionStatus = ClipTimeSelection['timeSelectionStatus']
type ResolvedClipRange = {
  startTimeSeconds: number
  endTimeSeconds: number
}

function emitPageDebugLog(payload: unknown) {
  window.postMessage({
    source: 'clip-dl',
    type: PAGE_DEBUG_EVENT,
    payload,
  }, '*')
}

function getActiveVideoElement() {
  return document.querySelector('video.html5-main-video, video.video-player__video, video[playsinline]') as HTMLVideoElement | null
}

function formatSecondsForYtDlp(seconds: number) {
  return seconds.toFixed(3)
}

function formatTimeDisplay(seconds: number) {
  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const TIMELINE_PREVIEW_OVERLAY_ID = 'clip-dl-timeline-preview-overlay'

function clearTimelinePreviewOverlay() {
  const overlay = document.getElementById(TIMELINE_PREVIEW_OVERLAY_ID)
  if (overlay) {
    overlay.remove()
  }
}

function renderTimelinePreviewOverlay(startSeconds: number, endSeconds: number) {
  const videoElement = getActiveVideoElement()
  const timelineContainer = document.querySelector('.ytp-progress-bar-container') as HTMLElement | null

  if (!videoElement || !timelineContainer) {
    clearTimelinePreviewOverlay()
    return
  }

  const durationSeconds = Number(videoElement.duration)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    clearTimelinePreviewOverlay()
    return
  }

  const start = Math.max(0, Math.min(Math.min(startSeconds, endSeconds), durationSeconds))
  const end = Math.max(0, Math.min(Math.max(startSeconds, endSeconds), durationSeconds))
  const span = end - start

  if (span <= 0) {
    clearTimelinePreviewOverlay()
    return
  }

  let overlay = document.getElementById(TIMELINE_PREVIEW_OVERLAY_ID) as HTMLDivElement | null
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = TIMELINE_PREVIEW_OVERLAY_ID
    overlay.style.position = 'absolute'
    overlay.style.top = '0'
    overlay.style.bottom = '0'
    overlay.style.pointerEvents = 'none'
    overlay.style.borderRadius = 'inherit'
    overlay.style.background = 'rgba(74, 222, 128, 0.35)'
    overlay.style.boxShadow = '0 0 0 1px rgba(74, 222, 128, 0.6) inset'
    overlay.style.zIndex = '999999'
    overlay.style.transition = 'left 120ms ease-out, width 120ms ease-out'
    overlay.style.borderRadius = '4px'

    const position = window.getComputedStyle(timelineContainer).position
    if (position === 'static') {
      timelineContainer.style.position = 'relative'
    }

    timelineContainer.appendChild(overlay)
  }

  const leftPercent = (start / durationSeconds) * 100
  const widthPercent = (span / durationSeconds) * 100

  overlay.style.left = `${leftPercent}%`
  overlay.style.width = `${widthPercent}%`
}

// Shared state for window.clip_* interop.
//TODO: Eventually we will let the user go into the extension settings and configure the default options here, such as default clip duration, whether to default to audio-only mode, default quality format, etc.
const clipState = {
  audioOnly: false,
  startTime: null as number | null,
  endTime: null as number | null,
  timeSelectionStatus: 'none' as TimeSelectionStatus,
  qualityFormats: [] as { label: string; value: string }[],
}

const clipDurations = [
  { label: '10 seconds', seconds: 10 },
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '3 minutes', seconds: 180 },
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
  { label: 'Full Video', seconds: -1 },
]

function getTimeSelectionStatus(startTime: number | null, endTime: number | null): TimeSelectionStatus {
  if (startTime !== null && endTime !== null) {
    return 'both_set'
  }
  if (startTime !== null) {
    return 'start_set'
  }
  if (endTime !== null) {
    return 'end_set'
  }
  return 'none'
}

function setClipTimeSelection(startTime: number | null, endTime: number | null) {
  clipState.startTime = startTime
  clipState.endTime = endTime
  clipState.timeSelectionStatus = getTimeSelectionStatus(startTime, endTime)
}

function getClipTimeSelection(): ClipTimeSelection {
  return {
    audioOnly: clipState.audioOnly,
    startTime: clipState.startTime,
    endTime: clipState.endTime,
    timeSelectionStatus: clipState.timeSelectionStatus,
  }
}

function applyStartTimeSelection(time: number): ClipTimeSelection {
  const nextStartTime = Number(time.toFixed(3))
  const nextEndTime = clipState.endTime !== null && clipState.endTime > nextStartTime
    ? clipState.endTime
    : null

  setClipTimeSelection(nextStartTime, nextEndTime)
  return getClipTimeSelection()
}

function applyEndTimeSelection(time: number): ClipTimeSelection {
  const nextEndTime = Number(time.toFixed(3))
  const nextStartTime = clipState.startTime !== null && clipState.startTime < nextEndTime
    ? clipState.startTime
    : null

  setClipTimeSelection(nextStartTime, nextEndTime)
  return getClipTimeSelection()
}

function clearClipTimeSelection(): ClipTimeSelection {
  setClipTimeSelection(null, null)
  return getClipTimeSelection()
}

function resolveSelectedClipRange(selection: ClipTimeSelection): ResolvedClipRange | null {
  if (selection.endTime === null) {
    return null
  }

  if (selection.startTime === null) {
    return {
      startTimeSeconds: 0,
      endTimeSeconds: selection.endTime,
    }
  }

  if (selection.endTime <= selection.startTime) {
    return null
  }

  return {
    startTimeSeconds: selection.startTime,
    endTimeSeconds: selection.endTime,
  }
}

function syncTimeSelectionPreview(selection: ClipTimeSelection) {
  const resolvedRange = resolveSelectedClipRange(selection)
  if (!resolvedRange || selection.timeSelectionStatus === 'start_set') {
    clearTimelinePreviewOverlay()
    return
  }

  renderTimelinePreviewOverlay(resolvedRange.startTimeSeconds, resolvedRange.endTimeSeconds)
}

// Audio-only toggle sub-component
function AudioOnlyToggle() {
  const [active, setActive] = useState(clipState.audioOnly)

  function handleClick() {
    const newValue = !active
    setActive(newValue)
    clipState.audioOnly = newValue
  }

  return (
    <Box
      borderBottom={'1px solid rgba(255,255,255,0.15)'}
      padding={'4px 2px 4px'}
    >
      <Button
        onClick={handleClick}
        display={'flex'}
        alignItems={'center'}
        justifyContent={'space-between'}
        width={'100%'}
        backgroundColor={'transparent'}
        color={'#e2e2e2'}
        border={'none'}
        cursor={'pointer'}
        fontSize={'12px'}
        textAlign={'left'}
        transition={'all 0.2s ease'}
        borderRadius={'4px'}
        _hover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
      >
        <Text>
          Audio Only
        </Text>
        <Box
          width={'32px'}
          height={'18px'}
          backgroundColor={active ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255, 255, 255, 0.15)'}
          borderRadius={'9px'}
          position={'relative'}
          transition={'all 0.2s ease'}
          border={'1px solid rgba(255, 255, 255, 0.2)'}
        >
          <Box
            width={'14px'}
            height={'14px'}
            backgroundColor={active ? '#4ade80' : '#e2e2e2'}
            borderRadius={'50%'}
            position={'absolute'}
            top={'1px'}
            left={active ? '15px' : '1px'}
            transition={'all 0.2s ease'}
            boxShadow={'xl'}
          />
        </Box>
      </Button>
    </Box>
  )
}

// Quality selector sub-component
//TODO: Implement the quality selector. The formats will either need to be fetched directly from the YouTube page's quality options or requested from the native host using yt-dlp's format detection. The dropdown is then asynchronously populated from that list of quality options. The user should be able to select a quality format from the dropdown, and that format should be sent to the native host to be used in the yt-dlp download request. We should also handle the case where no formats are available or an error occurs while fetching formats, and display an appropriate message in the dropdown.
function QualitySelector({ formats, loading, error }: { formats: { label: string; value: string }[], loading: boolean, error: string | null }) {
  return (
    <Box
      borderBottom={'1px solid rgba(255, 255, 255, 0.15)'}
    >
      <Box
        display={'flex'}
        flexDirection={'column'}
        gap={'4px'}
      >
        <Box
          color={'#e2e2e2'}
          fontSize={'12px'}
          padding={'8px 12px 0px'}
          opacity={0.9}
          fontWeight={500}
        >
          Video Quality
        </Box>
        <NativeSelect.Root
          size={'lg'}
          padding={'8px 12px 8px'}
        >
          <NativeSelect.Field
            placeholder="Select quality"
            backgroundColor={'rgba(255, 255, 255, 0.05)'}
            color={'#e2e2e2'}
            border={'1px solid rgba(255, 255, 255, 0.2)'}
            borderRadius={'4px'}
            cursor={'pointer'}
            fontSize={'12px'}
            outline={'none'}
            width={'calc(100% - 24px)'}
            transition={'all 0.2s ease'}
            padding='16px 12px'
          >
            {loading && (
              <option value="">
                Loading formats...
              </option>
            )}
            {error && (
              <option
                value=""
                style={{ color: '#ef4444' }}
              >
                {error}
              </option>
            )}
            {!loading && !error && formats.length === 0 && (
              <option
                value=""
                style={{ color: '#ef4444' }}
              >
                No formats detected
              </option>
            )}
            {formats.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator marginRight={'42px'} />
        </NativeSelect.Root>
      </Box>
    </Box>
  )
}

function DurationButtons({
  isDownloading,
  onDownload,
}: {
  isDownloading: boolean
  onDownload: (seconds: number, label: string) => Promise<void>
}) {
  async function handleClick(e: React.MouseEvent, seconds: number) {
    e.stopPropagation()

    const label = clipDurations.find((duration) => duration.seconds === seconds)?.label ?? `${seconds}s`
    emitPageDebugLog({ stage: 'duration-clicked', durationSeconds: seconds, label })

    await onDownload(seconds, label)
  }

  function handleDurationButtonHover(e: React.MouseEvent, seconds: number) {
    e.stopPropagation()

    const videoElement = getActiveVideoElement()
    if (!videoElement || !window.clip_showTimelinePreview) {
      return
    }

    const endTimeSeconds = Number(videoElement.currentTime.toFixed(3))
    if (seconds === -1) {
      const fullVideoEnd = Number.isFinite(videoElement.duration) ? Number(videoElement.duration.toFixed(3)) : endTimeSeconds
      window.clip_showTimelinePreview(0, fullVideoEnd)
      return
    }

    const startTimeSeconds = Number(Math.max(endTimeSeconds - seconds, 0).toFixed(3))
    window.clip_showTimelinePreview(startTimeSeconds, endTimeSeconds)
  }

  function handleDurationButtonHoverLeave(e: React.MouseEvent) {
    e.stopPropagation()
    syncTimeSelectionPreview(getClipTimeSelection())
  }

  return (
    <Box
      display={'grid'}
      gridTemplateColumns={'repeat(2, 1fr)'}
      gap={'0px 8px'}
      padding={'0px 12px 0px'}
    >
      {clipDurations.map((duration) => {
        const isFullVideo = duration.seconds === -1
        return (
          <Button
            key={duration.seconds}
            onClick={(event) => void handleClick(event, duration.seconds)}
            disabled={isDownloading}
            backgroundColor={isFullVideo ? 'rgba(255, 255, 255, 0.05)' : 'transparent'}
            color={isFullVideo ? '#ffffff' : '#e2e2e2'}
            border={isFullVideo ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent'}
            padding='16px 12px'
            margin={'1px 0'}
            borderRadius={'4px'}
            cursor={isDownloading ? 'progress' : 'pointer'}
            fontSize={'12px'}
            textAlign={'center'}
            transition={'all 0.2s ease'}
            fontWeight={isFullVideo ? '600' : '400'}
            gridColumn={isFullVideo ? '1 / -1' : 'auto'}
            opacity={isDownloading ? 0.6 : 1}
            _hover={{
              backgroundColor: isFullVideo ? 'rgba(255, 255, 255, 0.1)' : 'rgba(74, 222, 128, 0.1)',
              borderColor: isFullVideo ? 'rgba(255, 255, 255, 0.3)' : 'rgba(74, 222, 128, 0.3)',
            }}
            onMouseEnter={(event) => handleDurationButtonHover(event, duration.seconds)}
            onMouseLeave={handleDurationButtonHoverLeave}
          >
            {duration.label}
          </Button>
        )
      })}
    </Box>
  )
}

function TimeSelection({
  status,
  isDownloading,
  onSetStart,
  onSetEnd,
  onCancel,
  onDownload,
}: {
  status: TimeSelectionStatus
  isDownloading: boolean
  onSetStart: () => void
  onSetEnd: () => void
  onCancel: () => void
  onDownload: () => void
}) {
  const showCancel = status !== 'none'
  const showDownload = status === 'end_set' || status === 'both_set'

  return (
    <Box
      margin={'0 -8px 0'}
      padding={'0 8px 0'}
    >
      <Box
        color={'#e2e2e2'}
        fontSize={'13px'}
        padding={'8px 12px 4px'}
        opacity={0.9}
        fontWeight={500}
      >
        Time Selection
      </Box>
      <Box
        display={'grid'}
        gridTemplateColumns={'repeat(2, 1fr)'}
        gap={'8px'}
        padding={'4px 12px'}
        overflow={'hidden'}
      >
        <Button
          onClick={onSetStart}
          disabled={isDownloading}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={'1px solid rgba(74, 222, 128, 0.3)'}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={isDownloading ? 'progress' : 'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={'hidden'}
          wordBreak={'break-word'}
          whiteSpace={'normal'}
          opacity={isDownloading ? 0.6 : 1}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
        >
          <Text
            wordBreak={'break-word'}
            width={'100%'}
            height={'fit-content'}
          >
            Set Start Time
          </Text>
        </Button>
        <Button
          onClick={onSetEnd}
          disabled={isDownloading}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={'1px solid rgba(74, 222, 128, 0.3)'}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={isDownloading ? 'progress' : 'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={'hidden'}
          wordBreak={'break-word'}
          whiteSpace={'normal'}
          opacity={isDownloading ? 0.6 : 1}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
        >
          <Text
            wordBreak={'break-word'}
            width={'100%'}
            height={'fit-content'}
          >
            Set End Time
          </Text>
        </Button>
        {showCancel && (
          <Button
            onClick={onCancel}
            disabled={isDownloading}
            backgroundColor={'rgba(239, 68, 68, 0.2)'}
            color={'#ef4444'}
            border={'1px solid rgba(239, 68, 68, 0.3)'}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={isDownloading ? 'progress' : 'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={'hidden'}
            wordBreak={'break-word'}
            whiteSpace={'normal'}
            gridColumn={'1 / -1'}
            opacity={isDownloading ? 0.6 : 1}
            _hover={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Cancel Selection
          </Button>
        )}
        {showDownload && (
          <Button
            onClick={onDownload}
            disabled={isDownloading}
            backgroundColor={'#4ade80'}
            color={'#1a1a1a'}
            border={'none'}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={isDownloading ? 'progress' : 'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={'hidden'}
            wordBreak={'break-word'}
            whiteSpace={'normal'}
            gridColumn={'1 / -1'}
            opacity={isDownloading ? 0.6 : 1}
            _hover={{
              backgroundColor: '#22c55e',
            }}
          >
            Download Clip
          </Button>
        )}
      </Box>
    </Box>
  )
}

const ClipIcon = () => (
  <svg filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"
    style={{
      height: '60%',
      width: 'auto',
    }}>
    <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <path d="M.763 8.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 0 0-4.5 0m0 8.196a2.25 2.25 0 1 0 4.499 0a2.25 2.25 0 0 0-4.499 0" />
      <path d="m2.34 10.397l7.391 4.381l4.201 2.489M2.34 14.3l4.317-2.559m3.08.259V2.25a1.5 1.5 0 0 1 1.5-1.5h12m0 22.5h-12a1.5 1.5 0 0 1-1.5-1.5V18m4.5-8.25v-9m0 22.5v-3m-4.5-15h4.5m9 9V.75m0 22.5v-9m-13.5-4.5h13.5m-7.5 4.5h7.5" />
    </g>
  </svg>
)

export default function Clipper() {
  const [isOpen, setIsOpen] = useState(false)
  const [qualityFormats, setQualityFormats] = useState<{ label: string; value: string }[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [timeSelection, setTimeSelection] = useState<ClipTimeSelection>(() => getClipTimeSelection())

  useEffect(() => {
    const scriptId = 'clip-dl-page-console-bridge'
    if (document.getElementById(scriptId)) return

    const bridgeScript = document.createElement('script')
    bridgeScript.id = scriptId
    bridgeScript.textContent = `
      (() => {
        const EVENT_NAME = '${PAGE_DEBUG_EVENT}';
        if (window.__clipDlPageConsoleBridgeInstalled) return;
        window.__clipDlPageConsoleBridgeInstalled = true;
        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || data.source !== 'clip-dl' || data.type !== EVENT_NAME) return;
          console.log('[clip-dl][page-console-bridge]', data.payload);
        });
        console.log('[clip-dl][page-console-bridge] ready');
      })();
    `

    document.documentElement.appendChild(bridgeScript)
    bridgeScript.remove()
    emitPageDebugLog({ stage: 'content-script-mounted' })
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (window.clip_forceShowPlayerControls) window.clip_forceShowPlayerControls()
      setLoadingFormats(false)
      setQualityFormats([])
      setFormatError(FORMAT_PLACEHOLDER_MESSAGE)
    } else {
      clearTimelinePreviewOverlay()
      if (window.clip_restorePlayerControlsVisibility) window.clip_restorePlayerControlsVisibility()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      clearTimelinePreviewOverlay()
      return
    }

    syncTimeSelectionPreview(timeSelection)
  }, [isOpen, timeSelection])

  const handleToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()

    if (window.clip_isExtensionContextValid && !window.clip_isExtensionContextValid()) {
      if (window.clip_handleInvalidContext) window.clip_handleInvalidContext()
      return
    }

    setIsOpen((previous) => !previous)
  }, [])

  const openFileLocation = useCallback(async (result: Extract<ClipDownloadResult, { ok: true }>) => {
    if (!result.outputPath) {
      return
    }

    try {
      const opened = await clipDownloader.showDownloadedClipInFolder(result.outputPath)
      if (!opened) {
        toaster.error({
          title: 'File not found',
          description: 'Could not find the downloaded clip in the selected folder.',
          duration: 5000,
          closable: true,
        })
      }
    } catch {
      toaster.error({
        title: 'Folder access denied',
        description: 'Cannot access the folder to show the downloaded clip.',
        duration: 5000,
        closable: true,
      })
    }
  }, [])

  //TODO: Add ability to queue downloads instead of disabling the UI while a download is in progress.
  const runDownloadRequest = useCallback(async (request: ClipDownloadRequest) => {
    if (isDownloading) {
      toaster.create({
        title: 'Download already running',
        description: 'Wait for the active clip download to finish before starting another one.',
        duration: 4000,
        closable: true,
      })
      return
    }

    const loadingToastId = `clip-download-${Date.now()}`
    const loadingTitle = request.type === 'download-full-video'
      ? `Downloading ${request.audioOnly ? 'audio' : 'full video'}`
      : 'Downloading clip'
    const loadingDescription = request.type === 'download-full-video'
      ? `Saving the full ${request.audioOnly ? 'audio track' : 'video'} to Downloads. A progress window was opened on the desktop.`
      : `Saving clip from ${formatTimeDisplay(request.startTimeSeconds)} to ${formatTimeDisplay(request.endTimeSeconds)}. A progress window was opened on the desktop.`

    emitPageDebugLog({
      stage: 'native-download-requested',
      request: request.type === 'download-clip'
        ? {
          ...request,
          startTimeSeconds: formatSecondsForYtDlp(request.startTimeSeconds),
          endTimeSeconds: formatSecondsForYtDlp(request.endTimeSeconds),
        }
        : request,
    })

    setIsDownloading(true)
    toaster.loading({
      id: loadingToastId,
      title: loadingTitle,
      description: loadingDescription,
      closable: true,
    })

    let result: ClipDownloadResult | null = null

    try {
      result = await clipDownloader.downloadClip(request)
    } catch (error) {
      result = {
        ok: false,
        code: 'download-failed',
        message: String(error),
      }
    } finally {
      setIsDownloading(false)
      toaster.dismiss(loadingToastId)
    }

    emitPageDebugLog({ stage: 'native-download-result', result })

    if (result.ok) {
      toaster.success({
        title: 'Success',
        description: `Saved ${result.fileName} to Downloads.`,
        duration: 8000,
        closable: true,
        action: {
          label: 'Show file',
          onClick: () => {
            void openFileLocation(result)
          },
        },
      })
      return
    }

    toaster.error({
      title: request.type === 'download-full-video' ? 'Full video download failed' : 'Clip download failed',
      description: result.message,
      duration: 10000,
      closable: true,
    })
  }, [isDownloading, openFileLocation])

  const handleDurationDownload = useCallback(async (seconds: number, label: string) => {
    if (seconds === -1) {
      await runDownloadRequest({
        type: 'download-full-video',
        url: window.location.href,
        label,
        audioOnly: clipState.audioOnly,
      })
      return
    }

    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      return
    }

    const endTimeSeconds = Number(videoElement.currentTime.toFixed(3))
    const startTimeSeconds = Number(Math.max(endTimeSeconds - seconds, 0).toFixed(3))

    await runDownloadRequest({
      type: 'download-clip',
      url: window.location.href,
      startTimeSeconds,
      endTimeSeconds,
      label,
      audioOnly: clipState.audioOnly,
    })
  }, [runDownloadRequest])

  const handleSetStartTime = useCallback(() => {
    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      return
    }

    const nextSelection = applyStartTimeSelection(videoElement.currentTime)
    setTimeSelection(nextSelection)
    emitPageDebugLog({ stage: 'time-selection-updated', source: 'set-start-time', selection: nextSelection })
  }, [])

  const handleSetEndTime = useCallback(() => {
    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      return
    }

    const nextSelection = applyEndTimeSelection(videoElement.currentTime)
    setTimeSelection(nextSelection)
    emitPageDebugLog({ stage: 'time-selection-updated', source: 'set-end-time', selection: nextSelection })
  }, [])

  const handleCancelTimeSelection = useCallback(() => {
    const nextSelection = clearClipTimeSelection()
    setTimeSelection(nextSelection)
    clearTimelinePreviewOverlay()
    emitPageDebugLog({ stage: 'time-selection-cleared' })
  }, [])

  const handleCustomClipDownload = useCallback(async () => {
    const selection = getClipTimeSelection()
    const resolvedRange = resolveSelectedClipRange(selection)

    if (!resolvedRange) {
      toaster.create({
        title: 'Invalid selection',
        description: 'Set an end time, or both start and end times, before downloading a custom clip.',
        duration: 5000,
        closable: true,
      })
      return
    }

    await runDownloadRequest({
      type: 'download-clip',
      url: window.location.href,
      startTimeSeconds: resolvedRange.startTimeSeconds,
      endTimeSeconds: resolvedRange.endTimeSeconds,
      label: CUSTOM_CLIP_LABEL,
      audioOnly: clipState.audioOnly,
    })
  }, [runDownloadRequest])

  useEffect(() => {
    window.clip_getAudioOnly = () => clipState.audioOnly
    window.clip_setAudioOnly = (value: boolean) => { clipState.audioOnly = value }
    window.clip_getStartTime = () => clipState.startTime
    window.clip_setStartTime = (time: number) => {
      setTimeSelection(applyStartTimeSelection(time))
    }
    window.clip_getEndTime = () => clipState.endTime
    window.clip_setEndTime = (time: number) => {
      setTimeSelection(applyEndTimeSelection(time))
    }
    window.clip_getTimeSelection = () => getClipTimeSelection()
    window.clip_clearTimeSelection = () => {
      setTimeSelection(clearClipTimeSelection())
    }
    window.clip_toggleClipMenu = (event: MouseEvent) => {
      if (event) event.stopPropagation()
      setIsOpen((previous) => !previous)
    }
    window.clip_forceShowPlayerControls = () => { }
    window.clip_restorePlayerControlsVisibility = () => { }
    window.clip_showTimelinePreview = (start: number, end: number) => {
      renderTimelinePreviewOverlay(start, end)
    }
    window.clip_fetchVideoFormats = async (_url: string) => []
    window.clip_updateQualityOptions = (formats: { label: string; value: string }[]) => {
      setQualityFormats(formats)
      clipState.qualityFormats = formats
    }
    window.clip_updateQualityOptionsError = (message: string) => setFormatError(message)
    window.clip_isExtensionContextValid = () => true
    window.clip_handleInvalidContext = () => { }
    window.clip_handleClipOptionClick = (_event: MouseEvent) => { }
  }, [])

  return (
    <Popover.Root
      portalled={false}
      open={isOpen}
      onOpenChange={(event) => setIsOpen(event.open)}
    >
      <Popover.Trigger
        asChild
      >
        <Button
          className={'ytp-button'}
          onClick={handleToggle}
          display={'flex'}
          alignItems={'center'}
          justifyContent={'center'}
          overflow={'visible'}
        >
          <Bleed
            display={'flex'}
            alignItems={'center'}
            justifyContent={'center'}
            padding={'0'}
          >
            <ClipIcon />
          </Bleed>
        </Button>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content
          bg="rgba(28, 28, 28, 0.95)"
          color="#e2e2e2"
          borderRadius="xl"
          boxShadow="xl"
          p={8}
          m={4}
          minW="200px"
          minH={'100px'}
          fontSize="12px"
          backdropFilter="blur(8px)"
          border="1px solid rgba(255, 255, 255, 0.2)"
          transformOrigin={'bottom center'}
          zIndex={'99999'}
          overflow={'hidden'}
          overflowX={'hidden'}
        >
          <Popover.Arrow />
          <Popover.Body>
            <Box display={'flex'} flexDirection={'column'} gap={2} width={'full'}>
              <AudioOnlyToggle />
              <QualitySelector formats={qualityFormats} loading={loadingFormats} error={formatError} />
              <DurationButtons isDownloading={isDownloading} onDownload={handleDurationDownload} />
              <TimeSelection
                status={timeSelection.timeSelectionStatus}
                isDownloading={isDownloading}
                onSetStart={handleSetStartTime}
                onSetEnd={handleSetEndTime}
                onCancel={handleCancelTimeSelection}
                onDownload={() => void handleCustomClipDownload()}
              />
            </Box>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  )
}
