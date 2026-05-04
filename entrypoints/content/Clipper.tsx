import { useState, useCallback, useEffect } from 'react'
import { Box, Popover, Button, Text, Bleed, Spinner } from '@chakra-ui/react'
import { createProxyService } from '@webext-core/proxy-service'
import { toaster } from '@/components/ui/toaster'
import { CLIP_DOWNLOADER_KEY } from '@/lib/services/proxy-service-keys'
import { playSfx } from '@/lib/services/sfx'
import { getPlaySfxEnabled, watchPlaySfxEnabled, getShowLiveProcessLog, watchShowLiveProcessLog, getOrganizeByDate, watchOrganizeByDate, getOrganizeBySource, watchOrganizeBySource, getOrganizeByUploader, watchOrganizeByUploader, getDownloadFileFormat, getFileNamingTemplate, watchFileNamingTemplate, getLiveStreamMode, setLiveStreamMode, watchLiveStreamMode } from '@/lib/repos/settings-repo'
import type { ClipDownloadRequest, ClipDownloadResult, ClipRangeDownloadRequest, FullVideoDownloadRequest } from '@/lib/repos/native-clip-downloader-repo'
import './style.css'

const clipDownloader = createProxyService(CLIP_DOWNLOADER_KEY)
const PAGE_DEBUG_EVENT = '__clip_dl_native_debug__'
const FORMAT_PLACEHOLDER_MESSAGE = 'Format selection is not implemented in this first host-backed version.'
const CUSTOM_CLIP_LABEL = 'Custom Clip'
const MAX_QUEUE_SIZE = 5

type TimeSelectionStatus = ClipTimeSelection['timeSelectionStatus']
type ResolvedClipRange = {
  startTimeSeconds: number
  endTimeSeconds: number
}

type QueueJobStatus = 'pending' | 'processing' | 'success' | 'failed'

interface QueueJob {
  id: string
  request: ClipDownloadRequest
  status: QueueJobStatus
  createdAt: number
  toastId: string
  result?: Extract<ClipDownloadResult, { ok: true }>
  error?: { code: string; message: string }
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

function getPageVideoTitle() {
  const rawTitle = document.title || ''
  return rawTitle
    .replace(/\s*-\s*YouTube\s*$/i, '')
    .replace(/\s*-\s*Twitch\s*$/i, '')
    .trim()
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
  // If on YouTube, use .ytp-progress-bar-container. If on Twitch, use .seekbar-bar
  const isYouTube = window.location.hostname.includes('youtube.com')
  const timelineContainer = isYouTube
    ? document.querySelector('.ytp-progress-bar-container') as HTMLElement | null
    : document.querySelector('.seekbar-bar') as HTMLElement | null


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
  selectedFormatValue: null as string | null,
}

// Format cache: URL -> { formats, selectedValue }
// This persists for the lifetime of the content script (single page session)
const formatCache = new Map<string, {
  formats: { label: string; value: string }[]
  selectedValue: string | null
}>()

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
          height={'16px'}
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

// Livestream mode toggle sub-component
function LivestreamModeToggle({ active, onChange, isAutoDetected }: { active: boolean; onChange: (value: boolean) => void; isAutoDetected?: boolean }) {
  function handleClick() {
    const newValue = !active
    onChange(newValue)
  }

  const title = isAutoDetected 
    ? "Livestream mode auto-detected (URL contains /live/). Downloads past duration using ypb."
    : "Enable livestream mode for YouTube live streams. Downloads past duration using ypb."

  return (
    <Box
      borderBottom={'1px solid rgba(255,255,255,0.15)'}
      padding={'4px 2px 4px'}
      backgroundColor={isAutoDetected && active ? 'rgba(74, 222, 128, 0.1)' : undefined}
      transition={'all 0.2s ease'}
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
        title={title}
      >
        <Text>
          Livestream Mode {isAutoDetected && active ? '✓' : ''}
        </Text>
        <Box
          width={'32px'}
          height={'16px'}
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
function QualitySelector({
  formats,
  loading,
  error,
  selectedValue,
  onSelectionChange,
  disabled,
}: {
  formats: { label: string; value: string }[]
  loading: boolean
  error: string | null
  selectedValue: string | null
  onSelectionChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <Box
      borderBottom={'1px solid rgba(255, 255, 255, 0.15)'}
    >
      <Box
        display={'flex'}
        flexDirection={'column'}
        gap={'4px'}
        marginBottom={"12px"}
      >
        <Box
          color={'#e2e2e2'}
          fontSize={'12px'}
          padding={'8px 12px 0px'}
          opacity={0.9}
          fontWeight={500}
        >
          <Box display={'flex'} justifyContent={"space-between"} gap={'8px'}>
            <label id={'clip-dl-quality-label'} className={'clip-dl-quality-label'}>
              <Text>Video Quality</Text>

              <select
                id={'clip-dl-quality'}
                className={'clip-dl-quality-select'}
                title={disabled ? 'Quality selector disabled during audio-only mode' : 'Quality selector'}
                aria-label={disabled ? 'Quality selector disabled during audio-only mode' : 'Quality selector'}
                aria-labelledby={'clip-dl-quality-label'}
                value={selectedValue || ''}
                disabled={disabled || loading || error !== null}
                onChange={(e) => {
                  // Only allow selection change if not disabled, not loading, and no error
                  if (!disabled && !loading && error === null) {
                    const newValue = e.currentTarget.value
                    if (newValue) {
                      onSelectionChange(newValue)
                    }
                  }
                }}
              >
                {loading && (
                  <option title='Loading'
                    label='Loading formats...'
                    value="">
                    Loading formats...
                  </option>
                )}
                {error && !loading && (
                  <option title='Error'
                    label='Error loading formats'
                    value=""
                    className={'clip-dl-select-option-error'}
                  >
                    Error: {error}
                  </option>
                )}
                {!loading && !error && formats.length === 0 && (
                  <option title='No formats'
                    label='No formats detected'
                    value=""
                    className={'clip-dl-select-option-error'}
                  >
                    No formats detected
                  </option>
                )}
                {!loading && !error && formats.length > 0 && (
                  <>
                    {formats.map((fmt) => (
                      <option title={fmt.label}
                        key={fmt.value}
                        value={fmt.value}>
                        {fmt.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function DurationButtons({
  shouldDisable,
  onDownload,
}: {
  shouldDisable: boolean
  onDownload: (seconds: number, label: string) => void
}) {
  function handleClick(e: React.MouseEvent, seconds: number) {
    e.stopPropagation()

    const label = clipDurations.find((duration) => duration.seconds === seconds)?.label ?? `${seconds}s`
    emitPageDebugLog({ stage: 'duration-clicked', durationSeconds: seconds, label })

    onDownload(seconds, label)
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
            onClick={(event) => handleClick(event, duration.seconds)}
            disabled={shouldDisable}
            backgroundColor={isFullVideo ? 'rgba(255, 255, 255, 0.05)' : 'transparent'}
            color={isFullVideo ? '#ffffff' : '#e2e2e2'}
            border={isFullVideo ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent'}
            //padding='16px 12px'
            margin={'1px 0'}
            borderRadius={'4px'}
            cursor={shouldDisable ? 'progress' : 'pointer'}
            fontSize={'12px'}
            textAlign={'center'}
            transition={'all 0.2s ease'}
            fontWeight={isFullVideo ? '600' : '400'}
            gridColumn={isFullVideo ? '1 / -1' : 'auto'}
            opacity={shouldDisable ? 0.6 : 1}
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
  shouldDisable,
  onSetStart,
  onSetEnd,
  onCancel,
  onDownload,
}: {
  status: TimeSelectionStatus
  shouldDisable: boolean
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
          disabled={shouldDisable}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={'1px solid rgba(74, 222, 128, 0.3)'}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={shouldDisable ? 'progress' : 'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={'hidden'}
          wordBreak={'break-word'}
          whiteSpace={'normal'}
          opacity={shouldDisable ? 0.6 : 1}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
          textAlign={'center'}
        >
          Set Start Time
        </Button>
        <Button
          onClick={onSetEnd}
          disabled={shouldDisable}
          backgroundColor={'rgba(74, 222, 128, 0.2)'}
          color={'#4ade80'}
          border={'1px solid rgba(74, 222, 128, 0.3)'}
          padding={'16px 12px'}
          borderRadius={'4px'}
          cursor={shouldDisable ? 'progress' : 'pointer'}
          fontSize={'12px'}
          fontWeight={'600'}
          transition={'all 0.2s ease'}
          overflow={'hidden'}
          wordBreak={'break-word'}
          whiteSpace={'normal'}
          opacity={shouldDisable ? 0.6 : 1}
          _hover={{ backgroundColor: 'rgba(74, 222, 128, 0.3)' }}
          textAlign={'center'}
        >
          Set End Time
        </Button>
        {showCancel && (
          <Button
            onClick={onCancel}
            disabled={shouldDisable}
            backgroundColor={'rgba(239, 68, 68, 0.2)'}
            color={'#ef4444'}
            border={'1px solid rgba(239, 68, 68, 0.3)'}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={shouldDisable ? 'progress' : 'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={'hidden'}
            wordBreak={'break-word'}
            whiteSpace={'normal'}
            gridColumn={'1 / -1'}
            opacity={shouldDisable ? 0.6 : 1}
            _hover={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Cancel Selection
          </Button>
        )}
        {showDownload && (
          <Button
            onClick={onDownload}
            disabled={shouldDisable}
            backgroundColor={'#4ade80'}
            color={'#1a1a1a'}
            border={'none'}
            padding={'16px 12px'}
            borderRadius={'4px'}
            cursor={shouldDisable ? 'progress' : 'pointer'}
            fontSize={'12px'}
            fontWeight={'600'}
            transition={'all 0.2s ease'}
            overflow={'hidden'}
            wordBreak={'break-word'}
            whiteSpace={'normal'}
            gridColumn={'1 / -1'}
            opacity={shouldDisable ? 0.6 : 1}
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

const ClipIcon = () => {
  const isTwitch = window.location.hostname.includes('twitch.tv')
  const className = `clip-dl-icon${isTwitch ? ' clip-dl-icon-twitch' : ''}`
  return (
    <svg className={className} filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M.763 8.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 0 0-4.5 0m0 8.196a2.25 2.25 0 1 0 4.499 0a2.25 2.25 0 0 0-4.499 0" />
        <path d="m2.34 10.397l7.391 4.381l4.201 2.489M2.34 14.3l4.317-2.559m3.08.259V2.25a1.5 1.5 0 0 1 1.5-1.5h12m0 22.5h-12a1.5 1.5 0 0 1-1.5-1.5V18m4.5-8.25v-9m0 22.5v-3m-4.5-15h4.5m9 9V.75m0 22.5v-9m-13.5-4.5h13.5m-7.5 4.5h7.5" />
      </g>
    </svg>
  )
}

export default function Clipper() {
  const [isOpen, setIsOpen] = useState(false)
  const [qualityFormats, setQualityFormats] = useState<{ label: string; value: string }[]>([])
  const [selectedFormatValue, setSelectedFormatValue] = useState<string | null>(null)
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [lastLoadedUrl, setLastLoadedUrl] = useState<string | null>(null)
  const [downloadQueue, setDownloadQueue] = useState<QueueJob[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [timeSelection, setTimeSelection] = useState<ClipTimeSelection>(() => getClipTimeSelection())
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [showLiveProcessLogEnabled, setShowLiveProcessLogEnabled] = useState(true)
  const [organizeByDateEnabled, setOrganizeByDateEnabled] = useState(false)
  const [organizeBySourceEnabled, setOrganizeBySourceEnabled] = useState(false)
  const [organizeByUploaderEnabled, setOrganizeByUploaderEnabled] = useState(false)
  const [fileFormat, setFileFormat] = useState('mkv')
  const [fileNamingTemplate, setFileNamingTemplate] = useState('')
  const [livestreamModeEnabled, setLiveStreamModeEnabled] = useState(false)
  const [isLivestreamUrlAutoDetected, setIsLivestreamUrlAutoDetected] = useState(false)

  // Derived state for button disabling
  const isQueueFull = downloadQueue.length >= MAX_QUEUE_SIZE
  const shouldDisableDownloadButtons = isQueueFull

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

  // Load SFX setting from storage on mount
  useEffect(() => {
    const loadSfxSetting = async () => {
      const enabled = await getPlaySfxEnabled()
      setSfxEnabled(enabled)
    }
    void loadSfxSetting()

    // Subscribe to setting changes
    const unsubscribe = watchPlaySfxEnabled((value) => {
      setSfxEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Load showLiveProcessLog setting from storage on mount
  useEffect(() => {
    const loadShowLiveProcessLogSetting = async () => {
      const enabled = await getShowLiveProcessLog()
      setShowLiveProcessLogEnabled(enabled)
    }
    void loadShowLiveProcessLogSetting()

    const unsubscribe = watchShowLiveProcessLog((value) => {
      setShowLiveProcessLogEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadOrganizeByDateSetting = async () => {
      const enabled = await getOrganizeByDate()
      setOrganizeByDateEnabled(enabled)
    }
    void loadOrganizeByDateSetting()

    const unsubscribe = watchOrganizeByDate((value) => {
      setOrganizeByDateEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadOrganizeBySourceSetting = async () => {
      const enabled = await getOrganizeBySource()
      console.log('[clip-dl] Loaded organizeBySource setting:', enabled)
      setOrganizeBySourceEnabled(enabled)
    }
    void loadOrganizeBySourceSetting()

    const unsubscribe = watchOrganizeBySource((value) => {
      console.log('[clip-dl] organizeBySource setting changed:', value)
      setOrganizeBySourceEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadOrganizeByUploaderSetting = async () => {
      const enabled = await getOrganizeByUploader()
      console.log('[clip-dl] Loaded organizeByUploader setting:', enabled)
      setOrganizeByUploaderEnabled(enabled)
    }
    void loadOrganizeByUploaderSetting()

    const unsubscribe = watchOrganizeByUploader((value) => {
      console.log('[clip-dl] organizeByUploader setting changed:', value)
      setOrganizeByUploaderEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadFileFormatSetting = async () => {
      const format = await getDownloadFileFormat()
      setFileFormat(format)
    }
    void loadFileFormatSetting()

    const loadFileNamingTemplateSetting = async () => {
      const template = await getFileNamingTemplate()
      setFileNamingTemplate(template)
    }
    void loadFileNamingTemplateSetting()

    const unsubscribeFileNamingTemplate = watchFileNamingTemplate((value) => {
      setFileNamingTemplate(value)
    })
  }, [])

  // Load livestream mode setting from storage on mount
  // Auto-enable livestream mode if the current URL is a YouTube livestream
  useEffect(() => {
    const loadLiveStreamModeSetting = async () => {
      const currentUrl = window.location.href
      const isLivestreamUrl = currentUrl.includes('/live/')
      
      const enabled = await getLiveStreamMode()
      const shouldEnable = enabled || isLivestreamUrl
      
      setLiveStreamModeEnabled(shouldEnable)
      setIsLivestreamUrlAutoDetected(isLivestreamUrl)
      
      // If we auto-detected a livestream but it wasn't previously enabled, save it
      if (isLivestreamUrl && !enabled) {
        await setLiveStreamMode(true)
      }
    }
    void loadLiveStreamModeSetting()

    const unsubscribe = watchLiveStreamMode((value) => {
      setLiveStreamModeEnabled(value)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      clearTimelinePreviewOverlay()
      if (window.clip_restorePlayerControlsVisibility) window.clip_restorePlayerControlsVisibility()
      return
    }

    // When opening the popover, show player controls and fetch formats if needed
    if (window.clip_forceShowPlayerControls) window.clip_forceShowPlayerControls()

    const currentUrl = window.location.href

    // Check if we already loaded formats for this URL
    if (lastLoadedUrl === currentUrl && formatCache.has(currentUrl)) {
      const cached = formatCache.get(currentUrl)!
      setQualityFormats(cached.formats)
      setSelectedFormatValue(cached.selectedValue)
      setLoadingFormats(false)
      setFormatError(null)
      clipState.qualityFormats = cached.formats
      clipState.selectedFormatValue = cached.selectedValue
      return
    }

    // Different URL or no cache: fetch new formats
    if (lastLoadedUrl !== currentUrl) {
      setLastLoadedUrl(currentUrl)
      setSelectedFormatValue(null)
      clipState.selectedFormatValue = null
    }

    setLoadingFormats(true)
    setFormatError(null)

    // Fetch formats from native host
    clipDownloader.getVideoFormats(currentUrl).then((result) => {
      if (result.ok) {
        const formats = result.formats
        setQualityFormats(formats)
        setLoadingFormats(false)
        setFormatError(null)
        clipState.qualityFormats = formats

        // Auto-select the first format (best available)
        if (formats.length > 0) {
          const firstValue = formats[0].value
          setSelectedFormatValue(firstValue)
          clipState.selectedFormatValue = firstValue
        }

        // Cache the result
        formatCache.set(currentUrl, {
          formats,
          selectedValue: formats.length > 0 ? formats[0].value : null,
        })
      } else {
        setLoadingFormats(false)
        setFormatError(result.message)
        clipState.qualityFormats = []
        setQualityFormats([])
      }
    }).catch((error) => {
      setLoadingFormats(false)
      setFormatError('Failed to fetch formats')
      clipState.qualityFormats = []
      setQualityFormats([])
      console.warn('[clip-dl] Error fetching formats:', error)
    })
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
      if (sfxEnabled) playSfx('error')
      if (window.clip_handleInvalidContext) window.clip_handleInvalidContext()
      return
    }

    setIsOpen((previous) => !previous)
  }, [sfxEnabled])

  const handleFormatSelectionChange = useCallback((newValue: string) => {
    setSelectedFormatValue(newValue)
    clipState.selectedFormatValue = newValue

    // Update cache for current URL
    const currentUrl = window.location.href
    if (formatCache.has(currentUrl)) {
      const cached = formatCache.get(currentUrl)!
      cached.selectedValue = newValue
    }
  }, [])

  const handleLiveStreamModeToggle = useCallback(async (enabled: boolean) => {
    setLiveStreamModeEnabled(enabled)
    await setLiveStreamMode(enabled)
  }, [])

  const openFileLocation = useCallback(async (result: Extract<ClipDownloadResult, { ok: true }>) => {
    if (!result.outputPath) {
      return
    }

    try {
      const opened = await clipDownloader.showDownloadedClipInFolder(result.outputPath)
      if (!opened) {
        toaster.error({
          type: 'error',
          title: 'File not found',
          description: 'Could not find the downloaded clip in the selected folder.',
          duration: 5000,
          closable: true,
        })
        if (sfxEnabled) playSfx('error')
      }
    } catch {
      toaster.error({
        type: 'error',
        title: 'Folder access denied',
        description: 'Cannot access the folder to show the downloaded clip.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
    }
  }, [sfxEnabled])

  const enqueueDownload = useCallback((request: ClipDownloadRequest) => {
    console.log('[clip-dl] Enqueueing download:', { type: request.type, organizeByDate: request.organizeByDate, organizeBySource: request.organizeBySource, organizeByUploader: request.organizeByUploader })
    if (isQueueFull) {
      toaster.create({
        type: 'error',
        title: 'Queue full',
        description: `Maximum ${MAX_QUEUE_SIZE} downloads can be queued. Wait for some to complete before adding more.`,
        duration: 4000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toastId = `queue-${jobId}`
    const newJob: QueueJob = {
      id: jobId,
      request,
      status: 'pending',
      createdAt: Date.now(),
      toastId,
    }

    const nextQueue = [...downloadQueue, newJob]
    setDownloadQueue(nextQueue)

    // Show queued toast with position
    toaster.create({
      type: 'info',
      id: toastId,
      title: 'Download queued',
      description: `Position ${nextQueue.length}/${MAX_QUEUE_SIZE} in queue`,
      duration: 3000,
      closable: true,
    })
    if (sfxEnabled) playSfx('start_recording')

    emitPageDebugLog({
      stage: 'download-queued',
      jobId,
      position: nextQueue.length,
      request: request.type === 'download-clip'
        ? {
          ...request,
          ...(request.startTimeSeconds !== undefined && request.endTimeSeconds !== undefined && {
            startTimeSeconds: formatSecondsForYtDlp(request.startTimeSeconds),
            endTimeSeconds: formatSecondsForYtDlp(request.endTimeSeconds),
          }),
        }
        : request,
    })
  }, [downloadQueue, isQueueFull, sfxEnabled])

  const handleRetry = useCallback((request: ClipDownloadRequest) => {
    enqueueDownload(request)
  }, [enqueueDownload])

  // Process queue: execute next pending job
  useEffect(() => {
    if (activeJobId !== null) {
      // Already processing
      return
    }

    const pendingJob = downloadQueue.find((job) => job.status === 'pending')
    if (!pendingJob) {
      // No pending jobs
      return
    }

    setActiveJobId(pendingJob.id)

    // Execute download
    const executeDownload = async () => {
      const loadingTitle = pendingJob.request.type === 'download-full-video'
        ? `Downloading ${pendingJob.request.audioOnly ? 'audio' : 'full video'}`
        : 'Downloading clip'
      const loadingDescription = pendingJob.request.type === 'download-full-video'
        ? `Saving the full ${pendingJob.request.audioOnly ? 'audio track' : 'video'} to Downloads. A progress window was opened on the desktop.`
        : pendingJob.request.livestream
          ? `Saving past ${pendingJob.request.pastDurationSeconds}s to Downloads. A progress window was opened on the desktop.`
          : (pendingJob.request.startTimeSeconds !== undefined && pendingJob.request.endTimeSeconds !== undefined)
            ? `Saving clip from ${formatTimeDisplay(pendingJob.request.startTimeSeconds)} to ${formatTimeDisplay(pendingJob.request.endTimeSeconds)}. A progress window was opened on the desktop.`
            : `Saving clip to Downloads. A progress window was opened on the desktop.`

      // Dismiss queued toast and show loading toast
      toaster.dismiss(pendingJob.toastId)
      toaster.loading({
        type: 'loading',
        id: pendingJob.toastId,
        title: loadingTitle,
        description: loadingDescription,
        closable: true,
      })

      emitPageDebugLog({
        stage: 'download-started',
        jobId: pendingJob.id,
      })

      let result: ClipDownloadResult | null = null
      try {
        const showLiveProcessLog = await getShowLiveProcessLog()
        const downloadPayload = { ...pendingJob.request, showLiveProcessLog }
        console.log('[clip-dl] Calling downloadClip with:', { type: downloadPayload.type, organizeByDate: downloadPayload.organizeByDate, organizeBySource: downloadPayload.organizeBySource, organizeByUploader: downloadPayload.organizeByUploader })
        result = await clipDownloader.downloadClip(downloadPayload)
      } catch (error) {
        result = {
          ok: false,
          code: 'download-failed',
          message: String(error),
        }
      }

      emitPageDebugLog({ stage: 'download-result', jobId: pendingJob.id, result })

      // Show final toast
      if (result?.ok) {
        toaster.update(pendingJob.toastId, {
          type: 'success',
          title: 'Success',
          description: `Saved ${result.fileName} to Downloads.`,
          duration: 8000,
          closable: true,
          action: {
            label: 'Show File in Folder',
            onClick: () => {
              void openFileLocation(result)
            },
          },
        })
        if (sfxEnabled) playSfx('success')
      } else if (result) {
        if (result.code === 'insufficient-disk-space' || result.code === 'low-disk-space') {
          toaster.update(pendingJob.toastId, {
            type: 'error',
            title: 'Insufficient disk space',
            description: result.message,
            duration: 10000,
            closable: true,
            action: {
              label: 'Retry',
              onClick: () => {
                void handleRetry(pendingJob.request)
              },
            },
          })
          if (sfxEnabled) playSfx('error')
        } else {
          toaster.update(pendingJob.toastId, {
            type: 'error',
            title: pendingJob.request.type === 'download-full-video' ? 'Full video download failed' : 'Clip download failed',
            description: result.message,
            duration: 10000,
            closable: true,
            action: {
              label: 'Retry',
              onClick: () => {
                void handleRetry(pendingJob.request)
              },
            },
          })
          if (sfxEnabled) playSfx('error')
        }
      }

      // Remove finished work from the live queue so the UI can accept new jobs.
      setDownloadQueue((prev) => prev.filter((job) => job.id !== pendingJob.id))

      // Clear active job to allow processor to pick next one
      setActiveJobId(null)
    }

    executeDownload()
  }, [downloadQueue, activeJobId, openFileLocation])

  const handleDurationDownload = useCallback((seconds: number, label: string) => {
    if (seconds === -1) {
      const videoElement = getActiveVideoElement()
      if (!videoElement) {
        toaster.create({
          type: 'error',
          title: 'Video not found',
          description: 'clip-dl could not find the active YouTube video element on this page.',
          duration: 5000,
          closable: true,
        })
        if (sfxEnabled) playSfx('error')
        return
      }

      const request: FullVideoDownloadRequest = {
        type: 'download-full-video',
        url: window.location.href,
        videoTitle: getPageVideoTitle(),
        label: 'Full Video',
        audioOnly: clipState.audioOnly,
        fileFormat,
        fileNamingTemplate,
        organizeByDate: organizeByDateEnabled,
        organizeBySource: organizeBySourceEnabled,
        organizeByUploader: organizeByUploaderEnabled,
      }
      enqueueDownload(request)
      return
    }

    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        type: 'error',
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const endTimeSeconds = Number(videoElement.currentTime.toFixed(3))
    const startTimeSeconds = Number(Math.max(endTimeSeconds - seconds, 0).toFixed(3))

    const request: ClipRangeDownloadRequest = {
      type: 'download-clip',
      url: window.location.href,
      videoTitle: getPageVideoTitle(),
      label,
      audioOnly: clipState.audioOnly,
      fileFormat,
      fileNamingTemplate,
      organizeByDate: organizeByDateEnabled,
      organizeBySource: organizeBySourceEnabled,
      organizeByUploader: organizeByUploaderEnabled,
    }

    // Branch between livestream and regular clip download
    if (livestreamModeEnabled) {
      request.livestream = true
      request.pastDurationSeconds = seconds
    } else {
      request.startTimeSeconds = startTimeSeconds
      request.endTimeSeconds = endTimeSeconds
    }

    console.log('[clip-dl] Download request:', { organizeByDate: organizeByDateEnabled, organizeBySource: organizeBySourceEnabled, organizeByUploader: organizeByUploaderEnabled, livestream: livestreamModeEnabled })
    // Add format selector if available and not audio-only
    if (!clipState.audioOnly && clipState.selectedFormatValue) {
      request.formatSelector = clipState.selectedFormatValue
    }
    enqueueDownload(request)
  }, [enqueueDownload, sfxEnabled, organizeByDateEnabled, organizeBySourceEnabled, organizeByUploaderEnabled, fileFormat, fileNamingTemplate, livestreamModeEnabled])

  const handleSetStartTime = useCallback(() => {
    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        type: 'error',
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const nextSelection = applyStartTimeSelection(videoElement.currentTime)
    setTimeSelection(nextSelection)
    emitPageDebugLog({ stage: 'time-selection-updated', source: 'set-start-time', selection: nextSelection })
    if (sfxEnabled) playSfx('start_recording')
  }, [sfxEnabled])

  const handleSetEndTime = useCallback(() => {
    const videoElement = getActiveVideoElement()
    if (!videoElement) {
      toaster.create({
        type: 'error',
        title: 'Video not found',
        description: 'clip-dl could not find the active YouTube video element on this page.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const nextSelection = applyEndTimeSelection(videoElement.currentTime)
    setTimeSelection(nextSelection)
    emitPageDebugLog({ stage: 'time-selection-updated', source: 'set-end-time', selection: nextSelection })
    if (sfxEnabled) playSfx('stop_recording')
  }, [sfxEnabled])

  const handleCancelTimeSelection = useCallback(() => {
    const nextSelection = clearClipTimeSelection()
    setTimeSelection(nextSelection)
    clearTimelinePreviewOverlay()
    emitPageDebugLog({ stage: 'time-selection-cleared' })
  }, [])

  const handleCustomClipDownload = useCallback(() => {
    // Livestream mode doesn't support custom time selection
    // Users should use duration presets instead
    if (livestreamModeEnabled) {
      toaster.create({
        type: 'error',
        title: 'Livestream mode active',
        description: 'Custom time selection is not supported in livestream mode. Please use the duration presets (10s, 30s, etc.) instead.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const selection = getClipTimeSelection()
    const resolvedRange = resolveSelectedClipRange(selection)

    if (!resolvedRange) {
      toaster.create({
        type: 'error',
        title: 'Invalid selection',
        description: 'Set an end time, or both start and end times, before downloading a custom clip.',
        duration: 5000,
        closable: true,
      })
      if (sfxEnabled) playSfx('error')
      return
    }

    const request: ClipRangeDownloadRequest = {
      type: 'download-clip',
      url: window.location.href,
      startTimeSeconds: resolvedRange.startTimeSeconds,
      endTimeSeconds: resolvedRange.endTimeSeconds,
      label: CUSTOM_CLIP_LABEL,
      audioOnly: clipState.audioOnly,
      fileFormat,
      fileNamingTemplate,
      organizeByDate: organizeByDateEnabled,
      organizeBySource: organizeBySourceEnabled,
      organizeByUploader: organizeByUploaderEnabled,
    }
    // Add format selector if available and not audio-only
    if (!clipState.audioOnly && clipState.selectedFormatValue) {
      request.formatSelector = clipState.selectedFormatValue
    }
    enqueueDownload(request)
  }, [enqueueDownload, organizeByDateEnabled, organizeBySourceEnabled, organizeByUploaderEnabled, fileFormat, fileNamingTemplate, sfxEnabled, livestreamModeEnabled])

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
    window.clip_forceShowPlayerControls = () => {
      const player = document.querySelector('.html5-video-player, ytd-watch-flexy') as HTMLElement | null
      if (!player) return
      player.classList.remove('ytp-hide-controls', 'ytp-hide-controls-forced')
      const controls = player.querySelector('.ytp-controls, .ytp-keyboard-focus-overlay') as HTMLElement | null
      if (controls) {
        controls.style.opacity = '1'
        controls.style.pointerEvents = 'auto'
      }
      const bottomBar = player.querySelector('.ytp-chrome-bottom, .ytp-right-controls') as HTMLElement | null
      if (bottomBar) {
        bottomBar.style.opacity = '1'
        bottomBar.style.transition = 'opacity 0.1s ease'
      }
    }
    window.clip_restorePlayerControlsVisibility = () => {
      const player = document.querySelector('.html5-video-player, ytd-watch-flexy') as HTMLElement | null
      if (!player) return
      const controls = player.querySelector('.ytp-controls, .ytp-keyboard-focus-overlay') as HTMLElement | null
      if (controls) {
        controls.style.opacity = ''
        controls.style.pointerEvents = ''
      }
      const bottomBar = player.querySelector('.ytp-chrome-bottom, .ytp-right-controls') as HTMLElement | null
      if (bottomBar) {
        bottomBar.style.opacity = ''
        bottomBar.style.transition = ''
      }
    }
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
    window.clip_handleInvalidContext = () => {
      if (sfxEnabled) playSfx('error')
    }
    window.clip_handleClipOptionClick = (_event: MouseEvent) => { }
  }, [sfxEnabled])
  const isTwitch = window.location.hostname.includes('twitch.tv')
  console.log('[clip-dl] Rendering Clipper with Twitch mode:', isTwitch)
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
          className={'ytp-button ' + (isTwitch ? 'mr-3' : '')}
          //onClick={handleToggle}
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
          minW="250px"
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
              <LivestreamModeToggle active={livestreamModeEnabled} onChange={handleLiveStreamModeToggle} isAutoDetected={isLivestreamUrlAutoDetected} />
              <QualitySelector
                formats={qualityFormats}
                loading={loadingFormats}
                error={formatError}
                selectedValue={selectedFormatValue}
                onSelectionChange={handleFormatSelectionChange}
                disabled={clipState.audioOnly}
              />
              <DurationButtons shouldDisable={shouldDisableDownloadButtons} onDownload={handleDurationDownload} />
              <TimeSelection
                status={timeSelection.timeSelectionStatus}
                shouldDisable={shouldDisableDownloadButtons}
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
