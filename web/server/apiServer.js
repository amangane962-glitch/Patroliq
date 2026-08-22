/**
 * PatrolIQ Enterprise REST API Server
 * Exposes full RESTful API endpoints for Sites, Checkpoints, Scans, Incidents, and Video Evidence.
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// In-Memory Database / Local Cache Store
let db = {
  sites: [
    { id: 'site-1', name: 'HQ Alpha Tower', address: '100 Security Blvd, Financial District', lat: -26.2041, lng: 28.0473, geofenceRadiusMeters: 50, tier: 'Tier 1 Critical' },
    { id: 'site-2', name: 'Westside Logistics Warehouse', address: '45 Freight Ave, Industrial Zone', lat: -26.2100, lng: 28.0400, geofenceRadiusMeters: 75, tier: 'High Priority' },
    { id: 'site-3', name: 'North Substation', address: '12 Power Grid Rd, North Sector', lat: -26.1950, lng: 28.0550, geofenceRadiusMeters: 30, tier: 'Standard' }
  ],
  scans: [],
  incidents: [],
  hardwareLogs: []
}

// 1. Health & Telemetry API
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'PatrolIQ Enterprise Backend API v2.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  })
})

// 2. Sites & Geofences API
app.get('/api/v1/sites', (req, res) => {
  res.json({ success: true, count: db.sites.length, sites: db.sites })
})

app.post('/api/v1/sites', (req, res) => {
  const { name, address, lat, lng, geofenceRadiusMeters, tier } = req.body
  if (!name || lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required site fields (name, lat, lng)' })
  }
  const newSite = {
    id: 'site-' + Date.now(),
    name,
    address: address || 'Custom Location',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    geofenceRadiusMeters: parseInt(geofenceRadiusMeters) || 50,
    tier: tier || 'Standard',
    createdAt: new Date().toISOString()
  }
  db.sites.push(newSite)
  res.status(201).json({ success: true, site: newSite })
})

// 3. Checkpoint Scans API (QR / NFC / RFID)
app.get('/api/v1/scans', (req, res) => {
  res.json({ success: true, count: db.scans.length, scans: db.scans })
})

app.post('/api/v1/scans', (req, res) => {
  const { checkpoint_id, checkpoint_name, method, guard, lat, lng, in_geofence, video_url, rfid_tag } = req.body
  const newScan = {
    id: 'scan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    checkpoint_id: checkpoint_id || 'CP-GENERIC',
    checkpoint_name: checkpoint_name || 'Main Gate',
    method: method || 'QR_CODE', // QR_CODE, NFC, RFID, MANUAL
    guard: guard || 'Officer On Duty',
    lat: lat || null,
    lng: lng || null,
    in_geofence: Boolean(in_geofence),
    video_url: video_url || null,
    rfid_tag: rfid_tag || null,
    status: 'VERIFIED',
    timestamp: new Date().toISOString()
  }
  db.scans.unshift(newScan)
  res.status(201).json({ success: true, scan: newScan })
})

// 4. Incidents & Evidence Upload API
app.get('/api/v1/incidents', (req, res) => {
  res.json({ success: true, count: db.incidents.length, incidents: db.incidents })
})

app.post('/api/v1/incidents', (req, res) => {
  const { title, site, severity, guard, description, lat, lng, video_url } = req.body
  const newIncident = {
    id: 'inc-' + Date.now(),
    title: title || 'Security Anomaly',
    site: site || 'Unspecified Site',
    severity: severity || 'MEDIUM', // LOW, MEDIUM, HIGH, CRITICAL
    guard: guard || 'Reporting Officer',
    description: description || '',
    lat: lat || null,
    lng: lng || null,
    video_url: video_url || null,
    status: 'OPEN',
    timestamp: new Date().toISOString()
  }
  db.incidents.unshift(newIncident)
  res.status(201).json({ success: true, incident: newIncident })
})

// 5. Hardware Diagnostics API
app.post('/api/v1/hardware/logs', (req, res) => {
  const { code, message, details } = req.body
  const logEntry = {
    id: 'hw-' + Date.now(),
    code,
    message,
    details: details || {},
    receivedAt: new Date().toISOString()
  }
  db.hardwareLogs.unshift(logEntry)
  res.status(201).json({ success: true, log: logEntry })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[PatrolIQ API] Server running at http://localhost:${PORT}`)
  })
}

export default app
