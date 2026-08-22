/**
 * PatrolIQ Central Hardware Capability Service & Permission Manager
 * Detects real device hardware capabilities, location sources, and security context.
 */

import { useState, useEffect, useCallback } from 'react'
import { Geolocation as CapGeolocation } from '@capacitor/geolocation'

// Hardware Error Log Store
let hardwareLogs = []

export const logHardwareEvent = (code, message, details = {}) => {
  const logEntry = {
    id: 'hw_log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  }
  hardwareLogs = [logEntry, ...hardwareLogs].slice(0, 50)
  try {
    localStorage.setItem('patroliq_hardware_logs', JSON.stringify(hardwareLogs))
  } catch (e) {}
  return logEntry
}

export const getHardwareLogs = () => {
  try {
    const saved = localStorage.getItem('patroliq_hardware_logs')
    if (saved) hardwareLogs = JSON.parse(saved)
  } catch (e) {}
  return hardwareLogs
}

export const clearHardwareLogs = () => {
  hardwareLogs = []
  localStorage.removeItem('patroliq_hardware_logs')
}

/**
 * Detect hardware capabilities synchronously and asynchronously
 */
export async function detectCapabilities() {
  const isSecureContext = Boolean(window.isSecureContext)
  const isOnline = Boolean(navigator.onLine)
  const hasServiceWorker = 'serviceWorker' in navigator
  const hasVibration = 'vibrate' in navigator

  // 1. Camera & QR Scanner Capability Detection
  let hasCamera = false
  let cameraPermission = 'prompt' // 'granted' | 'denied' | 'prompt' | 'unsupported'

  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputDevices = devices.filter(device => device.kind === 'videoinput')
      hasCamera = videoInputDevices.length > 0

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' })
          cameraPermission = status.state
        } catch (e) {
          cameraPermission = hasCamera ? 'prompt' : 'unsupported'
        }
      } else {
        cameraPermission = hasCamera ? 'prompt' : 'unsupported'
      }
    } catch (err) {
      logHardwareEvent('CAMERA_ENUMERATE_ERROR', 'Could not enumerate media devices: ' + err.message)
    }
  }

  // 2. High Accuracy GPS Detection
  let hasGps = 'geolocation' in navigator || (window.Capacitor && true)
  let locationPermission = 'prompt'
  let locationSource = 'HTML5 Geolocation'

  if (window.Capacitor) {
    locationSource = 'Native Android Fused GPS'
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      locationPermission = status.state
    } catch (e) {
      locationPermission = hasGps ? 'prompt' : 'unsupported'
    }
  }

  // 3. Web NFC Capability Detection
  let hasNfc = 'NDEFReader' in window
  let nfcPermission = hasNfc ? 'prompt' : 'unsupported'

  // 4. Torch / Flashlight Detection
  let hasTorch = false
  if (hasCamera && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const track = stream.getVideoTracks()[0]
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {}
        hasTorch = Boolean(capabilities.torch)
        stream.getTracks().forEach(t => t.stop())
      }
    } catch (e) {
      // Ignored for capability check
    }
  }

  return {
    camera: hasCamera,
    cameraPermission,
    qrScanner: hasCamera,
    gps: hasGps,
    locationPermission,
    locationSource,
    nfc: hasNfc,
    nfcPermission,
    torch: hasTorch,
    vibration: hasVibration,
    online: isOnline,
    serviceWorker: hasServiceWorker,
    secureContext: isSecureContext
  }
}

/**
 * Custom React Hook to expose live hardware capabilities
 */
export function useHardwareCapabilities() {
  const [capabilities, setCapabilities] = useState({
    camera: false,
    cameraPermission: 'prompt',
    qrScanner: false,
    gps: false,
    locationPermission: 'prompt',
    locationSource: 'Detecting...',
    nfc: false,
    nfcPermission: 'unsupported',
    torch: false,
    vibration: false,
    online: navigator.onLine,
    serviceWorker: 'serviceWorker' in navigator,
    secureContext: window.isSecureContext,
    loading: true
  })

  const refreshCapabilities = useCallback(async () => {
    const caps = await detectCapabilities()
    setCapabilities({ ...caps, loading: false })
  }, [])

  useEffect(() => {
    refreshCapabilities()

    const handleOnline = () => setCapabilities(prev => ({ ...prev, online: true }))
    const handleOffline = () => {
      setCapabilities(prev => ({ ...prev, online: false }))
      logHardwareEvent('NETWORK_OFFLINE', 'Device transitioned to offline state')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshCapabilities])

  return { capabilities, refreshCapabilities }
}

/**
 * High Accuracy Geolocation Helper (Native Android + Web Fallback)
 */
export async function getHighAccuracyPosition(options = {}) {
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000,
    ...options
  }

  if (window.Capacitor && CapGeolocation) {
    try {
      const position = await CapGeolocation.getCurrentPosition(defaultOptions)
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy * 10) / 10,
        timestamp: position.timestamp,
        source: 'Native Android Fused GPS',
        raw: position
      }
    } catch (err) {
      logHardwareEvent('NATIVE_GPS_FALLBACK', 'Native GPS failed, falling back to Web Geolocation: ' + err.message)
    }
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      logHardwareEvent('GPS_NOT_SUPPORTED', 'Geolocation API unavailable')
      return reject(new Error('Geolocation is not supported by your browser'))
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const timestamp = position.timestamp
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        let source = isMobileDevice ? 'GPS Hardware' : 'Browser / Network'
        if (accuracy > 100 && !isMobileDevice) {
          source = 'Wi-Fi / IP Network'
        }

        if (accuracy > 30) {
          logHardwareEvent('GPS_LOW_ACCURACY', `Captured position accuracy is ${Math.round(accuracy)}m`, { accuracy })
        }

        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy * 10) / 10,
          timestamp,
          source,
          raw: position
        })
      },
      (error) => {
        let code = 'GPS_ERROR'
        let msg = error.message
        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'GPS_PERMISSION_DENIED'
            msg = 'Location permission was denied by the user or browser.'
            break
          case error.POSITION_UNAVAILABLE:
            code = 'GPS_UNAVAILABLE'
            msg = 'Location information is unavailable from device sensors.'
            break
          case error.TIMEOUT:
            code = 'GPS_TIMEOUT'
            msg = 'Location request timed out. Retrying with lower accuracy mode.'
            break
        }
        logHardwareEvent(code, msg, { errorCode: error.code })
        reject(new Error(msg))
      },
      defaultOptions
    )
  })
}

/**
 * Haversine formula for spatial distance calculation in meters
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}
