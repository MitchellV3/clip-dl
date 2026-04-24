import { useState, useCallback, useEffect } from 'react'
import { Box, Popover, Button, Text, Flex, Bleed, Select, NativeSelect } from '@chakra-ui/react'
import './style.css'
import { HiCheck, HiX } from 'react-icons/hi';
import { Switch } from "@/components/ui/switch"
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
// Shared state for window.clip_* interop
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
  { label: 'Full Video', seconds: -1 }
]

// Audio-only toggle sub-component
function AudioOnlyToggle() {
  const [active, setActive] = useState(clipState.audioOnly)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const newVal = !active
    setActive(newVal)
    if (window.clip_setAudioOnly) {
      try { window.clip_setAudioOnly(newVal) } catch (err) { console.warn('clip_setAudioOnly failed', err) }
    }
  }, [active])

  return (
    <Box
      borderBottom={'1px solid rgba(255,255,255,0.15)'}
      //margin={'0 -8px 0px'}
      padding={'4px 2px 4px'}
    >
      <Button
        onClick={handleClick}
        display={"flex"}
        alignItems={"center"}
        justifyContent={"space-between"}
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
            transform={active ? 'translateX(0)' : 'translateX(0)'}
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

// Duration buttons sub-component
function DurationButtons() {
  const handleClick = useCallback((e: React.MouseEvent, seconds: number) => {
    e.stopPropagation()
    if (window.clip_handleCustomClipDownload) {
      if (seconds === -1) {
        window.clip_handleCustomClipDownload(-1, 0)
      } else {
        window.clip_handleCustomClipDownload(seconds, null)
      }
    }
  }, [])

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
            onClick={(e) => handleClick(e, duration.seconds)}
            backgroundColor={isFullVideo ? 'rgba(255, 255, 255, 0.05)' : 'transparent'}
            color={isFullVideo ? '#ffffff' : '#e2e2e2'}
            border={isFullVideo ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent'}
            padding='16px 12px'
            margin={'1px 0'}
            borderRadius={'4px'}
            cursor={'pointer'}
            fontSize={'12px'}
            textAlign={'center'}
            transition={'all 0.2s ease'}
            fontWeight={isFullVideo ? '600' : '400'}
            gridColumn={isFullVideo ? '1 / -1' : 'auto'}
            _hover={{ backgroundColor: isFullVideo ? 'rgba(255, 255, 255, 0.1)' : 'rgba(74, 222, 128, 0.1)', borderColor: isFullVideo ? 'rgba(255, 255, 255, 0.3)' : 'rgba(74, 222, 128, 0.3)' }}
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
      const sel = window.clip_getTimeSelection()
      if (sel) {
        setStatus(sel.timeSelectionStatus)
      }
    }
  }, [])

  useEffect(() => {
    updateStatus()
  }, [updateStatus])

  const handleSetStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const videoElement = document.querySelector('video.html5-main-video, video.video-player__video, video[playsinline]') as HTMLVideoElement | null
    if (videoElement) {
      if (window.clip_setStartTime) window.clip_setStartTime(videoElement.currentTime)
      if (window.clip_showTimelinePreview) window.clip_showTimelinePreview(videoElement.currentTime, videoElement.currentTime)
      updateStatus()
    }
  }, [updateStatus])

  const handleSetEnd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const videoElement = document.querySelector('video.html5-main-video, video.video-player__video, video[playsinline]') as HTMLVideoElement | null
    if (videoElement) {
      if (window.clip_setEndTime) window.clip_setEndTime(videoElement.currentTime)
      if (window.clip_showTimelinePreview && window.clip_getStartTime) {
        window.clip_showTimelinePreview(window.clip_getStartTime() || videoElement.currentTime, videoElement.currentTime)
      }
      updateStatus()
    }
  }, [updateStatus])

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.clip_clearTimeSelection) window.clip_clearTimeSelection()
    updateStatus()
  }, [updateStatus])

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.clip_getTimeSelection) {
      const sel = window.clip_getTimeSelection()
      if (sel && sel.timeSelectionStatus === 'both_set') {
        const clipDuration = (sel.endTime || 0) - (sel.startTime || 0)
        if (window.clip_handleCustomClipDownload) window.clip_handleCustomClipDownload(clipDuration, sel.startTime)
        if (window.clip_restorePlayerControlsVisibility) window.clip_restorePlayerControlsVisibility()
        if (window.clip_clearTimeSelection) window.clip_clearTimeSelection()
        updateStatus()
      }
    }
  }, [updateStatus])

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
          onClick={handleSetStart}
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
          onClick={handleSetEnd}
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
            onClick={handleCancel}
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
            onClick={handleDownload}
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
  <Box w={"full"} h={"full"} filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))">
    <svg filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M23 22a2 2 0 0 1-2-2V4a4 4 0 0 0-4-4H6a1 1 0 0 0 0 2a2 2 0 0 1 2 2v6.91a.23.23 0 0 0 .13.21l2.5 1.48a.25.25 0 0 0 .25 0a.25.25 0 0 0 .12-.22V9.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-1.93a.26.26 0 0 0-.24.18a.27.27 0 0 0 .11.29l1.33.78c.22.13 1.22 1 1.22 1.25V21a.5.5 0 0 1-.5.5H13a2 2 0 0 1-2-2v-.72a.22.22 0 0 0-.12-.21l-2.5-1.48a.25.25 0 0 0-.25 0a.26.26 0 0 0-.13.21V20a4 4 0 0 0 4 4h11a1 1 0 0 0 0-2M17.49 7h-6a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5H16a2 2 0 0 1 2 2v2a.5.5 0 0 1-.51.5" />
      <path d="M2.46 11.84L15 19.26a1 1 0 0 0 1-1.72l-10.14-6a.26.26 0 0 1-.13-.19a.3.3 0 0 1 .09-.22a3.3 3.3 0 0 0 .74-.92A3.5 3.5 0 1 0 0 8.5a3.5 3.5 0 0 0 .45 1.73a3.52 3.52 0 0 0 2.01 1.61M3.51 7A1.5 1.5 0 0 1 5 8.5a1.4 1.4 0 0 1-.17.68A1.5 1.5 0 0 1 2 8.57V8.5A1.5 1.5 0 0 1 3.51 7m0 7A3.5 3.5 0 1 0 7 17.5A3.5 3.5 0 0 0 3.51 14m0 5A1.5 1.5 0 1 1 5 17.5A1.5 1.5 0 0 1 3.51 19" />
    </svg>
    <svg className={"w-10! h-10! bg-transparent"} filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff">
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M.763 8.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 0 0-4.5 0m0 8.196a2.25 2.25 0 1 0 4.499 0a2.25 2.25 0 0 0-4.499 0" />
        <path d="m2.34 10.397l7.391 4.381l4.201 2.489M2.34 14.3l4.317-2.559m3.08.259V2.25a1.5 1.5 0 0 1 1.5-1.5h12m0 22.5h-12a1.5 1.5 0 0 1-1.5-1.5V18m4.5-8.25v-9m0 22.5v-3m-4.5-15h4.5m9 9V.75m0 22.5v-9m-13.5-4.5h13.5m-7.5 4.5h7.5" />
      </g>
    </svg>
  </Box>
)

export default function Clipper() {
  const [isOpen, setIsOpen] = useState(false)
  const [qualityFormats, setQualityFormats] = useState<{ label: string; value: string }[]>([])
  const [loadingFormats, setLoadingFormats] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // Check context validity before opening
    if (window.clip_isExtensionContextValid && !window.clip_isExtensionContextValid()) {
      if (window.clip_handleInvalidContext) window.clip_handleInvalidContext()
      return
    }

    const newOpen = !isOpen
    setIsOpen(newOpen)

    if (newOpen) {
      // Menu is opening
      if (window.clip_forceShowPlayerControls) window.clip_forceShowPlayerControls()

      // Fetch video formats
      setLoadingFormats(true)
      setFormatError(null)
      if (window.clip_fetchVideoFormats && window.clip_updateQualityOptions) {
        const videoUrl = window.location.href
        window.clip_fetchVideoFormats(videoUrl)
          .then((formats: any) => {
            if (formats && formats.length) {
              setQualityFormats(formats)
              window.clip_updateQualityOptions(formats)
            } else {
              setFormatError('No formats detected')
              if (window.clip_updateQualityOptionsError) window.clip_updateQualityOptionsError('No formats detected')
            }
          })
          .catch((error: any) => {
            console.warn('clipper: Failed to fetch video formats:', error)
            const message = error && error.message ? error.message : 'Failed to load formats'
            setFormatError(message)
            if (window.clip_updateQualityOptionsError) window.clip_updateQualityOptionsError(message)
          })
          .finally(() => setLoadingFormats(false))
      }
    } else {
      // Menu is closing
      if (window.clip_restorePlayerControlsVisibility) window.clip_restorePlayerControlsVisibility()
    }
  }, [isOpen])

  // Sync global state
  useEffect(() => {
    // Expose global functions for interop with other content scripts
    window.clip_getAudioOnly = () => clipState.audioOnly
    window.clip_setAudioOnly = (val: boolean) => { clipState.audioOnly = val }
    window.clip_getStartTime = () => clipState.startTime
    window.clip_setStartTime = (t: number) => { clipState.startTime = t }
    window.clip_getEndTime = () => clipState.endTime
    window.clip_setEndTime = (t: number) => { clipState.endTime = t }
    window.clip_getTimeSelection = () => ({
      audioOnly: clipState.audioOnly,
      startTime: clipState.startTime,
      endTime: clipState.endTime,
      timeSelectionStatus: 'none' as const,
    })
    window.clip_clearTimeSelection = () => {
      clipState.startTime = null
      clipState.endTime = null
    }
    window.clip_toggleClipMenu = (e: MouseEvent) => {
      if (e) e.stopPropagation()
      setIsOpen(prev => !prev)
    }
    window.clip_forceShowPlayerControls = () => { }
    window.clip_restorePlayerControlsVisibility = () => { }
    window.clip_showTimelinePreview = (start: number, end: number) => { }
    window.clip_fetchVideoFormats = (url: string) => Promise.resolve(qualityFormats)
    window.clip_updateQualityOptions = (formats: any) => {
      setQualityFormats(formats)
      clipState.qualityFormats = formats
    }
    window.clip_updateQualityOptionsError = (msg: string) => setFormatError(msg)
    window.clip_isExtensionContextValid = () => true
    window.clip_handleInvalidContext = () => { }
    window.clip_handleClipOptionClick = (e: MouseEvent) => { }
    window.clip_handleCustomClipDownload = (seconds: number, startTime: number | null) => {
      console.log('clip_handleCustomClipDownload:', seconds, startTime)
    }
  }, [qualityFormats])

  return (
    <Popover.Root
      portalled={false}
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
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
            <svg filter="drop-shadow(0 0 1px rgba(0, 0, 0, .8))" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"
              style={{
                height: "60%",
                width: "auto"
              }}>
              <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                <path d="M.763 8.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 0 0-4.5 0m0 8.196a2.25 2.25 0 1 0 4.499 0a2.25 2.25 0 0 0-4.499 0" />
                <path d="m2.34 10.397l7.391 4.381l4.201 2.489M2.34 14.3l4.317-2.559m3.08.259V2.25a1.5 1.5 0 0 1 1.5-1.5h12m0 22.5h-12a1.5 1.5 0 0 1-1.5-1.5V18m4.5-8.25v-9m0 22.5v-3m-4.5-15h4.5m9 9V.75m0 22.5v-9m-13.5-4.5h13.5m-7.5 4.5h7.5" />
              </g>
            </svg>
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
              <DurationButtons />
              <TimeSelection />
            </Box>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root >
  )
}
