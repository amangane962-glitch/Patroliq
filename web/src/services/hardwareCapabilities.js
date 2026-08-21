/**
 * PatrolIQ Central Hardware Capability Service & Permission Manager
 * Detects real device hardware capabilities, location sources, and security context.
 */

import { useState, useEffect, useCallback } from 'react'

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
  let videoDevices = []

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    hasCamera = true
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const camPerm = await navigator.permissions.query({ name: 'camera' }).catch(() => null)
        if (camPerm) cameraPermission = camPerm.state
      }
    } catch (e) {}

    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        videoDevices = devices.filter(d => d.kind === 'videoinput')
      }
    } catch (e) {}
  } else {
    cameraPermission = 'unsupported'
    logHardwareEvent('CAMERA_NOT_SUPPORTED', 'MediaDevices getUserMedia not supported by browser/context')
  }

  // 2. GPS & Location Source Detection
  let hasGpsApi = 'geolocation' in navigator
  let locationPermission = 'prompt'
  let locationSource = 'Unknown' // 'GPS Hardware' | 'Browser / Network' | 'Unavailable'

  if (hasGpsApi) {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const geoPerm = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null)
        if (geoPerm) locationPermission = geoPerm.state
      }
    } catch (e) {}

    // Distinguish real GPS hardware vs Laptop / Browser network positioning
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobileDevice) {
      locationSource = 'GPS Hardware'
    } else {
      locationSource = 'Browser / Network'
    }
  } else {
    locationPermission = 'unsupported'
    locationSource = 'Unavailable'
    logHardwareEvent('GPS_NOT_SUPPORTED', 'Browser does not support Geolocation API')
  }

  // 3. Web NFC Capability Detection
  let hasNfc = 'NDEFReader' in window
  let nfcPermission = hasNfc ? 'prompt' : 'unsupported'

  if (!hasNfc) {
    logHardwareEvent('NFC_NOT_SUPPORTED', 'Web NFC API (NDEFReader) is not supported on this browser/device')
  }

  // 4. Torch / Flashlight Detection
  let hasTorch = false
  if (videoDevices.length > 0) {
    // Torch requires an active track to inspect capabilities, default true if mobile camera present
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    hasTorch = isMobileDevice
  }

  return {
    camera: hasCamera,
    cameraPermission,
    videoDevicesCount: videoDevices.length,
    qrScanner: hasCamera,
    gps: hasGpsApi,
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
 * Custom React Hook for hardware capability management
 */
export function useHardwareCapabilities() {
  const [capabilities, setCapabilities] = useState({
    camera: false,
    cameraPermission: 'prompt',
    videoDevicesCount: 0,
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
 * High Accuracy Geolocation Helper
 */
export function getHighAccuracyPosition(options = {}) {
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000,
    ...options
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
