import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { Activity, ShieldAlert, CheckCircle, Navigation, Play, User } from 'lucide-react'

export default function LiveOverview({ sharedScans }) {
  const [stats, setStats] = useState({
    guardsActive: 4,
    checkpointsToday: 28,
    geofenceFlags: 3,
    activeRoutes: 2
  })

  const [scans, setScans] = useState(sharedScans)

  useEffect(() => {
    // Sync local simulation changes in real-time
    setScans(sharedScans)
  }, [sharedScans])

  const [guards, setGuards] = useState([
    { id: 'g1', name: 'Amadou Camara', x: 220, y: 150, active: true },
    { id: 'g2', name: 'Regan Nguluta', x: 380, y: 220, active: true },
    { id: 'g3', name: 'Bentley Chafe', x: 120, y: 280, active: true }
  ])

  const canvasRef = useRef(null)

  // Real-time Supabase connection
  useEffect(() => {
    // 1. Fetch initial counts if Supabase is connected
    const loadInitialData = async () => {
      try {
        const { data: activeShifts } = await supabase
          .from('shifts')
          .select('id, profiles(name)')
          .is('ended_at', null)
        
        if (activeShifts) {
          setStats(prev => ({ ...prev, guardsActive: activeShifts.length }))
        }

        const today = new Date()
        today.setHours(0,0,0,0)
        const { data: todayScans } = await supabase
          .from('checkpoint_scans')
          .select('id, within_geofence, checkpoints(name), profiles(name), shifts(sites(name))')
          .gte('scanned_at', today.toISOString())
        
        if (todayScans) {
          const geofenceFlagsCount = todayScans.filter(s => !s.within_geofence).length
          setStats(prev => ({
            ...prev,
            checkpointsToday: todayScans.length,
            geofenceFlags: geofenceFlagsCount
          }))
          
          // Map to match internal structure
          const formatted = todayScans.map(s => ({
            id: s.id,
            site_name: s.shifts?.sites?.name || 'Unknown Site',
            guard_name: s.profiles?.name || 'Guard',
            checkpoint_name: s.checkpoints?.name || 'Checkpoint',
            scanned_at: s.scanned_at,
            within_geofence: s.within_geofence,
            tag_code: s.client_generated_id?.substring(0, 8) || 'SYNCED'
          }))
          setScans(formatted.slice(0, 10))
        }
      } catch (err) {
        console.log('Supabase not configured, showing interactive simulation data instead.')
      }
    }

    loadInitialData()

    // 2. Realtime subscription to checkpoint_scans
    const scanSubscription = supabase
      .channel('public:checkpoint_scans')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkpoint_scans' },
        async (payload) => {
          console.log('New scan received in realtime:', payload)
          
          // Fetch checkpoint and guard details
          const { data: scanDetails } = await supabase
            .from('checkpoint_scans')
            .select('scanned_at, within_geofence, checkpoints(name), profiles(name), shifts(sites(name))')
            .eq('id', payload.new.id)
            .single()

          if (scanDetails) {
            const newScan = {
              id: payload.new.id,
              site_name: scanDetails.shifts?.sites?.name || 'Main Depot',
              guard_name: scanDetails.profiles?.name || 'Guard',
              checkpoint_name: scanDetails.checkpoints?.name || 'Checkpoint',
              scanned_at: scanDetails.scanned_at,
              within_geofence: scanDetails.within_geofence,
              tag_code: payload.new.client_generated_id?.substring(0, 8) || 'REALTIME'
            }

            setScans(prev => [newScan, ...prev])
            setStats(prev => ({
              ...prev,
              checkpointsToday: prev.checkpointsToday + 1,
              geofenceFlags: prev.geofenceFlags + (newScan.within_geofence ? 0 : 1)
            }))

            // Animate/move the guard dot on map
            setGuards(prev => {
              return prev.map((g, idx) => {
                if (g.name === newScan.guard_name) {
                  // Relocate guard randomly near scan site for demo
                  return { ...g, x: 100 + Math.random() * 400, y: 100 + Math.random() * 200 }
                }
                return g
              })
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(scanSubscription)
    }
  }, [])

  // Canvas drawing for tactical dashboard map representation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#0B0F0E'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw Grid lines (low opacity white)
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

      // Draw Site geofence polygon (Main Depot)
      ctx.strokeStyle = 'rgba(61, 220, 197, 0.15)'
      ctx.fillStyle = 'rgba(61, 220, 197, 0.02)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(80, 80)
      ctx.lineTo(520, 80)
      ctx.lineTo(460, 320)
      ctx.lineTo(60, 280)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Draw checkpoints nodes
      const checkpointNodes = [
        { name: 'North Gate', x: 260, y: 80 },
        { name: 'Fuel Depot', x: 420, y: 180 },
        { name: 'Crusher Area', x: 180, y: 260 },
        { name: 'Admin Block', x: 150, y: 120 }
      ]

      checkpointNodes.forEach(cp => {
        // Outer range circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, 25, 0, Math.PI * 2)
        ctx.stroke()

        // Point
        ctx.fillStyle = '#1C2426'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.font = '9px "IBM Plex Mono"'
        ctx.fillText(cp.name, cp.x + 10, cp.y + 3)
      })

      // Draw guard points with pulsing rings
      guards.forEach(g => {
        const time = Date.now()
        const ringRadius = 8 + (time % 1200) / 1200 * 15
        const ringOpacity = 1 - (time % 1200) / 1200

        // Ring
        ctx.strokeStyle = `rgba(61, 220, 197, ${ringOpacity * 0.4})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(g.x, g.y, ringRadius, 0, Math.PI * 2)
        ctx.stroke()

        // Inner solid dot
        ctx.fillStyle = '#3DDCC5'
        ctx.beginPath()
        ctx.arc(g.x, g.y, 5, 0, Math.PI * 2)
        ctx.fill()

        // Guard name tag
        ctx.fillStyle = '#12181A'
        ctx.strokeStyle = 'rgba(61, 220, 197, 0.2)'
        ctx.lineWidth = 1
        const textWidth = ctx.measureText(g.name).width
        ctx.fillRect(g.x - textWidth/2 - 4, g.y - 20, textWidth + 8, 14)
        ctx.strokeRect(g.x - textWidth/2 - 4, g.y - 20, textWidth + 8, 14)

        ctx.fillStyle = '#ffffff'
        ctx.font = '9px "Inter"'
        ctx.fillText(g.name, g.x - textWidth/2, g.y - 10)
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [guards])

  // Trigger simulated scan for offline testing
  const triggerSimulationScan = () => {
    const randomGuard = guards[Math.floor(Math.random() * guards.length)]
    const locations = ['North Gate Perimeter', 'Fuel Depot Storage', 'Primary Crusher Point', 'Admin Area Post 1']
    const withinGeofence = Math.random() > 0.15 // 15% chance of out of geofence scan simulation

    const newScan = {
      id: Date.now().toString(),
      site_name: 'Main Mining Depot',
      guard_name: randomGuard.name,
      checkpoint_name: locations[Math.floor(Math.random() * locations.length)],
      scanned_at: new Date().toISOString(),
      within_geofence: withinGeofence,
      tag_code: 'SIM-' + Math.random().toString(36).substring(2, 6).toUpperCase()
    }

    setScans(prev => [newScan, ...prev])
    setStats(prev => ({
      ...prev,
      checkpointsToday: prev.checkpointsToday + 1,
      geofenceFlags: prev.geofenceFlags + (withinGeofence ? 0 : 1)
    }))

    // Move guard in the map to the location
    setGuards(prev => {
      return prev.map(g => {
        if (g.id === randomGuard.id) {
          return {
            ...g,
            x: 100 + Math.random() * 400,
            y: 100 + Math.random() * 200
          }
        }
        return g
      })
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50">
        <h2 className="font-heading text-lg font-bold text-white">Ops Control Center</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={triggerSimulationScan}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3DDCC5]/20 bg-[#3DDCC5]/10 text-xs font-semibold text-[#3DDCC5] hover:bg-[#3DDCC5]/20 transition-all font-mono"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            SIMULATE SCAN
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3DDCC5] animate-pulse"></span>
            <span className="text-xs text-white/60 font-mono">SUPABASE REALTIME CONNECTED</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-4 sm:p-8 flex-grow flex flex-col gap-6 overflow-y-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono tracking-wider">GUARDS ON SHIFT</span>
              <span className="text-3xl font-heading font-semibold text-white">{stats.guardsActive}</span>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
              <User className="w-6 h-6 text-[#3DDCC5]" />
            </div>
          </div>

          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono tracking-wider">CHECKPOINTS SCANNED TODAY</span>
              <span className="text-3xl font-heading font-semibold text-white">{stats.checkpointsToday}</span>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
              <CheckCircle className="w-6 h-6 text-[#3DDCC5]" />
            </div>
          </div>

          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono tracking-wider">GEOFENCE FLAGS</span>
              <span className="text-3xl font-heading font-semibold text-[#E8A33D]">{stats.geofenceFlags}</span>
            </div>
            <div className="w-12 h-12 bg-[#E8A33D]/10 rounded-xl flex items-center justify-center border border-[#E8A33D]/25">
              <ShieldAlert className="w-6 h-6 text-[#E8A33D]" />
            </div>
          </div>

          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-mono tracking-wider">ACTIVE ROUTES</span>
              <span className="text-3xl font-heading font-semibold text-white">{stats.activeRoutes}</span>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">
              <Navigation className="w-6 h-6 text-[#3DDCC5]" />
            </div>
          </div>
        </div>

        {/* Map & Live Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tactical Map */}
          <div className="col-span-1 lg:col-span-2 bg-[#12181A] border border-white/5 rounded-xl p-4 flex flex-col gap-3 min-h-[320px] sm:min-h-[480px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-heading">TACTICAL PATROL VISUALIZER</span>
                <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded font-mono">2D MAP</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono">SITE: MAIN MINING DEPOT</span>
            </div>
            <div className="flex-grow rounded-lg border border-white/5 overflow-hidden relative min-h-[260px] sm:min-h-[380px]">
              <canvas
                ref={canvasRef}
                width={590}
                height={390}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-[#12181A] border border-white/5 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white font-heading">LIVE ACTIVITY FEED</h3>
              <span className="text-[10px] text-white/40 font-mono">REALTIME BROADCAST FROM GUARDS</span>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col gap-3 max-h-[300px] lg:max-h-[420px] pr-1">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className={`p-3 rounded-lg border ${
                    scan.within_geofence
                      ? 'bg-white/[0.01] border-white/5'
                      : 'bg-[#E8A33D]/5 border-[#E8A33D]/20'
                  } flex flex-col gap-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{scan.guard_name || scan.guard}</span>
                    <span className="text-[9px] text-white/40 font-mono">
                      {new Date(scan.scanned_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="text-[11px] text-white/80 flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3DDCC5]"></span>
                      {scan.checkpoint_name || scan.checkpoint}
                    </div>
                    <div className="text-[9px] text-white/30 font-mono pl-2.5">
                      {scan.site_name || scan.site} • {scan.tag_code}
                    </div>
                  </div>

                  {!scan.within_geofence && (
                    <div className="flex items-center gap-1.5 text-[9px] text-[#E8A33D] font-mono bg-[#E8A33D]/10 px-2 py-0.5 rounded w-max mt-0.5">
                      <ShieldAlert className="w-3 h-3" />
                      GEOFENCE BREACH (SCAN OUTSIDE RADIUS)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
