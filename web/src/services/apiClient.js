/**
 * PatrolIQ Unified API Client Service
 * Connects directly to real REST API endpoints with automatic offline localStorage fallback.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://animated-bonbon-8c82fa.netlify.app/api/v1'

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  try {
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`)
    }
    return await res.json()
  } catch (err) {
    console.warn(`[API Fallback] Endpoint ${endpoint} unreachable, operating in local offline mode.`, err)
    return null
  }
}

export const scansApi = {
  async fetchScans() {
    const remote = await request('/scans')
    if (remote && remote.scans) return remote.scans
    const local = localStorage.getItem('patrol_scans')
    return local ? JSON.parse(local) : []
  },

  async recordScan(scanData) {
    const remote = await request('/scans', {
      method: 'POST',
      body: JSON.stringify(scanData)
    })
    
    // Save to local persistence queue regardless
    const local = localStorage.getItem('patrol_scans')
    const scans = local ? JSON.parse(local) : []
    const newScan = remote?.scan || {
      id: 'scan-' + Date.now(),
      ...scanData,
      timestamp: new Date().toISOString()
    }
    const updated = [newScan, ...scans]
    localStorage.setItem('patrol_scans', JSON.stringify(updated))
    return newScan
  }
}

export const sitesApi = {
  async fetchSites() {
    const remote = await request('/sites')
    if (remote && remote.sites) return remote.sites
    const local = localStorage.getItem('patroliq_sites')
    return local ? JSON.parse(local) : []
  },

  async createSite(siteData) {
    const remote = await request('/sites', {
      method: 'POST',
      body: JSON.stringify(siteData)
    })
    const local = localStorage.getItem('patroliq_sites')
    const sites = local ? JSON.parse(local) : []
    const newSite = remote?.site || {
      id: 'site-' + Date.now(),
      ...siteData,
      createdAt: new Date().toISOString()
    }
    const updated = [...sites, newSite]
    localStorage.setItem('patroliq_sites', JSON.stringify(updated))
    return newSite
  }
}

export const incidentsApi = {
  async fetchIncidents() {
    const remote = await request('/incidents')
    if (remote && remote.incidents) return remote.incidents
    const local = localStorage.getItem('patrol_incidents')
    return local ? JSON.parse(local) : []
  },

  async createIncident(incidentData) {
    const remote = await request('/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData)
    })
    const local = localStorage.getItem('patrol_incidents')
    const incidents = local ? JSON.parse(local) : []
    const newIncident = remote?.incident || {
      id: 'inc-' + Date.now(),
      ...incidentData,
      timestamp: new Date().toISOString()
    }
    const updated = [newIncident, ...incidents]
    localStorage.setItem('patrol_incidents', JSON.stringify(updated))
    return newIncident
  }
}
