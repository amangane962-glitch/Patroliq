import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { Map, Plus, Trash, Save, Info, AlertTriangle } from 'lucide-react'

export default function SitesAndRoutes() {
  const [sites, setSites] = useState([
    { id: 's1', name: 'Main Mining Depot', geofence: 'POLYGON((80 80, 520 80, 460 320, 60 280, 80 80))' },
    { id: 's2', name: 'Washing Plant Area', geofence: 'POLYGON((100 100, 300 100, 300 300, 100 300, 100 100))' }
  ])

  const [activeSite, setActiveSite] = useState('s1')
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

  const handleAddSite = async () => {
    if (!newSiteName) return
    const newId = 's_' + Date.now()
    const defaultGeofence = 'POLYGON((100 100, 300 100, 250 250, 100 200, 100 100))'
    const newSiteObj = { id: newId, name: newSiteName, geofence: defaultGeofence }

    setSites(prev => [...prev, newSiteObj])
    setActiveSite(newId)
    setNewSiteName('')

    try {
      await supabase
        .from('sites')
        .insert({ name: newSiteName, geofence: defaultGeofence })
    } catch (e) {
      console.log('Saved site locally')
    }
  }

  const handleAddRoute = async () => {
    if (!newRouteName) return
    const newId = 'r_' + Date.now()
    const newRouteObj = { id: newId, site_id: activeSite, name: newRouteName }

    setRoutes(prev => [...prev, newRouteObj])
    setNewRouteName('')

    try {
      await supabase
        .from('routes')
        .insert({ site_id: activeSite, name: newRouteName })
    } catch (e) {
      console.log('Saved route locally')
    }
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

    try {
      await supabase
        .from('checkpoints')
        .insert({
          route_id: routeId,
          name: newCheckpoint.name,
          tag_code: newCheckpoint.tag_code,
          geofence_radius_meters: Number(newCheckpoint.radius),
          location: `POINT(${newCpObj.x} ${newCpObj.y})`,
          sequence_order: nextOrder
        })
    } catch (e) {
      console.log('Saved checkpoint locally')
    }
  }

  const deleteCheckpoint = async (id) => {
    setCheckpoints(prev => prev.filter(c => c.id !== id))
    try {
      await supabase.from('checkpoints').delete().eq('id', id)
    } catch (e) {}
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50">
        <h2 className="font-heading text-lg font-bold text-white">Sites & Routes Configuration</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-white/40 bg-white/5 px-3 py-1.5 rounded-lg font-mono">
            <Info className="w-3.5 h-3.5 text-[#3DDCC5]" />
            <span>CLICK ON MAP CANVAS TO DRAW GEOFENCE POINTS</span>
          </div>
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
    </div>
  )
}
