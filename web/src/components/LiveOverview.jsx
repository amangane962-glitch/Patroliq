import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { 
  Activity, ShieldAlert, CheckCircle, Navigation, Play, User, Search, 
  Clock, Shield, Eye, AlertTriangle, ChevronRight, BarChart2, Globe, Radio, Check, Crosshair
} from 'lucide-react'

export default function LiveOverview({ sharedScans, sharedIncidents, sharedSites }) {
  const [stats, setStats] = useState({
    guardsActive: 4,
    checkpointsToday: 28,
    geofenceFlags: 3,
    activeRoutes: 2
  })

  const [scans, setScans] = useState(sharedScans || [])
  const [activeTabFilter, setActiveTabFilter] = useState('Master')
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  // Live ticking digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const mins = String(now.getMinutes()).padStart(2, '0')
      const secs = String(now.getSeconds()).padStart(2, '0')
      const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0')
      setCurrentTimeStr(`${hours},${mins}${secs},${ms}`)
    }, 50)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (sharedScans) setScans(sharedScans)
  }, [sharedScans])

  const [guards, setGuards] = useState([
    { id: 'g1', name: 'Amadou Camara', x: 220, y: 110, active: true },
    { id: 'g2', name: 'Regan Nguluta', x: 380, y: 160, active: true },
    { id: 'g3', name: 'Bentley Chafe', x: 140, y: 200, active: true }
  ])

  const canvasRef = useRef(null)

  // Real-time Supabase connection
  useEffect(() => {
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
        console.log('Supabase check fallback to simulated state.')
      }
    }

    loadInitialData()

    const scanSubscription = supabase
      .channel('public:checkpoint_scans')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkpoint_scans' },
        async (payload) => {
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
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(scanSubscription)
    }
  }, [])

  // Canvas drawing for War Room Alert radar visualization
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let angle = 0

    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      const centerX = width / 2
      const centerY = height / 2

      ctx.fillStyle = '#070c12'
      ctx.fillRect(0, 0, width, height)

      // Draw Grid Lines (Cyan glow tint)
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)'
      ctx.lineWidth = 1
      const step = 30
      for (let x = 0; x < width; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Concentric Radar Rings
      const maxRadius = Math.min(centerX, centerY) - 15
      for (let r = 1; r <= 3; r++) {
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(centerX, centerY, (maxRadius / 3) * r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Radar Rotating Sweep Cone
      angle += 0.02
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, maxRadius, angle - 0.5, angle)
      ctx.closePath()
      const sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius)
      sweepGradient.addColorStop(0, 'rgba(0, 242, 254, 0.25)')
      sweepGradient.addColorStop(1, 'rgba(0, 242, 254, 0.02)')
      ctx.fillStyle = sweepGradient
      ctx.fill()
      ctx.restore()

      // Active Scan Nodes & Guards
      guards.forEach(g => {
        // Glowing target ring
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(g.x, g.y, 10, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#00f2fe'
        ctx.beginPath()
        ctx.arc(g.x, g.y, 4, 0, Math.PI * 2)
        ctx.fill()

        // Guard Label
        ctx.fillStyle = 'rgba(0, 242, 254, 0.8)'
        ctx.font = '9px "IBM Plex Mono"'
        ctx.fillText(g.name, g.x + 12, g.y + 3)
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [guards])

  const triggerSimulationScan = () => {
    const randomGuard = guards[Math.floor(Math.random() * guards.length)]
    const locations = ['North Gate Perimeter', 'Fuel Depot Storage', 'Primary Crusher Point', 'Explosives Vault']
    const withinGeofence = Math.random() > 0.15

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
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070a0f] text-slate-100 font-sans p-3 md:p-5 gap-4 overflow-y-auto">
      {/* Top Operations Header Bar (Screenshot 1 Top Navigation) */}
      <header className="cyber-panel px-4 py-2.5 rounded-xl flex items-center justify-between border border-[#00f2fe]/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00f2fe]" />
            <h1 className="font-heading font-bold text-white tracking-wider text-base">Operations Center</h1>
          </div>
          <nav className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-400">
            {['Offices', 'Templates', 'Approvals', 'Compliances', 'Monitors', 'Cross', 'Logo'].map((item, idx) => (
              <span key={idx} className="hover:text-[#00f2fe] cursor-pointer transition">{item}</span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-[#0b141c] border border-[#00f2fe]/20 rounded-full pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-[#00f2fe] w-36"
            />
          </div>
          
          <div className="bg-[#00f2fe]/10 border border-[#00f2fe]/30 px-3 py-1 rounded-full text-xs font-mono font-bold text-[#00f2fe] flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,242,254,0.15)]">
            <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-pulse"></span>
            <span>0,071,000</span>
          </div>

          <button 
            onClick={triggerSimulationScan}
            className="bg-[#00f2fe] text-black font-mono font-bold text-xs px-3 py-1 rounded-full hover:bg-[#00d2ff] transition shadow-[0_0_15px_rgba(0,242,254,0.4)] flex items-center gap-1"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Simulate Scan</span>
          </button>
        </div>
      </header>

      {/* Main Operations Grid Layout (Matching Screenshot 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* TOP ROW: 4 SECTIONS */}
        
        {/* 1. Readiness & Metric Gauge (Left Column - 3 cols) */}
        <div className="lg:col-span-3 cyber-panel p-4 rounded-xl flex flex-col justify-between border border-[#00f2fe]/15 gap-4">
          <div className="flex items-center justify-between border-b border-[#00f2fe]/10 pb-2">
            <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">OR 52 NONONCO?</span>
            <span className="text-[10px] text-[#00f2fe] font-mono">LIVE GAUGE</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Circle Metric 1 */}
            <div className="bg-[#0b141c] p-3 rounded-lg border border-[#00f2fe]/10 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-full border-4 border-[#00f2fe]/20 border-t-[#00f2fe] flex items-center justify-center">
                <span className="text-sm font-bold font-mono text-white">10%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-2">A/1465 17-</span>
              <span className="text-[8px] text-slate-500 font-mono uppercase">Daily Active Target</span>
            </div>

            {/* Sparkline Metric 2 */}
            <div className="bg-[#0b141c] p-3 rounded-lg border border-[#00f2fe]/10 flex flex-col justify-between">
              <span className="text-xs font-bold text-[#00f2fe] font-mono">Stanc.</span>
              <div className="h-8 flex items-end gap-1">
                {[40, 65, 30, 85, 45, 95, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-[#00f2fe]/40 rounded-t" style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <span className="text-xs font-bold font-mono text-white mt-1">4/%</span>
              <span className="text-[8px] text-slate-400 font-mono">Shift Optimization</span>
            </div>
          </div>

          {/* Subcard */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-[#0b141c] p-2 rounded border border-[#00f2fe]/10 text-center">
              <div className="text-slate-400 uppercase">ANAWA UIN</div>
              <div className="text-[#00f2fe] font-bold">READY 100%</div>
            </div>
            <div className="bg-[#0b141c] p-2 rounded border border-[#00f2fe]/10 text-center">
              <div className="text-slate-400 uppercase">GEOFENCE STATUS</div>
              <div className="text-emerald-400 font-bold">{stats.geofenceFlags} FLAGS</div>
            </div>
          </div>
        </div>

        {/* 2. War Room Alert Central Radar Visualizer (Middle Column - 5 cols) */}
        <div className="lg:col-span-5 cyber-panel-glow p-4 rounded-xl flex flex-col justify-between border border-[#00f2fe]/30 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#00f2fe]/20 pb-2.5 z-10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#00f2fe] animate-pulse" />
              <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">REDICTION WASTCS4INTIGHTS</span>
            </div>
            <div className="flex items-center gap-1">
              {['Master', 'Active', 'Realtime', 'Focus'].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTabFilter(t)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono transition ${
                    activeTabFilter === t ? 'bg-[#00f2fe] text-black font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Radar Container */}
          <div className="relative h-56 rounded-lg border border-[#00f2fe]/20 overflow-hidden bg-[#070c12] my-2">
            <canvas ref={canvasRef} width={480} height={220} className="w-full h-full block" />
            
            {/* Center War Room Alert Banner Overlay (Matching Screenshot 1) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[#070c12]/80 backdrop-blur-md border border-[#00f2fe] px-6 py-2 rounded-xl text-center shadow-[0_0_20px_rgba(0,242,254,0.3)]">
                <h3 className="text-base font-heading font-extrabold text-white tracking-wide flex items-center gap-2">
                  <span>War Room Alert :)</span>
                  <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-ping"></span>
                </h3>
                <span className="text-[10px] text-[#00f2fe] font-mono font-bold block mt-0.5">EXECE15 14,003</span>
              </div>
            </div>

            {/* Bottom Coordinate Bar */}
            <div className="absolute bottom-2 left-3 text-[9px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-white/5">
              <span>Posiz-or-tehor: <strong className="text-[#00f2fe]">SPU,MU202</strong></span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1"><Crosshair className="w-3 h-3 text-[#00f2fe]" /> Live Telemetry Radar</span>
            <span className="text-[#00f2fe]">TARGET ACTIVE: {stats.guardsActive} OFFICERS</span>
          </div>
        </div>

        {/* 3. Priority War Room Alerts & Action Cards (Right Middle - 2 cols) */}
        <div className="lg:col-span-2 cyber-panel p-4 rounded-xl flex flex-col justify-between border border-[#00f2fe]/15 gap-2">
          <div className="flex items-center justify-between border-b border-[#00f2fe]/10 pb-2">
            <span className="font-mono text-xs font-bold text-slate-300 uppercase">PRAATION ALOSH</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>

          {/* Action Cards (Screenshot 1 Glowing Cyan Buttons) */}
          <div className="flex flex-col gap-2">
            <div className="bg-[#00f2fe]/20 hover:bg-[#00f2fe]/30 border border-[#00f2fe]/50 p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between shadow-[0_0_10px_rgba(0,242,254,0.1)]">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold font-mono text-white">BRICA OLERENT</span>
                <span className="text-[8px] text-slate-300 font-mono">AIRPORT DISPATCH</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00f2fe]" />
            </div>

            <div className="bg-[#00f2fe]/20 hover:bg-[#00f2fe]/30 border border-[#00f2fe]/50 p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between shadow-[0_0_10px_rgba(0,242,254,0.1)]">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold font-mono text-white">YACCOR ATO</span>
                <span className="text-[8px] text-slate-300 font-mono">MAIN DEPOT GUARD</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00f2fe]" />
            </div>
          </div>

          {/* Rate Cards */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="bg-[#0b141c] px-3 py-1.5 rounded border border-[#00f2fe]/15 flex items-center justify-between font-mono">
              <span className="text-[9px] text-slate-400">PESSID REPORT</span>
              <span className="text-xs font-bold text-[#00f2fe]">10.80</span>
            </div>
            <div className="bg-[#0b141c] px-3 py-1.5 rounded border border-[#00f2fe]/15 flex items-center justify-between font-mono">
              <span className="text-[9px] text-slate-400">YINCO LABS</span>
              <span className="text-xs font-bold text-[#00f2fe]">9.40</span>
            </div>
          </div>
        </div>

        {/* 4. Security Breakdown & Risk Curve (Far Right - 2 cols) */}
        <div className="lg:col-span-2 cyber-panel p-4 rounded-xl flex flex-col justify-between border border-[#00f2fe]/15 gap-2">
          <div className="flex items-center justify-between border-b border-[#00f2fe]/10 pb-2">
            <span className="font-mono text-xs font-bold text-slate-300 uppercase">BRETKOW</span>
            <span className="text-[9px] text-slate-500 font-mono">RISK</span>
          </div>

          <div className="flex flex-col gap-1.5 font-mono text-[10px]">
            <div className="bg-[#0b141c] p-1.5 rounded border border-white/5 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span className="text-slate-300">Gaga Patrol</span>
            </div>
            <div className="bg-[#0b141c] p-1.5 rounded border border-white/5 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span className="text-slate-300">Shadre0r</span>
            </div>
            <div className="bg-[#0b141c] p-1.5 rounded border border-white/5 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span className="text-slate-300">Orklation</span>
            </div>
          </div>

          {/* Risk Gaussian Bell Curve Graph */}
          <div className="bg-[#0b141c] p-2 rounded-lg border border-[#00f2fe]/15 flex flex-col gap-1">
            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">VIATTICAT OCOUTION</span>
            <div className="h-16 relative flex items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                <path 
                  d="M 0 45 Q 35 45 50 5 Q 65 45 100 45" 
                  fill="none" 
                  stroke="#00f2fe" 
                  strokeWidth="2" 
                />
                <circle cx="50" cy="5" r="3" fill="#00f2fe" className="animate-ping" />
                <circle cx="50" cy="5" r="2" fill="#ffffff" />
                <path 
                  d="M 0 45 Q 35 45 50 5 Q 65 45 100 45 L 100 50 L 0 50 Z" 
                  fill="rgba(0,242,254,0.1)" 
                />
              </svg>
            </div>
            <span className="text-[8px] text-center font-mono text-slate-400">Risk Distribution Profile</span>
          </div>
        </div>

      </div>

      {/* MIDDLE WIDE PATROL ACTIVITY LINE GRAPH (Screenshot 1 Middle Wide Section) */}
      <div className="cyber-panel p-4 rounded-xl border border-[#00f2fe]/20 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#00f2fe]/10 pb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#00f2fe]" />
            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">MEADOR LAMS ANDR DENCLAITION (Checkpoint Density & Patrol Activity)</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">TIME HORIZON: 24H REALTIME</span>
        </div>

        <div className="h-28 relative flex items-center w-full">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            {/* Grid horizontal lines */}
            {[20, 50, 80].map((y, i) => (
              <line key={i} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(0, 242, 254, 0.08)" strokeDasharray="4 4" />
            ))}
            
            {/* Continuous Line Chart */}
            <path 
              d="M 0 70 L 100 50 L 200 80 L 300 30 L 400 65 L 500 40 L 600 75 L 700 20 L 800 60 L 900 45 L 1000 70" 
              fill="none" 
              stroke="#00f2fe" 
              strokeWidth="2.5" 
              className="drop-shadow-[0_0_8px_rgba(0,242,254,0.6)]"
            />
            
            {/* Area under curve gradient */}
            <path 
              d="M 0 70 L 100 50 L 200 80 L 300 30 L 400 65 L 500 40 L 600 75 L 700 20 L 800 60 L 900 45 L 1000 70 L 1000 100 L 0 100 Z" 
              fill="rgba(0, 242, 254, 0.08)" 
            />

            {/* Glowing nodes */}
            {[[100,50], [300,30], [500,40], [700,20], [900,45]].map(([cx, cy], idx) => (
              <g key={idx}>
                <circle cx={cx} cy={cy} r="4" fill="#00f2fe" />
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#00f2fe" strokeWidth="1" opacity="0.6" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* BOTTOM ROW: 6 PANELS GRID (Screenshot 1 Bottom Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* 1. Incident Commentary Panel */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase border-b border-[#00f2fe]/10 pb-1">Prosciant Commentary</span>
          <div className="flex flex-col gap-2 my-2 font-mono">
            <div className="bg-[#0b141c] p-2 rounded border border-[#00f2fe]/10 flex items-center justify-between">
              <span className="text-[9px] text-slate-400">Patrol Progress</span>
              <span className="text-xs font-bold text-[#00f2fe]">29%</span>
            </div>
            <div className="bg-[#0b141c] p-2 rounded border border-[#00f2fe]/10 flex items-center justify-between">
              <span className="text-[9px] text-slate-400">Geofence Flag</span>
              <span className="text-xs font-bold text-emerald-400">▲ 5%</span>
            </div>
          </div>
        </div>

        {/* 2. Dynamic Gauge Circles (WINMAX MCILITILAY) */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase border-b border-[#00f2fe]/10 pb-1">WINMAX MCILITILAY</span>
          <div className="flex items-center justify-around my-2">
            <div className="w-9 h-9 rounded-full bg-[#0b141c] border border-[#00f2fe] flex items-center justify-center text-[10px] font-mono font-bold text-[#00f2fe]">
              3%
            </div>
            <div className="w-9 h-9 rounded-full bg-[#0b141c] border border-slate-600 flex items-center justify-center text-[10px] font-mono font-bold text-slate-300">
              -35
            </div>
            <div className="w-9 h-9 rounded-full bg-[#00f2fe]/20 border border-[#00f2fe] flex items-center justify-center text-[10px] font-mono font-bold text-[#00f2fe]">
              155
            </div>
          </div>
          <span className="text-[8px] text-center font-mono text-slate-400">Active Sensor Array</span>
        </div>

        {/* 3. Shift Timer / Digital Clock */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between text-center">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase border-b border-[#00f2fe]/10 pb-1">SHIFT TIMER</span>
          <div className="my-2 py-1 bg-[#0b141c] rounded border border-[#00f2fe]/20">
            <Clock className="w-4 h-4 text-[#00f2fe] mx-auto mb-1 animate-pulse" />
            <span className="text-sm font-bold font-mono text-[#00f2fe] tracking-wider">{currentTimeStr || '06,10910,7,023'}</span>
          </div>
          <span className="text-[8px] font-mono text-slate-400">Active Patrol Time</span>
        </div>

        {/* 4. Action Trigger Buttons Panel */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase border-b border-[#00f2fe]/10 pb-1">PINGTILAS AIMAS</span>
          <div className="grid grid-cols-2 gap-2 my-2">
            <button className="bg-[#00f2fe]/20 border border-[#00f2fe]/40 text-[#00f2fe] text-[9px] font-mono font-bold p-2 rounded hover:bg-[#00f2fe]/30 transition">
              View Cam
            </button>
            <button className="bg-[#00f2fe]/20 border border-[#00f2fe]/40 text-[#00f2fe] text-[9px] font-mono font-bold p-2 rounded hover:bg-[#00f2fe]/30 transition">
              Export Rep
            </button>
          </div>
          <button className="w-full bg-[#00f2fe] text-black text-[9px] font-mono font-bold py-1 rounded hover:bg-[#00d2ff] transition">
            User Cam Active
          </button>
        </div>

        {/* 5. Quick Dispatch / Alert Input */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase border-b border-[#00f2fe]/10 pb-1">RAW ARNT</span>
          <div className="flex flex-col gap-1.5 my-2">
            <input 
              type="text" 
              placeholder="Insert Alert Note..." 
              className="bg-[#0b141c] border border-[#00f2fe]/20 rounded p-1.5 text-[10px] text-white font-mono focus:outline-none focus:border-[#00f2fe]"
            />
            <button className="bg-[#00f2fe] text-black text-[10px] font-mono font-bold py-1 rounded flex items-center justify-center gap-1">
              <Check className="w-3 h-3" />
              <span>Log in Sport</span>
            </button>
          </div>
        </div>

        {/* 6. Global Site Radar Map Widget */}
        <div className="cyber-panel p-3.5 rounded-xl border border-[#00f2fe]/15 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#00f2fe]/10 pb-1">
            <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">PINGTILAS AIMAS</span>
            <Globe className="w-3.5 h-3.5 text-[#00f2fe]" />
          </div>

          <div className="bg-[#0b141c] p-2 rounded border border-[#00f2fe]/10 flex flex-col gap-1 my-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-slate-300">Sucneer</span>
              <span className="text-[#00f2fe] font-bold">240,000</span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-slate-300">Cervce</span>
              <span className="text-[#00f2fe] font-bold">106,000</span>
            </div>
          </div>
          <span className="text-[8px] font-mono text-slate-400">Global Site Node Network</span>
        </div>

      </div>

    </div>
  )
}

