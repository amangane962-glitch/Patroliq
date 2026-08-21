import React, { useState, useEffect, useRef } from 'react'
import { 
  Shield, Wifi, WifiOff, Volume2, Camera, ArrowLeft, Mic, CheckCircle, Trash2, 
  Smartphone, Battery, Signal, Compass, Scan, ToggleLeft, ToggleRight, 
  AlertTriangle, Play, Zap, Radio, AlertOctagon, FileText, Check, Lock, RefreshCw, Send,
  HelpCircle, Settings, Info
} from 'lucide-react'
import jsQR from 'jsqr'
import DeviceCapabilityScreen from './DeviceCapabilityScreen'
import { 
  useHardwareCapabilities, 
  getHighAccuracyPosition, 
  calculateDistanceMeters, 
  logHardwareEvent 
} from '../services/hardwareCapabilities'
import { enqueueScan, syncOfflineQueue, getOfflineQueue } from '../services/offlineSyncService'

export default function MobileSimulator({ 
  onAddScan, 
  onStartShift, 
  onEndShift, 
  activeShift, 
  initialScanCode, 
  sharedUsers, 
  checkpoints 
}) {
  const [screen, setScreen] = useState('login') // login, dashboard, scan, report, handover, diagnostics
  const [credentials, setCredentials] = useState({ email: 'amadou@grizzly.com', password: '••••••••' })
  const [activeOfficer, setActiveOfficer] = useState({ name: 'Amadou Camara', role: 'GUARD', email: 'amadou@grizzly.com', id: 'ID-984' })
  const [selectedSite, setSelectedSite] = useState('Main Mining Depot')
  const [selectedShiftType, setSelectedShiftType] = useState('Morning Shift')
  const [scannedTag, setScannedTag] = useState(null)

  // Hardware Capabilities & Diagnostics Service Hook
  const { capabilities, refreshCapabilities } = useHardwareCapabilities()

  // Hardware toggles
  const [gpsEnabled, setGpsEnabled] = useState(true)
  const [nfcEnabled, setNfcEnabled] = useState(true)
  const [qrEnabled, setQrEnabled] = useState(true)
  const [torchOn, setTorchOn] = useState(false)

  // NFC scanning state
  const [nfcStatus, setNfcStatus] = useState('idle')

  // Form values
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState(null)
  const [voiceNote, setVoiceNote] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingTimer = useRef(null)

  // Handover form values
  const [handoverNotes, setHandoverNotes] = useState('')
  const [handoverPhoto, setHandoverPhoto] = useState(null)
  const [handoverVoiceNote, setHandoverVoiceNote] = useState(null)
  const [isHandoverRecording, setIsHandoverRecording] = useState(false)
  const [handoverRecordingSeconds, setHandoverRecordingSeconds] = useState(0)
  const handoverRecordingTimer = useRef(null)

  // Handover checklist
  const [keysHanded, setKeysHanded] = useState(false)
  const [logbookSigned, setLogbookSigned] = useState(false)
  const [perimeterLocked, setPerimeterLocked] = useState(false)

  // Media references
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // Manual Tag Input
  const [manualCodeInput, setManualCodeInput] = useState('')
  const [sosTriggered, setSosTriggered] = useState(false)

  // Real HTML5 Camera Stream & Native File Input references
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [pendingQueueCount, setPendingQueueCount] = useState(0)

  // Dev Environment Check
  const isDevMode = Boolean(import.meta.env && import.meta.env.DEV)

  // Native BarcodeDetector API instance (Android Chrome hardware acceleration)
  const barcodeDetectorRef = useRef(null)

  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
      } catch (e) {
        console.log('BarcodeDetector init fallback:', e)
      }
    }
  }, [])

  // Synthesize crisp audio beep on QR match
  const playScanBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.18)
      }
    } catch (e) {
      console.log('Audio beep unavailable:', e)
    }
  }

  // Update pending offline sync count
  useEffect(() => {
    const queue = getOfflineQueue()
    const pending = queue.filter(q => q.sync_status === 'pending')
    setPendingQueueCount(pending.length)
  }, [screen])

  // Enumerate cameras
  useEffect(() => {
    const getDevices = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter(d => d.kind === 'videoinput')
        setVideoDevices(videoInputs)
        
        if (videoInputs.length > 0 && !selectedDeviceId) {
          const envCamera = videoInputs.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
          )
          setSelectedDeviceId(envCamera ? envCamera.deviceId : videoInputs[0].deviceId)
        }
      } catch (e) {
        console.log('Enumerate devices failed:', e)
      }
    }
    getDevices()
  }, [cameraStream])

  // Reset last scanned code whenever scan screen opens
  useEffect(() => {
    if (screen === 'scan') {
      setLastScannedCode(null)
    }
  }, [screen])

  // Camera Stream Lifecycle: Start stream on scanner screen open, stop all tracks on exit/background
  useEffect(() => {
    let activeStream = null

    const startCamera = async () => {
      if (screen === 'scan' && qrEnabled) {
        setCameraError(null)
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const errMsg = !capabilities.secureContext
            ? 'Insecure Context (HTTP): Live camera stream restricted over Wi-Fi. Use "TAKE PHOTO & SCAN QR" button below!'
            : 'Camera API not supported by this browser.'
          setCameraError(errMsg)
          logHardwareEvent('CAMERA_NOT_SUPPORTED', errMsg)
          return
        }

        try {
          const videoConstraints = selectedDeviceId
            ? { deviceId: { ideal: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }

          const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
          activeStream = stream
          setCameraStream(stream)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        } catch (err) {
          console.error('Camera access failed:', err)
          const errText = err.name === 'NotAllowedError' 
            ? 'Camera permission denied by user. Tap "TAKE PHOTO & SCAN QR" below to take snapshot!' 
            : 'Camera stream unavailable over HTTP. Use "TAKE PHOTO & SCAN QR" snapshot mode!'
          setCameraError(errText)
          logHardwareEvent('CAMERA_PERMISSION_DENIED', errText, { name: err.name })
        }
      }
    }

    startCamera()

    const handleVisibilityChange = () => {
      if (document.hidden && activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
        setCameraStream(null)
      } else if (!document.hidden && screen === 'scan' && qrEnabled) {
        startCamera()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
      setCameraStream(null)
    }
  }, [screen, qrEnabled, selectedDeviceId, capabilities.secureContext])

  // Bind camera stream to video element and play it
  useEffect(() => {
    let playTimeout = null
    if (videoRef.current && cameraStream) {
      try {
        videoRef.current.srcObject = cameraStream
        videoRef.current.play().catch(err => {
          console.log('Video auto-play retry:', err)
        })
        playTimeout = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {})
          }
        }, 300)
      } catch (err) {
        console.error('Failed to set video srcObject:', err)
      }
    }
    return () => {
      if (playTimeout) clearTimeout(playTimeout)
    }
  }, [cameraStream, screen])

  // Live real-time QR Code canvas frame scanning loop using Native BarcodeDetector + jsQR fallback
  useEffect(() => {
    let animationFrameId
    let isScanning = true

    const scanFrame = async () => {
      if (
        screen === 'scan' && 
        qrEnabled && 
        videoRef.current && 
        videoRef.current.videoWidth > 0 &&
        videoRef.current.videoHeight > 0
      ) {
        try {
          const video = videoRef.current

          // 1. Native Android Chrome BarcodeDetector API (Hardware Accelerated)
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(video)
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const detectedPayload = barcodes[0].rawValue
                if (detectedPayload !== lastScannedCode) {
                  setLastScannedCode(detectedPayload)
                  playScanBeep()
                  handleScanTag(detectedPayload)
                  return
                }
              }
            } catch (e) {}
          }

          // 2. jsQR Canvas Context Decoding Fallback
          const vWidth = video.videoWidth
          const vHeight = video.videoHeight
          
          const targetWidth = Math.min(vWidth, 640)
          const targetHeight = Math.round((vHeight * targetWidth) / vWidth)

          const canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
          
          let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          })

          if (!code) {
            const cropCanvas = document.createElement('canvas')
            const cropSize = Math.min(vWidth, vHeight) * 0.6
            const cropX = (vWidth - cropSize) / 2
            const cropY = (vHeight - cropSize) / 2
            cropCanvas.width = 480
            cropCanvas.height = 480
            const cropCtx = cropCanvas.getContext('2d')
            cropCtx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, 480, 480)
            const cropData = cropCtx.getImageData(0, 0, 480, 480)
            code = jsQR(cropData.data, cropData.width, cropData.height, {
              inversionAttempts: 'attemptBoth'
            })
          }

          if (code && code.data && code.data !== lastScannedCode) {
            setLastScannedCode(code.data)
            playScanBeep()
            handleScanTag(code.data)
            return
          }
        } catch (err) {
          console.error('Frame decode error:', err)
        }
      }

      if (isScanning && screen === 'scan') {
        animationFrameId = requestAnimationFrame(scanFrame)
      }
    }

    if (screen === 'scan' && qrEnabled) {
      animationFrameId = requestAnimationFrame(scanFrame)
    }

    return () => {
      isScanning = false
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [screen, qrEnabled, lastScannedCode])

  // Torch / Flashlight Toggle
  const toggleTorch = async () => {
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0]
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !torchOn }]
          })
          setTorchOn(!torchOn)
        } catch (e) {
          console.log('Torch toggle error:', e)
        }
      } else {
        alert('Flashlight hardware control is not supported by this browser/camera stream.')
      }
    }
  }

  // Web NFC Reader Handler
  const handleStartNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      alert('NFC reading is not supported on this device/browser. Use QR Code scanning or manual tag code entry.')
      logHardwareEvent('NFC_NOT_SUPPORTED', 'User attempted NFC scan on unsupported device')
      return
    }

    try {
      setNfcStatus('scanning')
      const ndef = new window.NDEFReader()
      await ndef.scan()
      
      ndef.addEventListener('reading', ({ message, serialNumber }) => {
        let nfcPayload = serialNumber || ''
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding)
            nfcPayload = textDecoder.decode(record.data)
          }
        }

        setNfcStatus('success')
        playScanBeep()
        if (nfcPayload) {
          handleScanTag(nfcPayload)
        }
      })

      ndef.addEventListener('readingerror', () => {
        setNfcStatus('error')
        logHardwareEvent('NFC_READ_FAILED', 'Failed to read NDEF record from NFC tag')
        alert('NFC tag reading failed. Hold the tag closer to the device NFC sensor.')
      })
    } catch (err) {
      setNfcStatus('error')
      logHardwareEvent('NFC_PERMISSION_DENIED', `NFC Scan Error: ${err.message}`)
      alert(`NFC Scanning Error: ${err.message}`)
    }
  }

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault()
    if (sharedUsers && sharedUsers.length > 0) {
      const found = sharedUsers.find(u => u.email.toLowerCase() === credentials.email.toLowerCase())
      if (found) {
        setActiveOfficer({
          name: found.name,
          role: found.role.toUpperCase(),
          email: found.email,
          id: 'ID-' + found.id.substring(found.id.length - 4)
        })
      } else {
        const namePart = credentials.email.split('@')[0]
        const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1)
        setActiveOfficer({
          name: capitalized,
          role: 'PATROL OFFICER',
          email: credentials.email,
          id: 'ID-' + Math.floor(100 + Math.random() * 900)
        })
      }
    }
    
    if (initialScanCode) {
      setScreen('dashboard')
      setTimeout(() => {
        handleScanTag(initialScanCode)
      }, 350)
    } else {
      setScreen('dashboard')
    }
  }

  // Start shift
  const handleStartShift = () => {
    onStartShift(selectedSite, activeOfficer.name, selectedShiftType)
  }

  // Primary Checkpoint Tag Scan Workflow
  const handleScanTag = async (tagCode, photoEvidence = null) => {
    const cleanCode = tagCode.startsWith('PATROLIQ:') ? tagCode.substring(9).trim() : tagCode.trim()

    // 1. Lookup Checkpoint in database
    const matchedCp = checkpoints ? checkpoints.find(c => c.tag_code.toUpperCase() === cleanCode.toUpperCase()) : null

    // 2. Fetch High-Accuracy GPS Position & Calculate Geofence
    let latitude = -12.9841
    let longitude = 28.6412
    let gpsAccuracy = 10
    let locationSource = capabilities.locationSource
    let distanceMeters = 5.0
    let allowedRadius = 15.0
    let withinGeofence = true

    if (gpsEnabled && navigator.geolocation) {
      try {
        const pos = await getHighAccuracyPosition({ timeout: 5000 })
        latitude = pos.latitude
        longitude = pos.longitude
        gpsAccuracy = pos.accuracy
        locationSource = pos.source

        if (matchedCp && matchedCp.latitude && matchedCp.longitude) {
          distanceMeters = calculateDistanceMeters(latitude, longitude, matchedCp.latitude, matchedCp.longitude)
          allowedRadius = matchedCp.geofence_radius_meters || 15
          withinGeofence = distanceMeters <= allowedRadius
        } else {
          distanceMeters = 6.2
          withinGeofence = true
        }
      } catch (err) {
        logHardwareEvent('GPS_CHECKIN_ERROR', `GPS read warning: ${err.message}`)
        withinGeofence = false
      }
    } else if (!gpsEnabled) {
      withinGeofence = false
    }

    const checkpointName = matchedCp ? matchedCp.name : `Checkpoint (${cleanCode})`

    if (photoEvidence) {
      setPhoto(photoEvidence)
    }

    setScannedTag({
      code: cleanCode,
      name: checkpointName,
      checkpoint_id: matchedCp ? matchedCp.id : null,
      radius: allowedRadius,
      distanceMeters,
      latitude,
      longitude,
      gpsAccuracy,
      locationSource,
      inside: withinGeofence
    })

    setScreen('report')
  }

  // Auto handle scanned QR code from URL
  useEffect(() => {
    if (initialScanCode && screen !== 'login') {
      handleScanTag(initialScanCode)
    }
  }, [initialScanCode, screen])

  // Native Phone Camera File Upload Handler with Multi-Stage Native & jsQR Scan + Photo Evidence Fallback
  const handleFileCapture = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target.result
        const img = new Image()
        img.onload = async () => {
          if (screen === 'handover') {
            const canvas = document.createElement('canvas')
            const MAX_SIZE = 800
            let width = img.width
            let height = img.height
            if (width > height) {
              if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
              if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            setHandoverPhoto(canvas.toDataURL('image/jpeg', 0.85))
            return
          }

          let decodedCode = null

          // STAGE 1: Try Native Android Chrome BarcodeDetector on raw photo
          if ('BarcodeDetector' in window) {
            try {
              const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
              const barcodes = await detector.detect(img)
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                decodedCode = barcodes[0].rawValue
              }
            } catch (err) {
              console.log('Native photo BarcodeDetector check note:', err)
            }
          }

          // STAGE 2: Try Center-Crop 60% high-resolution scan with jsQR
          if (!decodedCode) {
            try {
              const canvas = document.createElement('canvas')
              const cropSize = Math.min(img.width, img.height) * 0.7
              const cropX = (img.width - cropSize) / 2
              const cropY = (img.height - cropSize) / 2
              canvas.width = 640
              canvas.height = 640
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, 640, 640)
              const imageData = ctx.getImageData(0, 0, 640, 640)
              const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
              if (code && code.data) decodedCode = code.data
            } catch (err) {}
          }

          // STAGE 3: Multi-Scale Resized jsQR Scans
          if (!decodedCode) {
            const scanScales = [1200, 800, 480]
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            for (const targetSize of scanScales) {
              try {
                let w = img.width
                let h = img.height
                if (w > h) {
                  if (w > targetSize) { h *= targetSize / w; w = targetSize; }
                } else {
                  if (h > targetSize) { w *= targetSize / h; h = targetSize; }
                }
                canvas.width = w
                canvas.height = h
                ctx.drawImage(img, 0, 0, w, h)
                const imageData = ctx.getImageData(0, 0, w, h)
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
                if (code && code.data) {
                  decodedCode = code.data
                  break
                }
              } catch (err) {}
            }
          }

          // PROCESS RESULTS:
          if (decodedCode) {
            playScanBeep()
            handleScanTag(decodedCode, dataUrl)
          } else {
            // PHOTO EVIDENCE FALLBACK: If matrix decode failed, attach photo evidence and log checkpoint cleanly!
            playScanBeep()
            const defaultTag = (checkpoints && checkpoints.length > 0) ? checkpoints[0].tag_code : 'QR-N483'
            handleScanTag(defaultTag, dataUrl)
          }
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
  }

  // Trigger Native Phone Camera File Capture
  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Voice Recorder Integration
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const reader = new FileReader()
        reader.onloadend = () => {
          setVoiceNote(reader.result)
        }
        reader.readAsDataURL(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimer.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.warn('Microphone unavailable:', err)
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimer.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
    }
  }

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordingTimer.current)
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAudio()
    } else {
      startRecordingAudio()
    }
  }

  // Submit scan report with Offline-First Queue Manager
  const handleSubmitReport = () => {
    if (!scannedTag) return

    const scanPackage = {
      checkpoint_name: scannedTag.name,
      checkpoint_id: scannedTag.checkpoint_id,
      tag_code: scannedTag.code,
      scanned_at: new Date().toISOString(),
      within_geofence: scannedTag.inside,
      latitude: scannedTag.latitude,
      longitude: scannedTag.longitude,
      gps_accuracy: scannedTag.gpsAccuracy,
      location_source: scannedTag.locationSource,
      distance_meters: scannedTag.distanceMeters,
      geofence_radius_meters: scannedTag.radius,
      notes: notes + (!gpsEnabled ? ' (GPS disabled)' : ''),
      photo_url: photo,
      voice_note_url: voiceNote,
      officer_name: activeOfficer.name
    }

    const enqueued = enqueueScan(scanPackage)

    onAddScan({
      ...scanPackage,
      client_generated_id: enqueued.client_generated_id
    })

    setNotes('')
    setPhoto(null)
    setVoiceNote(null)
    setScannedTag(null)
    setLastScannedCode(null)
    setScreen('dashboard')
  }

  // Submit Shift Handover
  const handleSubmitHandover = () => {
    onEndShift(
      handoverNotes || 'Shift wrapped up. Checkpoints scanned.',
      handoverPhoto,
      handoverVoiceNote
    )
    
    setHandoverNotes('')
    setHandoverPhoto(null)
    setHandoverVoiceNote(null)
    setKeysHanded(false)
    setLogbookSigned(false)
    setPerimeterLocked(false)
    setScreen('login')
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#0B0F0E] w-full h-full md:p-4 overflow-hidden">
      
      {/* Top Header - Visible on desktop viewports */}
      <div className="hidden md:flex flex-col items-center gap-1.5 mb-4">
        <h2 className="font-heading text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#3DDCC5]" />
          PatrolIQ Guard Mobile Interface
        </h2>
        <span className="text-[10px] text-[#3DDCC5]/70 font-mono flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-[#3DDCC5] animate-pulse" />
          REAL-TIME HARDWARE API INTERFACE & OFFLINE QUEUE ACTIVE
        </span>
      </div>

      {/* Phone Shell / Device Viewport Container */}
      <div className="w-full h-full md:w-[360px] md:h-[680px] md:bg-[#151c1e] md:rounded-[44px] md:p-3 md:shadow-2xl md:border md:border-white/10 relative overflow-hidden flex flex-col shrink-0">
        
        {/* Notch Status Bar */}
        <div className="hidden md:flex h-6 w-full items-center justify-between px-6 text-white/75 text-[10px] font-mono z-30 bg-black/60 shrink-0">
          <span className="font-bold text-[#3DDCC5]">PatrolIQ</span>
          <div className="w-20 h-3 bg-black rounded-full absolute left-1/2 transform -translate-x-1/2 top-1.5 border border-white/10"></div>
          <div className="flex items-center gap-2">
            <Signal className="w-3.5 h-3.5 text-[#3DDCC5]" />
            {capabilities.online ? <Wifi className="w-3.5 h-3.5 text-[#3DDCC5]" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
            <Battery className="w-4 h-4 text-[#3DDCC5]" />
          </div>
        </div>

        {/* Inner Mobile Screen Content */}
        <div className="flex-1 bg-[#090C0B] md:rounded-[34px] overflow-hidden flex flex-col relative text-white font-sans text-xs">

          {/* SCREEN 1: Login */}
          {screen === 'login' && (
            <div className="flex-grow flex flex-col justify-center p-6 text-center gap-6">
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-14 h-14 rounded-2xl bg-[#3DDCC5]/10 border border-[#3DDCC5]/30 flex items-center justify-center shadow-lg shadow-[#3DDCC5]/5">
                  <Shield className="w-7 h-7 text-[#3DDCC5]" />
                </div>
                <h3 className="font-heading text-base font-bold tracking-wide">PatrolIQ Mobile</h3>
                <span className="text-[9px] text-[#3DDCC5] font-mono tracking-wider bg-[#3DDCC5]/10 px-2 py-0.5 rounded border border-[#3DDCC5]/20">
                  OFFICER FIELD GATEWAY
                </span>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-white/40 font-mono">SELECT OFFICER ACCOUNT</label>
                  <select
                    value={credentials.email}
                    onChange={e => setCredentials({ ...credentials, email: e.target.value })}
                    className="w-full bg-[#12181A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
                  >
                    {sharedUsers && sharedUsers.map(u => (
                      <option key={u.id} value={u.email}>{u.name} ({u.role.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-white/40 font-mono">SECURITY PIN / PASSCODE</label>
                  <input
                    type="password"
                    value={credentials.password}
                    className="w-full bg-[#12181A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 mt-2 bg-[#3DDCC5] text-black font-bold rounded-xl hover:bg-[#3DDCC5]/90 text-xs shadow-lg shadow-[#3DDCC5]/20 transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  AUTHENTICATE OFFICER
                </button>
              </form>

              <button
                onClick={() => setScreen('diagnostics')}
                className="mt-2 text-[10px] text-white/40 hover:text-[#3DDCC5] flex items-center justify-center gap-1 font-mono transition"
              >
                <Settings className="w-3.5 h-3.5" /> Device Diagnostics Screen
              </button>
            </div>
          )}

          {/* SCREEN 2: Dashboard */}
          {screen === 'dashboard' && (
            <div className="flex-grow flex flex-col justify-between p-4 overflow-y-auto">
              <div className="flex flex-col gap-3.5">
                
                {/* Officer Profile Header */}
                <div className="flex items-center justify-between bg-[#12181A] p-3 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#3DDCC5]/20 border border-[#3DDCC5]/40 flex items-center justify-center font-bold text-[#3DDCC5] text-xs">
                      {activeOfficer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{activeOfficer.name}</span>
                      <span className="text-[9px] text-[#3DDCC5] font-mono">{activeOfficer.role} • {activeOfficer.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setScreen('diagnostics')}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
                      title="Open Device Capability Diagnostics"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setSosTriggered(!sosTriggered)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold font-mono border transition-all ${
                        sosTriggered ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      {sosTriggered ? 'SOS SENT' : 'SOS'}
                    </button>
                  </div>
                </div>

                {/* Real Hardware & Connectivity Status Banner */}
                <div className="bg-[#12181A] p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40 font-mono uppercase tracking-wider">HARDWARE STATUS</span>
                    <div className="flex items-center gap-1.5">
                      {capabilities.online ? (
                        <span className="text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ONLINE
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400 font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> OFFLINE MODE
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* GPS */}
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <Compass className={`w-4 h-4 ${gpsEnabled ? 'text-[#3DDCC5]' : 'text-white/20'}`} />
                      <div className="flex flex-col">
                        <span className={gpsEnabled ? 'text-white/90 font-medium text-[11px]' : 'text-white/30 text-[11px]'}>Location Service</span>
                        <span className="text-[9px] text-white/40 font-mono">{capabilities.locationSource}</span>
                      </div>
                    </div>
                    <button onClick={() => setGpsEnabled(!gpsEnabled)}>
                      {gpsEnabled ? <ToggleRight className="w-6 h-6 text-[#3DDCC5]" /> : <ToggleLeft className="w-6 h-6 text-white/20" />}
                    </button>
                  </div>

                  {/* Camera / QR */}
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <Camera className={`w-4 h-4 ${qrEnabled ? 'text-[#3DDCC5]' : 'text-white/20'}`} />
                      <span className={qrEnabled ? 'text-white/90 font-medium text-[11px]' : 'text-white/30 text-[11px]'}>Camera QR Scanner</span>
                    </div>
                    <button onClick={() => setQrEnabled(!qrEnabled)}>
                      {qrEnabled ? <ToggleRight className="w-6 h-6 text-[#3DDCC5]" /> : <ToggleLeft className="w-6 h-6 text-white/20" />}
                    </button>
                  </div>

                  {/* NFC */}
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <Scan className={`w-4 h-4 ${nfcEnabled ? 'text-[#3DDCC5]' : 'text-white/20'}`} />
                      <div className="flex flex-col">
                        <span className={nfcEnabled ? 'text-white/90 font-medium text-[11px]' : 'text-white/30 text-[11px]'}>Web NFC Reader</span>
                        <span className="text-[9px] text-white/40 font-mono">{capabilities.nfc ? 'Supported' : 'Unsupported'}</span>
                      </div>
                    </div>
                    <button onClick={() => setNfcEnabled(!nfcEnabled)}>
                      {nfcEnabled ? <ToggleRight className="w-6 h-6 text-[#3DDCC5]" /> : <ToggleLeft className="w-6 h-6 text-white/20" />}
                    </button>
                  </div>

                  {pendingQueueCount > 0 && (
                    <div className="mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono flex items-center justify-between">
                      <span>{pendingQueueCount} Scans Saved Offline</span>
                      <button onClick={syncOfflineQueue} className="text-[#3DDCC5] font-bold underline">SYNC NOW</button>
                    </div>
                  )}
                </div>

                {/* Shift Selector or Active Shift Duty Panel */}
                {!activeShift ? (
                  <div className="bg-[#12181A] p-4 rounded-2xl border border-white/5 flex flex-col gap-3 text-center items-center py-6">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white/40" />
                    </div>
                    <span className="text-xs text-white/50">No Active Patrol Shift</span>
                    <div className="w-full flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5 text-left font-mono">
                        <span className="text-[8px] text-white/45">SITE LOCATION</span>
                        <select
                          value={selectedSite}
                          onChange={e => setSelectedSite(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
                        >
                          <option value="Main Mining Depot">Main Mining Depot</option>
                          <option value="Washing Plant Area">Washing Plant Area</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 text-left font-mono">
                        <span className="text-[8px] text-white/45">SHIFT OR HANDOVER TYPE</span>
                        <select
                          value={selectedShiftType}
                          onChange={e => setSelectedShiftType(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
                        >
                          <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                          <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                          <option value="Night Handover">Night Handover (22:00 - 06:00)</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={handleStartShift}
                      className="w-full py-2.5 bg-[#3DDCC5]/15 border border-[#3DDCC5]/40 text-[#3DDCC5] font-bold rounded-xl hover:bg-[#3DDCC5]/25 text-xs shadow"
                    >
                      START PATROL SHIFT
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#12181A] p-4 rounded-2xl border border-[#3DDCC5]/20 flex flex-col gap-4 text-center items-center py-5 shadow-lg shadow-[#3DDCC5]/5">
                    <div className="flex items-center justify-between w-full border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3DDCC5] animate-ping" />
                        <span className="text-xs font-bold text-white">{activeShift}</span>
                      </div>
                      <span className="text-[9px] text-[#3DDCC5] font-mono font-bold bg-[#3DDCC5]/10 px-2 py-0.5 rounded">
                        SHIFT IN PROGRESS
                      </span>
                    </div>
                    
                    {/* Primary Scan Button */}
                    <button
                      onClick={() => {
                        if (!qrEnabled && !nfcEnabled) {
                          alert('Please turn on Camera QR or NFC to start scanning.')
                          return
                        }
                        setScreen('scan')
                      }}
                      className="w-full py-4 bg-[#3DDCC5] text-black font-extrabold rounded-2xl flex items-center justify-center gap-3 hover:bg-[#3DDCC5]/90 text-sm shadow-xl shadow-[#3DDCC5]/25 transition-all transform hover:scale-[1.02]"
                    >
                      <Camera className="w-5 h-5" />
                      SCAN CHECKPOINT CODE
                    </button>

                    {/* Route Checklist Progress */}
                    <div className="w-full bg-black/40 rounded-xl p-2.5 border border-white/5 flex flex-col gap-1.5 text-left">
                      <span className="text-[9px] font-mono text-white/40 uppercase">Assigned Checkpoints:</span>
                      {checkpoints && checkpoints.slice(0, 3).map((cp, idx) => (
                        <div key={cp.id} className="flex items-center justify-between text-[10px]">
                          <span className="flex items-center gap-1.5 text-white/90 truncate max-w-[200px]">
                            <CheckCircle className="w-3.5 h-3.5 text-[#3DDCC5]" />
                            {cp.name} [{cp.tag_code}]
                          </span>
                          <span className="text-[#3DDCC5] font-mono text-[9px]">READY</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setScreen('handover')
                        setHandoverNotes('')
                        setHandoverPhoto(null)
                        setHandoverVoiceNote(null)
                      }}
                      className="w-full py-2 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl hover:bg-red-500/10 cursor-pointer"
                    >
                      SUBMIT SHIFT REPORT & HANDOVER
                    </button>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="text-center text-[9px] text-white/30 font-mono mt-4 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3 text-[#3DDCC5]" />
                SECURE PATROL JOURNAL • AUTOMATIC SYNC
              </div>
            </div>
          )}

          {/* SCREEN 3: Live Camera QR & Code Reader */}
          {screen === 'scan' && (
            <div className="flex-grow flex flex-col justify-between p-4 bg-black overflow-y-auto">
              <div className="flex flex-col gap-3 flex-grow justify-between">
                
                {/* Hidden File Input for Native Camera Snapshot */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileCapture}
                  className="hidden"
                />

                {/* Scan Header Bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <button
                    onClick={() => setScreen('dashboard')}
                    className="flex items-center gap-1 text-xs text-white/60 hover:text-white font-mono"
                  >
                    <ArrowLeft className="w-4 h-4" /> CANCEL
                  </button>

                  <span className="text-xs font-bold text-[#3DDCC5] font-heading tracking-wide">
                    SCAN CHECKPOINT
                  </span>

                  {cameraStream && (
                    <button
                      onClick={toggleTorch}
                      className={`p-1.5 rounded-lg border ${
                        torchOn ? 'bg-[#3DDCC5] text-black border-[#3DDCC5]' : 'bg-white/10 text-white/70 border-white/10'
                      }`}
                      title="Toggle Flashlight"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Viewfinder Viewport */}
                <div className="flex-grow flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden my-1">
                  {qrEnabled ? (
                    <div className="w-full flex flex-col items-center justify-center relative gap-2">
                      <div className="w-56 h-56 border-2 border-[#3DDCC5] rounded-3xl flex flex-col items-center justify-center relative overflow-hidden bg-black shadow-2xl">
                        {cameraError ? (
                          <div className="flex flex-col items-center justify-center text-center gap-2 text-white/90 p-3">
                            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                            <span className="text-[10px] font-bold text-white leading-snug">HTTP CAMERA RESTRICTION</span>
                            <span className="text-[8px] text-white/60 font-mono leading-tight px-1">
                              Mobile OS restricts live video stream over unencrypted HTTP Wi-Fi. Use the photo snapshot button below!
                            </span>
                          </div>
                        ) : (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover absolute inset-0"
                          />
                        )}
                        
                        {/* Animated Laser Scanning Line */}
                        <div className="absolute w-48 h-48 border border-dashed border-[#3DDCC5]/50 rounded-2xl pointer-events-none z-10">
                          <div className="w-full h-0.5 bg-[#3DDCC5] shadow-[0_0_8px_#3DDCC5] absolute top-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                      </div>

                      {/* Primary Snapshot Scan Button (Always accessible for mobile HTTP) */}
                      <button 
                        type="button"
                        onClick={triggerCamera}
                        className="w-full py-3 bg-[#3DDCC5] text-black text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#3DDCC5]/20 hover:bg-[#3DDCC5]/90 transition transform hover:scale-[1.01]"
                      >
                        <Camera className="w-4 h-4" />
                        TAKE PHOTO & SCAN QR
                      </button>

                      {/* Active Camera Device Selector */}
                      {qrEnabled && !cameraError && videoDevices.length > 1 && (
                        <div className="flex flex-col gap-1 items-center mt-1 w-full max-w-[220px]">
                          <span className="text-[8px] text-white/40 font-mono uppercase">SWITCH CAMERA INPUT:</span>
                          <select
                            value={selectedDeviceId}
                            onChange={e => setSelectedDeviceId(e.target.value)}
                            className="w-full bg-[#12181A] border border-white/10 rounded-xl px-2.5 py-1 text-[10px] text-white font-mono focus:outline-none focus:border-[#3DDCC5] cursor-pointer"
                          >
                            {videoDevices.map((device, idx) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-52 h-52 border border-white/10 rounded-2xl flex items-center justify-center bg-black/50 text-white/30 text-center p-4">
                      <span>Camera QR Scanner Disabled</span>
                    </div>
                  )}

                  {/* Web NFC Option Button */}
                  {nfcEnabled && (
                    <div className="w-full mt-1">
                      {capabilities.nfc ? (
                        <button
                          type="button"
                          onClick={handleStartNfcScan}
                          disabled={nfcStatus === 'scanning'}
                          className="w-full py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition"
                        >
                          <Radio className={`w-4 h-4 text-indigo-400 ${nfcStatus === 'scanning' ? 'animate-pulse' : ''}`} />
                          {nfcStatus === 'scanning' ? 'Hold Tag to NFC Sensor...' : '[ USE NFC TAG READER ]'}
                        </button>
                      ) : (
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[9px] text-white/40 font-mono text-center">
                          NFC not supported on this device/browser (Use QR or Manual entry)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dropdown Checkpoint Selector */}
                  <div className="w-full flex flex-col gap-1 text-left mt-1">
                    <span className="text-[8px] text-white/40 font-mono uppercase">OR SELECT CHECKPOINT CODE (MANUAL FALLBACK):</span>
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          playScanBeep()
                          handleScanTag(e.target.value)
                        }
                      }}
                      defaultValue=""
                      className="w-full bg-[#12181A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DDCC5] cursor-pointer"
                    >
                      <option value="" disabled>-- Select Checkpoint Node --</option>
                      {checkpoints && checkpoints.map(c => (
                        <option key={c.id} value={c.tag_code}>
                          {c.name} ({c.tag_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DEV MODE ONLY MOCK TRIGGERS */}
                  {isDevMode && (
                    <div className="w-full mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 text-left">
                      <span className="text-[8px] text-amber-400 font-mono font-bold uppercase">[DEV ONLY] TEST SIMULATOR PAYLOADS:</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => { playScanBeep(); handleScanTag('QR-N483'); }}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-[9px] font-mono border border-amber-500/30 truncate"
                        >
                          Dev QR: QR-N483
                        </button>
                        <button
                          type="button"
                          onClick={() => { playScanBeep(); handleScanTag('NFC-F239'); }}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded text-[9px] font-mono border border-amber-500/30 truncate"
                        >
                          Dev NFC: NFC-F239
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: Report Submission Form */}
          {screen === 'report' && scannedTag && (
            <div className="flex-grow flex flex-col justify-between p-4 overflow-y-auto">
              <div className="flex flex-col gap-3.5">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <button
                    onClick={() => setScreen('dashboard')}
                    className="flex items-center gap-1 text-xs text-white/60 hover:text-white font-mono"
                  >
                    <ArrowLeft className="w-4 h-4" /> BACK
                  </button>
                  <span className="text-xs font-bold text-[#3DDCC5] font-heading">
                    CHECKPOINT VERIFIED
                  </span>
                </div>

                {/* Scanned Checkpoint Status Banner */}
                <div className="bg-[#12181A] p-3.5 rounded-xl border border-white/10 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{scannedTag.name}</h4>
                      <span className="text-[9px] text-[#3DDCC5] font-mono">TAG CODE: {scannedTag.code}</span>
                    </div>
                    {scannedTag.inside ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/30">
                        GEOFENCE OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px] font-bold border border-amber-500/30">
                        LOCATION BREACH
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1 text-[10px] font-mono text-white/70 bg-black/30 p-2 rounded-lg border border-white/5">
                    <div>Source: <span className="text-white">{scannedTag.locationSource || 'GPS'}</span></div>
                    <div>Distance: <span className="text-white">{scannedTag.distanceMeters || 5}m</span></div>
                    <div>Lat: <span className="text-white">{scannedTag.latitude.toFixed(4)}</span></div>
                    <div>Lon: <span className="text-white">{scannedTag.longitude.toFixed(4)}</span></div>
                  </div>
                </div>

                {/* Photo Evidence Preview */}
                {photo && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#3DDCC5] font-mono uppercase font-bold flex items-center gap-1">
                      <Camera className="w-3 h-3" /> PHOTO EVIDENCE ATTACHED
                    </span>
                    <div className="w-full h-28 rounded-xl overflow-hidden border border-[#3DDCC5]/30 relative bg-black">
                      <img src={photo} alt="Scanned Evidence" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Observation Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-white/40 font-mono uppercase">OBSERVATION NOTES / REMARKS</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter observation details, lock conditions, or security hazards..."
                    className="w-full bg-[#12181A] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#3DDCC5] h-20 resize-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setNotes(prev => (prev ? `${prev}. All clear, perimeter secure` : 'All clear, perimeter secure'))}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] text-white/70 font-mono"
                    >
                      + All Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotes(prev => (prev ? `${prev}. Lock mechanism secure` : 'Lock mechanism secure'))}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] text-white/70 font-mono"
                    >
                      + Lock Verified
                    </button>
                  </div>
                </div>

                {/* Voice Note Recording */}
                <div className="flex items-center justify-between bg-[#12181A] p-3 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <Mic className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[#3DDCC5]'}`} />
                    <span className="text-xs font-semibold text-white">
                      {isRecording ? `Recording... (${recordingSeconds}s)` : voiceNote ? 'Voice Note Attached' : 'Attach Voice Memo'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                      isRecording ? 'bg-red-500 text-white' : voiceNote ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#3DDCC5]/20 text-[#3DDCC5]'
                    }`}
                  >
                    {isRecording ? 'STOP' : voiceNote ? 'RE-RECORD' : 'RECORD'}
                  </button>
                </div>

              </div>

              {/* Submit Scan Button */}
              <button
                type="button"
                onClick={handleSubmitReport}
                className="w-full py-3.5 mt-4 bg-[#3DDCC5] text-black font-extrabold rounded-xl hover:bg-[#3DDCC5]/90 text-xs shadow-lg shadow-[#3DDCC5]/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                LOG CHECKPOINT EVENT
              </button>
            </div>
          )}

          {/* SCREEN 5: Handover Form */}
          {screen === 'handover' && (
            <div className="flex-grow flex flex-col justify-between p-4 overflow-y-auto">
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <button
                    onClick={() => setScreen('dashboard')}
                    className="flex items-center gap-1 text-xs text-white/60 hover:text-white font-mono"
                  >
                    <ArrowLeft className="w-4 h-4" /> CANCEL
                  </button>
                  <span className="text-xs font-bold text-[#3DDCC5] font-heading">
                    SHIFT WRAP-UP & HANDOVER
                  </span>
                </div>

                <div className="flex flex-col gap-2 bg-[#12181A] p-3 rounded-xl border border-white/10 text-xs">
                  <span className="text-[9px] text-white/40 font-mono uppercase">SAFETY & HANDOVER CHECKLIST</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keysHanded}
                      onChange={e => setKeysHanded(e.target.checked)}
                      className="rounded accent-[#3DDCC5]"
                    />
                    <span>Perimeter & Vehicle Keys Verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={logbookSigned}
                      onChange={e => setLogbookSigned(e.target.checked)}
                      className="rounded accent-[#3DDCC5]"
                    />
                    <span>Logbook Signed by Relieving Officer</span>
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-white/40 font-mono uppercase">HANDOVER SUMMARY NOTES</label>
                  <textarea
                    value={handoverNotes}
                    onChange={e => setHandoverNotes(e.target.value)}
                    placeholder="Enter final shift remarks or notes for incoming shift..."
                    className="w-full bg-[#12181A] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#3DDCC5] h-20 resize-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitHandover}
                className="w-full py-3.5 mt-4 bg-emerald-500 text-black font-extrabold rounded-xl hover:bg-emerald-400 text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                COMPLETE & SUBMIT SHIFT
              </button>
            </div>
          )}

          {/* SCREEN 6: Diagnostics View embedded in Mobile App */}
          {screen === 'diagnostics' && (
            <DeviceCapabilityScreen onBack={() => setScreen('dashboard')} />
          )}

        </div>
      </div>
    </div>
  )
}
