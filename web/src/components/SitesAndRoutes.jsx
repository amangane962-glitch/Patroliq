import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { Map, Plus, Trash, Save, Info, AlertTriangle, Download, MapPin, Compass, Shield } from 'lucide-react'

export default function SitesAndRoutes({ sharedSites, setSharedSites }) {
  const defaultSites = [
    { id: 's1', name: 'Main Mining Depot', address: 'Plot 402, North Perimeter Rd', latitude: -12.9841, longitude: 28.6412, geofence_radius_meters: 25.0, security_level: 'High', geofence: 'POLYGON((80 80, 520 80, 460 320, 60 280, 80 80))' },
    { id: 's2', name: 'Washing Plant Area', address: 'Industrial Zone East, Gate 4', latitude: -12.9850, longitude: 28.6425, geofence_radius_meters: 30.0, security_level: 'Medium', geofence: 'POLYGON((100 100, 300 100, 300 300, 100 300, 100 100))' },
    { id: 's3', name: 'East Logistics Hub', address: 'Highway Sector 12', latitude: -12.9835, longitude: 28.6405, geofence_radius_meters: 20.0, security_level: 'High', geofence: 'POLYGON((50 50, 250 50, 250 250, 50 250, 50 50))' }
  ]

  const [localSites, setLocalSites] = useState(sharedSites && sharedSites.length > 0 ? sharedSites : defaultSites)
  const sites = sharedSites && sharedSites.length > 0 ? sharedSites : localSites

  const updateSites = (newSites) => {
    setLocalSites(newSites)
    if (setSharedSites) setSharedSites(newSites)
  }

  const [activeSite, setActiveSite] = useState(sites[0]?.id || 's1')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    latitude: -12.9841,
    longitude: 28.6412,
    geofence_radius_meters: 25,
    security_level: 'High'
  })

  const exportSitesCSV = () => {
    const headers = ['Site ID', 'Site Name', 'Address', 'Latitude', 'Longitude', 'Geofence Radius (m)', 'Security Tier']
    const rows = sites.map(s => [
      s.id,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.address || '').replace(/"/g, '""')}"`,
      s.latitude || -12.9841,
      s.longitude || 28.6412,
      s.geofence_radius_meters || 25,
      s.security_level || 'High'
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PatrolIQ_Site_Locations_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  const [routes, setRoutes] = useState([
    { id: 'r1', site_id: 's1', name: 'Perimeter West A' },
    { id: 'r2', site_id: 's1', name: 'Fuel Vault Check' }
  ])

  const [checkpoints, setCheckpoints] = useState([
    { id: 'c1', route_id: 'r1', name: 'North Gate Perimeter', tag_code: 'QR-N483', radius: 15, x: 260, y: 80, order: 1 },
    { id: 'c2', route_id: 'r1', name: 'Fuel Depot Storage', tag_code: 'NFC-F239', radius: 15, x: 420, y: 180, order: 2 },
    { id: 'c3', route_id: 'r1', name: 'Primary Crusher Point', tag_code: 'QR-P102', radius: 20, x: 180, y: 260, order: 3 }
  ])

  const [newSiteName, setNewSiteName] = useState('')
  const [newRouteName, setNewRouteName] = useState('')
  const [drawingPoints, setDrawingPoints] = useState([])
  const [newCheckpoint, setNewCheckpoint] = useState({ name: '', tag_code: '', radius: 15 })

  const canvasRef = useRef(null)

  useEffect(() => {
    // Try to fetch real sites and routes from Supabase if connected
    const loadData = async () => {
      try {
        const { data: dbSites } = await supabase.from('sites').select('*')
        if (dbSites && dbSites.length > 0) {
          setSites(dbSites)
          setActiveSite(dbSites[0].id)
        }

        const { data: dbRoutes } = await supabase.from('routes').select('*')
        if (dbRoutes) setRoutes(dbRoutes)

        const { data: dbCheckpoints } = await supabase.from('checkpoints').select('*')
        if (dbCheckpoints) {
          // Format DB point location to x/y coordinates for our mock tactical visualizer
          const formatted = dbCheckpoints.map(cp => ({
            id: cp.id,
            route_id: cp.route_id,
            name: cp.name,
            tag_code: cp.tag_code,
            radius: cp.geofence_radius_meters,
            x: 100 + Math.random() * 300, // mock mapping
            y: 100 + Math.random() * 200,
            order: cp.sequence_order
          }))
          setCheckpoints(formatted)
        }
      } catch (err) {
        console.log('Supabase connection details not found, using visual sandbox mode')
      }
    }
    loadData()
  }, [])

  // Geofence Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Clear
    ctx.fillStyle = '#0B0F0E'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
    ctx.lineWidth = 1
    const gridSize = 40
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw active geofence
    const activeSiteObj = sites.find(s => s.id === activeSite)
    if (activeSiteObj && drawingPoints.length === 0) {
      // Mock parsing POLYGON((x1 y1, x2 y2...))
      const polygonMatch = activeSiteObj.geofence.match(/\(\((.*?)\)\)/)
      if (polygonMatch) {
        const coords = polygonMatch[1].split(',').map(pair => {
          const [x, y] = pair.trim().split(' ').map(Number)
          return { x, y }
        })

        // Draw Filled polygon
        ctx.strokeStyle = '#3DDCC5'
        ctx.fillStyle = 'rgba(61, 220, 197, 0.05)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(coords[0].x, coords[0].y)
        coords.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y))
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Draw vertices
        coords.forEach(pt => {
          ctx.fillStyle = '#3DDCC5'
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    }

    // Draw drawing path in progress
    if (drawingPoints.length > 0) {
      ctx.strokeStyle = '#E8A33D'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y)
      drawingPoints.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y))
      ctx.stroke()

      // Draw vertices
      drawingPoints.forEach(pt => {
        ctx.fillStyle = '#E8A33D'
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Draw active site checkpoints
    const activeRoutes = routes.filter(r => r.site_id === activeSite).map(r => r.id)
    checkpoints.filter(cp => activeRoutes.includes(cp.route_id)).forEach(cp => {
      // Geofence Radius range indicator
      ctx.strokeStyle = 'rgba(61, 220, 197, 0.1)'
      ctx.fillStyle = 'rgba(61, 220, 197, 0.01)'
      ctx.beginPath()
      ctx.arc(cp.x, cp.y, cp.radius * 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Point
      ctx.fillStyle = '#3DDCC5'
      ctx.beginPath()
      ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2)
      ctx.fill()

      // Label and Order sequence tag
      ctx.fillStyle = '#12181A'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 1
      const label = `[${cp.order}] ${cp.name}`
      const txtWidth = ctx.measureText(label).width
      ctx.fillRect(cp.x - txtWidth/2 - 4, cp.y - 18, txtWidth + 8, 12)
      ctx.strokeRect(cp.x - txtWidth/2 - 4, cp.y - 18, txtWidth + 8, 12)

      ctx.fillStyle = '#E2E8F0'
      ctx.font = '8px "IBM Plex Mono"'
      ctx.fillText(label, cp.x - txtWidth/2, cp.y - 10)
    })

  }, [sites, activeSite, drawingPoints, routes, checkpoints])

  // Canvas Click Handler (draw vertices or place checkpoint)
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)

    // Add point to drawn polygon geofence
    setDrawingPoints(prev => [...prev, { x, y }])
  }

  // Save new geofence
  const saveGeofence = async () => {
    if (drawingPoints.length < 3) {
      alert('Geofence must have at least 3 points.')
      return
    }

    // Format to WKT POLYGON((x1 y1, x2 y2...))
    const closedPoints = [...drawingPoints, drawingPoints[0]]
    const wkt = `POLYGON((${closedPoints.map(p => `${p.x} ${p.y}`).join(', ')}))`

    const activeSiteObj = sites.find(s => s.id === activeSite)
    if (activeSiteObj) {
      const updatedSites = sites.map(s => {
        if (s.id === activeSite) {
          return { ...s, geofence: wkt }
        }
        return s
      })
      setSites(updatedSites)
      setDrawingPoints([])

      try {
        await supabase
          .from('sites')
          .update({ geofence: wkt })
          .eq('id', activeSite)
      } catch (err) {
        console.log('Saved locally (Supabase keys not configured)')
      }
    }
  }

  const handleSaveNewLocation = (e) => {
    if (e) e.preventDefault()
    if (!locationForm.name.trim()) return

    const newId = 'site_' + Date.now()
    const defaultGeofence = 'POLYGON((100 100, 300 100, 250 250, 100 200, 100 100))'
    
    const newSiteObj = {
      id: newId,
      name: locationForm.name.trim(),
      address: locationForm.address.trim() || 'Sector Location',
      latitude: Number(locationForm.latitude) || -12.9841,
      longitude: Number(locationForm.longitude) || 28.6412,
      geofence_radius_meters: Number(locationForm.geofence_radius_meters) || 25.0,
      security_level: locationForm.security_level || 'High',
      geofence: defaultGeofence
    }

    const updated = [newSiteObj, ...sites]
    updateSites(updated)
    setActiveSite(newId)
    setShowLocationModal(false)
    setLocationForm({
      name: '',
      address: '',
      latitude: -12.9841,
      longitude: 28.6412,
      geofence_radius_meters: 25,
      security_level: 'High'
    })
  }

  const autoDetectGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationForm(prev => ({
            ...prev,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6))
          }))
        },
        (err) => alert('Unable to fetch live GPS coordinates: ' + err.message)
      )
    } else {
      alert('Geolocation is not supported by your browser.')
    }
  }

  const handleAddSite = async () => {
    if (!newSiteName.trim()) {
      setShowLocationModal(true)
      return
    }
    const newId = 'site_' + Date.now()
    const defaultGeofence = 'POLYGON((100 100, 300 100, 250 250, 100 200, 100 100))'
    const newSiteObj = {
      id: newId,
      name: newSiteName.trim(),
      address: 'Main Perimeter Site',
      latitude: -12.9841,
      longitude: 28.6412,
      geofence_radius_meters: 25.0,
      security_level: 'High',
      geofence: defaultGeofence
    }

    const updated = [newSiteObj, ...sites]
    updateSites(updated)
    setActiveSite(newId)
    setNewSiteName('')
  }

  const handleAddRoute = async () => {
    if (!newRouteName) return
    const newId = 'r_' + Date.now()
    const newRouteObj = { id: newId, site_id: activeSite, name: newRouteName }

    setRoutes(prev => [...prev, newRouteObj])
    setNewRouteName('')
  }

  const handleAddCheckpoint = async (routeId) => {
    if (!newCheckpoint.name || !newCheckpoint.tag_code) return
    const newId = 'c_' + Date.now()
    const routeCheckpoints = checkpoints.filter(c => c.route_id === routeId)
    const nextOrder = routeCheckpoints.length + 1

    const newCpObj = {
      id: newId,
      route_id: routeId,
      name: newCheckpoint.name,
      tag_code: newCheckpoint.tag_code,
      radius: Number(newCheckpoint.radius),
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      order: nextOrder
    }

    setCheckpoints(prev => [...prev, newCpObj])
    setNewCheckpoint({ name: '', tag_code: '', radius: 15 })
  }

  const deleteCheckpoint = async (id) => {
    setCheckpoints(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50">
        <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#3DDCC5]" />
          Sites & Locations Configuration
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3DDCC5] text-black font-bold text-xs hover:bg-[#3DDCC5]/90 transition shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ADD NEW LOCATION</span>
          </button>

          <button
            onClick={exportSitesCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-mono font-medium hover:bg-white/10 transition cursor-pointer"
            title="Export Locations CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#3DDCC5]" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-8 flex-1 grid grid-cols-3 gap-6 overflow-y-auto">
        {/* Sites, Routes & Checkpoint setup */}
        <div className="col-span-1 flex flex-col gap-6">
          {/* Sites selector */}
          <div className="bg-[#12181A] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wide">Select Site</h3>
              <span className="text-[10px] text-white/45">Sites manage their own geofenced perimeters</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {sites.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSite(s.id)
                    setDrawingPoints([])
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-mono transition-all border ${
                    activeSite === s.id
                      ? 'bg-[#3DDCC5]/10 text-[#3DDCC5] border-[#3DDCC5]/20 font-bold'
                      : 'bg-transparent text-white/50 border-transparent hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New Site Name..."
                value={newSiteName}
                onChange={e => setNewSiteName(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]/40"
              />
              <button
                onClick={handleAddSite}
                className="bg-white/5 border border-white/10 p-2.5 rounded-lg text-white hover:bg-white/10"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Routes list inside Active Site */}
          <div className="bg-[#12181A] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wide">Routes & Patrol Paths</h3>
              <span className="text-[10px] text-white/45">Define patrol patterns and checkpoint sequences</span>
            </div>

            <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
              {routes.filter(r => r.site_id === activeSite).map(r => (
                <div key={r.id} className="p-3 bg-black/20 border border-white/5 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">{r.name}</span>
                  </div>

                  {/* Route Checkpoints list */}
                  <div className="flex flex-col gap-1.5">
                    {checkpoints.filter(cp => cp.route_id === r.id).sort((a,b)=>a.order - b.order).map(cp => (
                      <div key={cp.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 px-2 py-1.5 rounded text-[11px] font-mono">
                        <span className="text-white/60">
                          {cp.order}. {cp.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#3DDCC5]/80 bg-[#3DDCC5]/10 px-1 rounded">{cp.tag_code}</span>
                          <button
                            onClick={() => deleteCheckpoint(cp.id)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Checkpoint to this route */}
                  <div className="flex flex-col gap-2 border-t border-white/5 pt-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Checkpoint Name"
                        value={newCheckpoint.name}
                        onChange={e => setNewCheckpoint({ ...newCheckpoint, name: e.target.value })}
                        className="bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Tag (QR/NFC)"
                        value={newCheckpoint.tag_code}
                        onChange={e => setNewCheckpoint({ ...newCheckpoint, tag_code: e.target.value })}
                        className="bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Radius (m)"
                        value={newCheckpoint.radius}
                        onChange={e => setNewCheckpoint({ ...newCheckpoint, radius: e.target.value })}
                        className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white font-mono"
                      />
                      <button
                        onClick={() => handleAddCheckpoint(r.id)}
                        className="flex-1 bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 text-[#3DDCC5] text-[10px] font-mono font-bold rounded py-1 hover:bg-[#3DDCC5]/20"
                      >
                        + ADD POINT
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="New Route Name..."
                value={newRouteName}
                onChange={e => setNewRouteName(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
              <button
                onClick={handleAddRoute}
                className="bg-white/5 border border-white/10 p-2.5 rounded-lg text-white hover:bg-white/10"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Geofence editor map */}
        <div className="col-span-2 bg-[#12181A] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white font-heading">TACTICAL GEOPOLYGON EDITOR</h3>
              <span className="text-[10px] text-white/45">Visualise and draw PostGIS coordinates for geofences</span>
            </div>

            {drawingPoints.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawingPoints([])}
                  className="px-3 py-1 bg-white/5 border border-white/10 text-white/60 hover:text-white rounded-lg text-xs font-mono"
                >
                  RESET
                </button>
                <button
                  onClick={saveGeofence}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#3DDCC5]/20 border border-[#3DDCC5]/30 text-[#3DDCC5] hover:bg-[#3DDCC5]/30 rounded-lg text-xs font-bold font-mono"
                >
                  <Save className="w-3.5 h-3.5" />
                  SAVE POLYGON
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-white/30 font-mono">GEOFENCE LOCKED</span>
            )}
          </div>

          {/* Interactive Editor Box */}
          <div className="flex-1 min-h-[400px] border border-white/5 rounded-lg overflow-hidden relative">
            <canvas
              ref={canvasRef}
              width={590}
              height={400}
              onClick={handleCanvasClick}
              className="w-full h-full block cursor-crosshair"
            />

            {/* Coordinates overlay log */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 border border-white/10 p-3 rounded-lg flex flex-col gap-1 max-h-[100px] overflow-y-auto">
              <span className="text-[9px] font-bold text-[#3DDCC5] font-mono">PostGIS WKT Polygon Coordinate Log:</span>
              <code className="text-[9px] text-white/60 font-mono break-all leading-tight">
                {drawingPoints.length > 0
                  ? `POLYGON((${drawingPoints.map(p => `${p.x} ${p.y}`).join(', ')}))`
                  : sites.find(s => s.id === activeSite)?.geofence || 'No geofence coordinates loaded.'}
              </code>
            </div>
          </div>
        </div>
      </main>

      {/* ADD NEW LOCATION MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveNewLocation} className="bg-[#12181A] border border-[#3DDCC5]/30 rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#3DDCC5]" /> ADD NEW PATROL LOCATION / SITE
              </span>
              <button type="button" onClick={() => setShowLocationModal(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/50 font-mono uppercase font-bold">SITE / LOCATION NAME *</label>
              <input
                type="text"
                required
                placeholder="e.g. East Logistics Hub, North Storage Yard"
                value={locationForm.name}
                onChange={e => setLocationForm({ ...locationForm, name: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/50 font-mono uppercase font-bold">ADDRESS / SECTOR NOTES</label>
              <input
                type="text"
                placeholder="e.g. Industrial Zone Gate 3, Sector 12"
                value={locationForm.address}
                onChange={e => setLocationForm({ ...locationForm, address: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DDCC5]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/50 font-mono uppercase font-bold">LATITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={locationForm.latitude}
                  onChange={e => setLocationForm({ ...locationForm, latitude: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/50 font-mono uppercase font-bold">LONGITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={locationForm.longitude}
                  onChange={e => setLocationForm({ ...locationForm, longitude: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={autoDetectGPSLocation}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-[#3DDCC5] font-mono font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              AUTO-DETECT CURRENT GPS COORDINATES
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/50 font-mono uppercase font-bold">GEOFENCE RADIUS</label>
                <select
                  value={locationForm.geofence_radius_meters}
                  onChange={e => setLocationForm({ ...locationForm, geofence_radius_meters: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#3DDCC5]"
                >
                  <option value={10}>10 Meters (Tight)</option>
                  <option value={15}>15 Meters (Standard)</option>
                  <option value={25}>25 Meters (Medium)</option>
                  <option value={50}>50 Meters (Wide Depot)</option>
                  <option value={100}>100 Meters (Perimeter)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/50 font-mono uppercase font-bold">SECURITY TIER</label>
                <select
                  value={locationForm.security_level}
                  onChange={e => setLocationForm({ ...locationForm, security_level: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#3DDCC5]"
                >
                  <option value="High">HIGH SECURITY</option>
                  <option value="Medium">MEDIUM RISK</option>
                  <option value="Low">LOW RISK</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold font-mono cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#3DDCC5] text-black font-extrabold rounded-xl hover:bg-[#3DDCC5]/90 text-xs shadow cursor-pointer"
              >
                SAVE LOCATION
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
