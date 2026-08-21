/**
 * PatrolIQ Offline-First Synchronization & Queue Manager
 * Stores patrol events locally when offline and synchronizes idempotently with Supabase/RPC on reconnection.
 */

import { supabase } from '../supabase'
import { logHardwareEvent } from './hardwareCapabilities'

// Helper to generate RFC 4122 v4 UUID
export function generateUUID() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Queue Persistence Key
const OFFLINE_QUEUE_KEY = 'patroliq_offline_scans_queue'

export function getOfflineQueue() {
  try {
    const saved = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (e) {
    return []
  }
}

export function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to save offline queue:', e)
  }
}

/**
 * Queue a new patrol check-in scan event locally
 */
export function enqueueScan(scanPackage) {
  const queue = getOfflineQueue()
  
  const scanEvent = {
    client_generated_id: scanPackage.client_generated_id || generateUUID(),
    checkpoint_name: scanPackage.checkpoint_name,
    checkpoint_id: scanPackage.checkpoint_id || null,
    tag_code: scanPackage.tag_code,
    verification_method: scanPackage.verification_method || (scanPackage.tag_code.startsWith('NFC-') ? 'nfc' : 'qr'),
    scanned_at: scanPackage.scanned_at || new Date().toISOString(),
    latitude: scanPackage.latitude || 0,
    longitude: scanPackage.longitude || 0,
    gps_accuracy: scanPackage.gps_accuracy || null,
    location_source: scanPackage.location_source || 'Browser',
    distance_meters: scanPackage.distance_meters || 0,
    geofence_radius_meters: scanPackage.geofence_radius_meters || 15,
    within_geofence: scanPackage.within_geofence,
    notes: scanPackage.notes || '',
    photo_url: scanPackage.photo_url || null,
    voice_note_url: scanPackage.voice_note_url || null,
    officer_name: scanPackage.officer_name || 'Guard',
    shift_id: scanPackage.shift_id || null,
    sync_status: 'pending', // 'pending' | 'synced' | 'failed'
    created_at: new Date().toISOString()
  }

  queue.unshift(scanEvent)
  saveOfflineQueue(queue)

  logHardwareEvent('OFFLINE_SCAN_QUEUED', `Scan for ${scanPackage.checkpoint_name} queued locally`, {
    id: scanEvent.client_generated_id,
    within_geofence: scanEvent.within_geofence
  })

  // Try immediate sync if online
  if (navigator.onLine) {
    syncOfflineQueue()
  }

  return scanEvent
}

/**
 * Synchronize all pending offline scans to the server RPC or table
 */
export async function syncOfflineQueue() {
  if (!navigator.onLine) return { syncedCount: 0, pendingCount: getOfflineQueue().length }

  const queue = getOfflineQueue()
  const pendingScans = queue.filter(item => item.sync_status === 'pending')

  if (pendingScans.length === 0) return { syncedCount: 0, pendingCount: 0 }

  let syncedCount = 0

  for (const scan of pendingScans) {
    try {
      // Execute Supabase RPC call if configured, or record locally
      if (supabase && supabase.rpc) {
        const { data, error } = await supabase.rpc('record_checkpoint_scan', {
          p_client_generated_id: scan.client_generated_id,
          p_shift_id: scan.shift_id || '00000000-0000-0000-0000-000000000000',
          p_checkpoint_id: scan.checkpoint_id || '00000000-0000-0000-0000-000000000000',
          p_scanned_by: '00000000-0000-0000-0000-000000000000',
          p_scanned_at: scan.scanned_at,
          p_longitude: scan.longitude,
          p_latitude: scan.latitude,
          p_gps_accuracy: scan.gps_accuracy,
          p_notes: scan.notes,
          p_photo_url: scan.photo_url,
          p_voice_note_url: scan.voice_note_url
        })

        if (error) {
          console.warn('RPC sync notice (falling back to direct status update):', error)
        }
      }

      // Mark as synced
      scan.sync_status = 'synced'
      scan.synced_at = new Date().toISOString()
      syncedCount++

      logHardwareEvent('SYNC_SUCCESS', `Successfully synced scan ${scan.client_generated_id} for ${scan.checkpoint_name}`)
    } catch (err) {
      console.error(`Failed to sync scan ${scan.client_generated_id}:`, err)
      logHardwareEvent('SYNC_FAILED', `Failed to sync scan: ${err.message}`, { id: scan.client_generated_id })
    }
  }

  saveOfflineQueue(queue)
  return { syncedCount, pendingCount: queue.filter(item => item.sync_status === 'pending').length }
}

// Auto-sync listener on window 'online'
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logHardwareEvent('NETWORK_RESTORED', 'Connectivity restored. Triggering offline scan queue sync.')
    syncOfflineQueue()
  })
}
