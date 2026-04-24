interface ClipTimeSelection {
  audioOnly: boolean
  startTime: number | null
  endTime: number | null
  timeSelectionStatus: 'none' | 'start_set' | 'end_set' | 'both_set'
}

interface ClipQualityFormat {
  label: string
  value: string
}

interface ClipState {
  audioOnly: boolean
  startTime: number | null
  endTime: number | null
  timeSelectionStatus: 'none' | 'start_set' | 'end_set' | 'both_set'
  qualityFormats: ClipQualityFormat[]
}

interface Window {
  clip_getAudioOnly: () => boolean
  clip_setAudioOnly: (val: boolean) => void
  clip_getStartTime: () => number | null
  clip_setStartTime: (t: number) => void
  clip_getEndTime: () => number | null
  clip_setEndTime: (t: number) => void
  clip_getTimeSelection: () => ClipTimeSelection
  clip_clearTimeSelection: () => void
  clip_toggleClipMenu: (e: MouseEvent) => void
  clip_forceShowPlayerControls: () => void
  clip_restorePlayerControlsVisibility: () => void
  clip_showTimelinePreview: (start: number, end: number) => void
  clip_fetchVideoFormats: (url: string) => Promise<ClipQualityFormat[]>
  clip_updateQualityOptions: (formats: ClipQualityFormat[]) => void
  clip_updateQualityOptionsError: (msg: string) => void
  clip_isExtensionContextValid: () => boolean
  clip_handleInvalidContext: () => void
  clip_handleClipOptionClick: (e: MouseEvent) => void
  clip_handleCustomClipDownload: (seconds: number, startTime: number | null) => void
}
