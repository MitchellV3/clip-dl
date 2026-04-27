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
const V1_NOT_IMPLEMENTED_MESSAGE = 'This control is still visible for layout work, but only the preset duration buttons are implemented right now.'

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

function showNotImplementedToast(controlName: string) {
  toaster.create({
    title: 'Not implemented yet',
    description: `${controlName}: ${V1_NOT_IMPLEMENTED_MESSAGE}`,
    duration: 5000,
    closable: true,
  })
}

function formatSecondsForYtDlp(seconds: number) {
  return seconds.toFixed(3)
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

// Shared state for window.clip_* interop. The current v1 only wires duration
// buttons to the native host, but we keep these globals documented here because
// other content-side code already expects them to exist.
const clipState = {
  audioOnly: false,
  startTime: null as number | null,
  endTime: null as number | null,
  timeSelectionStatus: 'none' as 'none' | 'start_set' | 'end_set' | 'both_set',
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

// Audio-only toggle sub-component
function AudioOnlyToggle() {
  const [active, setActive] = useState(clipState.audioOnly)

  function handleClick() {
    console.log('Toggling audio-only mode. Current state:', active)
    const newValue = !active
    setActive(newValue)
    clipState.audioOnly = newValue
  }

  return (
    <Box
      borderBottom={'1px solid rgba(255,255,255,0.15)'}
      //margin={'0 -8px 0px'}
      padding={'4px 2px 4px'}
    >
      <Button
        onClick={() => showNotImplementedToast('Audio Only')}
        display={'flex'}
        alignItems={'center'}
        justifyContent={'space-between'}
        width={'100%'}
        backgroundColor={'transparent'}
        color={'#e2e2e2'}
        border={'none'}
        //padding={'8px 12px'}
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
function QualitySelector({ formats, loading, error }: { formats: { label: string; value: string }[], loading: boolean, error: string | null }) {
  return (
    <Box
      borderBottom={'1px solid rgba(255, 255, 255, 0.15)'}
    //margin={'0 -8px 8px'}
    //padding={'0 8px 8px'}
    //backgroundColor={'rgba(255, 255, 255, 0.03)'}
    >
      <Box
        display={"flex"}
        flexDirection={"column"}
        gap={"4px"}
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
          size={"lg"}
          padding={'8px 12px 8px'}
        //margin={'0 12px 8px'}
        >
          <NativeSelect.Field
            placeholder="Select quality"
            backgroundColor={'rgba(255, 255, 255, 0.05)'}
            color={'#e2e2e2'}
            border={'1px solid rgba(255, 255, 255, 0.2)'}
            borderRadius={'4px'}
            cursor={'pointer'}
            //padding={'12px 16px'}
            fontSize={'12px'}
            //margin={'12px 16px'}
            outline={'none'}
            //disabled={loading || !!error || formats.length === 0}
            width={'calc(100% - 24px)'}
            transition={'all 0.2s ease'}
            padding='16px 12px'
          >
            {loading &&
              <option
                value=""
              >
                Loading formats...
              </option>
            }
            {error &&
              <option
                value=""
                style={{ color: '#ef4444' }}
              >
                {error}
              </option>
            }
            {!loading &&
              !error &&
              formats.length === 0 &&
              <option
                value=""
                style={{ color: '#ef4444' }}
              >
                No formats detected
              </option>
            }
            {formats.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator marginRight={"42px"} />
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
    clearTimelinePreviewOverlay()
  }

  return (
    <Box
      display={"grid"}
      gridTemplateColumns={'repeat(2, 1fr)'}
      gap={'0px 8px'}
      padding={"0px 12px 0px"}
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

// Time selection sub-component
function TimeSelection() {
  const [status, setStatus] = useState<'none' | 'start_set' | 'end_set' | 'both_set'>('none')

  const updateStatus = useCallback(() => {
    if (window.clip_getTimeSelection) {
      const selection = window.clip_getTimeSelection()
      if (selection) {
        setStatus(selection.timeSelectionStatus)
      }
    }
  }, [])

  useEffect(() => {
    updateStatus()
  }, [updateStatus])

  function handleSetStart() {
    console.log('Setting start time for clip')
    const videoElement = document.querySelector('video.html5-main-video, video.video-player__video, video[playsinline]') as HTMLVideoElement | null
    if (videoElement) {
      if (window.clip_setStartTime) window.clip_setStartTime(videoElement.currentTime)
      if (window.clip_showTimelinePreview) window.clip_showTimelinePreview(videoElement.currentTime, videoElement.currentTime)
      updateStatus()
    }
    console.log('Start time set. Current time selection status:', status)
    console.log('Current clipState:', {
      startTime: clipState.startTime,
      endTime: clipState.endTime,
      audioOnly: clipState.audioOnly,
    })
  }

  function handleSetEnd() {
    console.log('Setting end time for clip')
    const videoElement = document.querySelector('video.html5-main-video, video.video-player__video, video[playsinline]') as HTMLVideoElement | null
    if (videoElement) {
      if (window.clip_setEndTime) window.clip_setEndTime(videoElement.currentTime)
      if (window.clip_showTimelinePreview) window.clip_showTimelinePreview(videoElement.currentTime, videoElement.currentTime)
      updateStatus()
    }
    console.log('End time set. Current time selection status:', status)
    console.log('Current clipState:', {
      startTime: clipState.startTime,
      endTime: clipState.endTime,
      audioOnly: clipState.audioOnly,
    })
  }

  function handleDownload() {
    console.log('Download clip with settings:', {
      audioOnly: clipState.audioOnly,
      startTime: clipState.startTime,
      endTime: clipState.endTime,
    })
    if (window.clip_handleCustomClipDownload) {
      const start = clipState.startTime || 0
      const duration = (clipState.endTime && clipState.startTime) ? (clipState.endTime - clipState.startTime) : -1
      window.clip_handleCustomClipDownload(duration, start)
    }
  }

  function handleCancel() {
    if (window.clip_clearTimeSelection) window.clip_clearTimeSelection()
    setStatus('none')
  }
  function handleUnavailableControl(controlName: string) {
    setStatus('none')
    showNotImplementedToast(controlName)
  }
  const showCancel = status === 'start_set' || status === 'end_set' || status === 'both_set'
  const showDownload = status === 'both_set'

  return (
    <Box
      //borderBottom={'1px solid rgba(255,255,255,0.15)'}
      margin={'0 -8px 0'}
      padding={'0 8px 0'}
    >
      <Box
        color={"#e2e2e2"}
        fontSize={"13px"}
        padding={"8px 12px 4px"}
        opacity={0.9}
        fontWeight={500}
      >
        Time Selection
      </Box>
      <Box
        display={"grid"}
        gridTemplateColumns={"repeat(2, 1fr)"}
        gap={"8px"}
        padding={"4px 12px"}
        overflow={"hidden"}
      >
        <Button
          onClick={() => handleUnavailableControl('Set Start Time')}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={"1px solid rgba(74, 222, 128, 0.3)"}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={"hidden"}
          wordBreak={"break-word"}
          whiteSpace={"normal"}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
        >
          <Text
            wordBreak={"break-word"}
            width={"100%"}
            height={"fit-content"}
          >
            Set Start Time
          </Text>
        </Button>
        <Button
          onClick={() => handleUnavailableControl('Set End Time')}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={"1px solid rgba(74, 222, 128, 0.3)"}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={"hidden"}
          wordBreak={"break-word"}
          whiteSpace={"normal"}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
        >
          <Text
            wordBreak={"break-word"}
            width={"100%"}
            height={"fit-content"}
          >
            Set End Time
          </Text>
        </Button>
        {showCancel && (
          <Button
            onClick={() => handleUnavailableControl('Cancel Selection')}
            backgroundColor={'rgba(239, 68, 68, 0.2)'}
            color={'#ef4444'}
            border={"1px solid rgba(239, 68, 68, 0.3)"}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={"hidden"}
            wordBreak={"break-word"}
            whiteSpace={"normal"}
            gridColumn={'1 / -1'}
            _hover={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Cancel Selection
          </Button>
        )}
        {showDownload && (
          <Button
            onClick={() => handleUnavailableControl('Download Clip')}
            backgroundColor={'#4ade80'}
            color={'#1a1a1a'}
            border={"none"}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={"hidden"}
            wordBreak={"break-word"}
            whiteSpace={"normal"}
            gridColumn={'1 / -1'}
            _hover={{
              backgroundColor: '#22c55e'
            }}

          >
            Download Clip
          </Button>
        )}
      </Box>
    </Box>
  )
}

// Toggle button SVG icon
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

  const handleToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()

    if (window.clip_isExtensionContextValid && !window.clip_isExtensionContextValid()) {
      if (window.clip_handleInvalidContext) window.clip_handleInvalidContext()
      return
    }

    setIsOpen((previous) => !previous)
  }, [])

  const handleDurationDownload = useCallback(async (seconds: number, label: string) => {
    if (isDownloading) {
      toaster.create({
        title: 'Download already running',
        description: 'Wait for the active clip download to finish before starting another one.',
        duration: 4000,
        closable: true,

      })
      return
    }

    if (seconds === -1) {
      showNotImplementedToast('Full Video')
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

    const request: ClipDownloadRequest = {
      type: 'download-clip',
      url: window.location.href,
      startTimeSeconds,
      endTimeSeconds,
      label,
    }

    const loadingToastId = `clip-download-${Date.now()}`

    emitPageDebugLog({
      stage: 'clip-download-requested',
      request: {
        ...request,
        startTimeSeconds: formatSecondsForYtDlp(request.startTimeSeconds),
        endTimeSeconds: formatSecondsForYtDlp(request.endTimeSeconds),
      },
    })

    setIsDownloading(true)
    toaster.loading({
      id: loadingToastId,
      title: 'Downloading clip',
      description: `Saving the last ${label.toLowerCase()} ending at ${formatSecondsForYtDlp(endTimeSeconds)}s. A progress window was opened on the desktop.`,
      closable: true,
    })

    let result: ClipDownloadResult | null = null

    try {
      // Content scripts cannot talk to native hosts directly. This proxy call
      // hops into the background script, which then forwards the request to the
      // Python host with browser.runtime.sendNativeMessage.
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

    emitPageDebugLog({ stage: 'clip-download-result', result })

    async function openFileLocation(result: Extract<ClipDownloadResult, { ok: true }>) {
      if (result && result.outputPath) {
        try {
          const opened = await clipDownloader.showDownloadedClipInFolder(result.outputPath)
          console.log('Explorer open result:', opened)
          console.log('Expected path:', result.outputPath)
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
      }

    }

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
      title: 'Clip download failed',
      description: result.message,
      duration: 10000,
      closable: true,
    })
  }, [isDownloading])

  useEffect(() => {
    // These globals preserve the current content-script integration points.
    // They intentionally do less in v1 so unfinished controls stay visible
    // without claiming to support full clipping workflows yet.
    window.clip_getAudioOnly = () => clipState.audioOnly
    window.clip_setAudioOnly = (value: boolean) => { clipState.audioOnly = value }
    window.clip_getStartTime = () => clipState.startTime
    window.clip_setStartTime = (time: number) => {
      clipState.startTime = time
      clipState.timeSelectionStatus = 'start_set'
    }
    window.clip_getEndTime = () => clipState.endTime
    window.clip_setEndTime = (time: number) => {
      clipState.endTime = time
      clipState.timeSelectionStatus = 'end_set'
    }
    window.clip_getTimeSelection = () => ({
      audioOnly: clipState.audioOnly,
      startTime: clipState.startTime,
      endTime: clipState.endTime,
      timeSelectionStatus: clipState.timeSelectionStatus,
    })
    window.clip_clearTimeSelection = () => {
      clipState.startTime = null
      clipState.endTime = null
      clipState.timeSelectionStatus = 'none'
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
    window.clip_handleCustomClipDownload = (_seconds: number, _startTime: number | null) => {
      showNotImplementedToast('Custom clip download')
    }
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
          display={"flex"}
          alignItems={"center"}
          justifyContent={"center"}
          overflow={"visible"}
        >
          <Bleed
            //padding={"1px"}
            display={"flex"}
            alignItems={"center"}
            justifyContent={"center"}
            padding={"0"}
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
          minH={"100px"}
          fontSize="12px"
          backdropFilter="blur(8px)"
          border="1px solid rgba(255, 255, 255, 0.2)"
          transformOrigin={'bottom center'}
          zIndex={"99999"}
          overflow={"hidden"}
          overflowX={"hidden"}
        >
          <Popover.Arrow />
          <Popover.Body >
            <Box display={"flex"} flexDirection={"column"} gap={2} width={"full"}>
              <AudioOnlyToggle />
              <QualitySelector formats={qualityFormats} loading={loadingFormats} error={formatError} />
              <DurationButtons isDownloading={isDownloading} onDownload={handleDurationDownload} />
              <TimeSelection />
            </Box>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  )
}
