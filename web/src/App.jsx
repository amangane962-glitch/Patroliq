import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import { Menu } from 'lucide-react'
import LiveOverview from './components/LiveOverview'
import SitesAndRoutes from './components/SitesAndRoutes'
import Checkpoints from './components/Checkpoints'
import CheckpointLog from './components/CheckpointLog'
import UsersAndRoles from './components/UsersAndRoles'
import ShiftReports from './components/ShiftReports'
import MobileSimulator from './components/MobileSimulator'
import DeviceCapabilityScreen from './components/DeviceCapabilityScreen'
import KPITracking from './components/KPITracking'
import Incidents from './components/Incidents'
import AuditTrail from './components/AuditTrail'
import { extractTagCode } from './services/qrScannerService'

const DEFAULT_CHECKPOINTS = [
  { id: 'c1', name: 'North Gate Perimeter', tag_code: 'QR-N483', site: 'Main Mining Depot', route: 'Perimeter West A', latitude: -12.9841, longitude: 28.6412, geofence_radius_meters: 15.0 },
  { id: 'c2', name: 'Fuel Depot Storage', tag_code: 'NFC-F239', site: 'Main Mining Depot', route: 'Perimeter West A', latitude: -12.9845, longitude: 28.6418, geofence_radius_meters: 15.0 },
  { id: 'c3', name: 'Primary Crusher Point', tag_code: 'QR-P102', site: 'Washing Plant Area', route: 'Crusher Route B', latitude: -12.9850, longitude: 28.6425, geofence_radius_meters: 20.0 },
  { id: 'c4', name: 'Explosives Vault Entrance', tag_code: 'QR-X901', site: 'Main Mining Depot', route: 'Fuel Vault Check', latitude: -12.9839, longitude: 28.6409, geofence_radius_meters: 15.0 }
]

const DEFAULT_USERS = [
  { id: 'u1', name: 'Amadou Camara', email: 'amadou@grizzly.com', role: 'guard', is_active: true, pass: 'PatrolIQ#101' },
  { id: 'u2', name: 'Regan Nguluta', email: 'regan@grizzly.com', role: 'guard', is_active: true, pass: 'PatrolIQ#102' },
  { id: 'u3', name: 'Bentley Chafe', email: 'bentley@grizzly.com', role: 'supervisor', is_active: true, pass: 'PatrolIQ#103' },
  { id: 'u4', name: 'John Doe', email: 'admin@grizzly.com', role: 'admin', is_active: true, pass: 'PatrolIQ#104' }
]

const DEFAULT_SHIFTS = [
  {
    id: 'sh_1',
    guard_name: 'Amadou Camara',
    site_name: 'Main Mining Depot',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    guard_notes: 'All checkpoints scanned successfully. The perimeter is secure. Observed slight wear on gate lock 3.',
    total_scans: 3,
    breaches: 0,
    report: {
      id: 'rep_1',
      summary_notes: 'Excellent coverage. Confirmed gate lock 3 wear, logged with maintenance.',
      rating: 5
    }
  },
  {
    id: 'sh_2',
    guard_name: 'Regan Nguluta',
    site_name: 'Main Mining Depot',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    ended_at: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    guard_notes: 'Conducted regular patrols. Scanned fuel depot. Scanner coordinate issues near vault.',
    total_scans: 3,
    breaches: 1,
    report: null
  }
]

const DEFAULT_INCIDENTS = [
  {
    id: 'inc_1',
    site: 'Main Mining Depot',
    reported_by: 'Regan Nguluta',
    category: 'equipment_failure',
    title: 'Fuel Vault Pressure Valve Leak',
    description: 'Minor hydraulic seal leak detected at storage tank 4 during night patrol check.',
    severity: 'high',
    status: 'under_investigation',
    reported_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    photo_url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop',
    voice_note_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: 'inc_2',
    site: 'Washing Plant Area',
    reported_by: 'Amadou Camara',
    category: 'damaged_infrastructure',
    title: 'Fence Mesh Wear at Section West 3',
    description: 'Lower chain link damaged near drainage channel. Perimeter line flagged for maintenance.',
    severity: 'medium',
    status: 'open',
    reported_at: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    photo_url: null,
    voice_note_url: null
  }
]

const DEFAULT_AUDIT_LOGS = [
  {
    id: 'aud_1',
    user: 'Amadou Camara',
    role: 'guard',
    action: 'SHIFT_START',
    details: 'Initiated active duty shift at Main Mining Depot',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    ip_address: 'Android Device (172.16.2.14)'
  },
  {
    id: 'aud_2',
    user: 'Amadou Camara',
    role: 'guard',
    action: 'CHECKPOINT_SCAN',
    details: 'Scanned North Gate Perimeter (QR-N483). Location verified inside geofence.',
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    ip_address: 'Android Device (172.16.2.14)'
  },
  {
    id: 'aud_3',
    user: 'Regan Nguluta',
    role: 'guard',
    action: 'INCIDENT_REPORTED',
    details: 'Logged high severity incident: Fuel Vault Pressure Valve Leak',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    ip_address: 'iOS Mobile Safari (172.16.2.88)'
  },
  {
    id: 'aud_4',
    user: 'Bentley Chafe',
    role: 'supervisor',
    action: 'SHIFT_REVIEW',
    details: 'Submitted rating 5/5 for shift sh_1 (Amadou Camara)',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    ip_address: 'Supervisor Command (172.16.2.123)'
  }
]

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeShiftSite, setActiveShiftSite] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [initialScanCode, setInitialScanCode] = useState(null)

  // Shared Persistent Checkpoints State with LocalStorage Sync
  const [checkpoints, setCheckpoints] = useState(() => {
    try {
      const saved = localStorage.getItem('patroliq_checkpoints')
      return saved ? JSON.parse(saved) : DEFAULT_CHECKPOINTS
    } catch (e) {
      return DEFAULT_CHECKPOINTS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('patroliq_checkpoints', JSON.stringify(checkpoints))
    } catch (e) {}
  }, [checkpoints])
  
  // Shared Persistent Users State with LocalStorage Sync
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('patroliq_users')
      return saved ? JSON.parse(saved) : DEFAULT_USERS
    } catch (e) {
      return DEFAULT_USERS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('patroliq_users', JSON.stringify(users))
    } catch (e) {}
  }, [users])

  // Shared Persistent Shifts & Reports State with LocalStorage Sync
  const [shifts, setShifts] = useState(() => {
    try {
      const saved = localStorage.getItem('patroliq_shifts')
      return saved ? JSON.parse(saved) : DEFAULT_SHIFTS
    } catch (e) {
      return DEFAULT_SHIFTS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('patroliq_shifts', JSON.stringify(shifts))
    } catch (e) {}
  }, [shifts])

  // Shared Incidents State
  const [incidents, setIncidents] = useState(() => {
    try {
      const saved = localStorage.getItem('patroliq_incidents')
      return saved ? JSON.parse(saved) : DEFAULT_INCIDENTS
    } catch (e) {
      return DEFAULT_INCIDENTS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('patroliq_incidents', JSON.stringify(incidents))
    } catch (e) {}
  }, [incidents])

  // Shared Audit Logs State
  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('patroliq_audit_logs')
      return saved ? JSON.parse(saved) : DEFAULT_AUDIT_LOGS
    } catch (e) {
      return DEFAULT_AUDIT_LOGS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('patroliq_audit_logs', JSON.stringify(auditLogs))
    } catch (e) {}
  }, [auditLogs])

  // Auto-detect when phone scans QR Code from camera URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const scanCode = params.get('scan')
    const connectMode = params.get('connect')
    
    if (scanCode) {
      const clean = extractTagCode(scanCode)
      setInitialScanCode(clean)
      setActiveTab('simulator')
      setActiveShiftSite('Main Mining Depot')
    } else if (connectMode) {
      setActiveTab('simulator')
    }
  }, [])
  
  // Shared Scans Log State
  const [scans, setScans] = useState([
    {
      id: '1',
      site: 'Main Mining Depot',
      route: 'Perimeter West A',
      checkpoint: 'North Gate Perimeter',
      guard: 'Amadou Camara',
      scanned_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      within_geofence: true,
      tag_code: 'QR-N483',
      notes: 'All perimeters locked. Area secure.',
      photo_url: null,
      voice_note_url: null
    },
    {
      id: '2',
      site: 'Main Mining Depot',
      route: 'Perimeter West A',
      checkpoint: 'Fuel Depot Storage',
      guard: 'Regan Nguluta',
      scanned_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      within_geofence: false,
      tag_code: 'NFC-F239',
      notes: 'Scan triggered out of fence radius due to poor GPS calibration. Fuel vault is locked.',
      photo_url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop',
      voice_note_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    },
    {
      id: '3',
      site: 'Washing Plant Area',
      route: 'Crusher Route B',
      checkpoint: 'Primary Crusher Point',
      guard: 'Bentley Chafe',
      scanned_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      within_geofence: true,
      tag_code: 'QR-P102',
      notes: 'Crusher unit checked. Operational noise looks standard.',
      photo_url: null,
      voice_note_url: null
    }
  ])

  // Callbacks from Mobile Simulator
  const handleStartShift = (siteName, officerName, shiftType) => {
    setActiveShiftSite(siteName)
    const newShift = {
      id: 'sh_sim_' + Date.now(),
      guard_name: officerName || 'Amadou Camara',
      site_name: siteName,
      shift_type: shiftType || 'Morning Shift',
      started_at: new Date().toISOString(),
      ended_at: null,
      guard_notes: '',
      total_scans: 0,
      breaches: 0,
      report: null
    }
    setShifts(prev => [newShift, ...prev])

    const newAudit = {
      id: 'aud_' + Date.now(),
      user: officerName || 'Amadou Camara',
      role: 'guard',
      action: 'SHIFT_START',
      details: `Started shift at ${siteName}`,
      created_at: new Date().toISOString(),
      ip_address: 'Mobile Device PWA'
    }
    setAuditLogs(prev => [newAudit, ...prev])
  }

  const handleEndShift = (handoverNotes, handoverPhoto, handoverVoiceNote) => {
    setActiveShiftSite(null)
    setShifts(prev => prev.map(sh => {
      if (sh.id.startsWith('sh_sim_') && sh.ended_at === null) {
        const shiftScans = scans.filter(s => s.shift_id === sh.id)
        const breaches = shiftScans.filter(s => !s.within_geofence).length
        return {
          ...sh,
          ended_at: new Date().toISOString(),
          guard_notes: handoverNotes || 'Patrol shift wrapped up. Checkpoints verified.',
          guard_photo_url: handoverPhoto || null,
          guard_voice_note_url: handoverVoiceNote || null,
          total_scans: shiftScans.length,
          breaches: breaches
        }
      }
      return sh
    }))

    const newAudit = {
      id: 'aud_' + Date.now(),
      user: 'Amadou Camara',
      role: 'guard',
      action: 'SHIFT_END',
      details: 'Completed shift and submitted shift notes.',
      created_at: new Date().toISOString(),
      ip_address: 'Mobile Device PWA'
    }
    setAuditLogs(prev => [newAudit, ...prev])
  }

  const handleAddScan = (scanData) => {
    const activeSimShift = shifts.find(sh => sh.id.startsWith('sh_sim_') && sh.ended_at === null)
    const shiftId = activeSimShift ? activeSimShift.id : 'sh_1'
    const officerName = scanData.officer_name || (activeSimShift ? activeSimShift.guard_name : 'Amadou Camara')

    const newScan = {
      id: scanData.client_generated_id || ('sc_sim_' + Date.now()),
      site: activeSimShift ? activeSimShift.site_name : 'Main Mining Depot',
      route: 'Patrol Route A',
      checkpoint: scanData.checkpoint_name,
      guard: officerName,
      scanned_at: scanData.scanned_at,
      within_geofence: scanData.within_geofence,
      tag_code: scanData.tag_code,
      notes: scanData.notes,
      photo_url: scanData.photo_url,
      voice_note_url: scanData.voice_note_url,
      shift_id: shiftId
    }

    setScans(prev => [newScan, ...prev])

    const newAudit = {
      id: 'aud_' + Date.now(),
      user: officerName,
      role: 'guard',
      action: 'CHECKPOINT_SCAN',
      details: `Scanned ${scanData.checkpoint_name} (${scanData.tag_code}) - ${scanData.within_geofence ? 'Geofence Validated' : 'GEOFENCE BREACH'}`,
      created_at: new Date().toISOString(),
      ip_address: 'Mobile Device PWA'
    }
    setAuditLogs(prev => [newAudit, ...prev])

    if (activeSimShift) {
      setShifts(prev => prev.map(sh => {
        if (sh.id === activeSimShift.id) {
          return {
            ...sh,
            total_scans: sh.total_scans + 1,
            breaches: sh.breaches + (scanData.within_geofence ? 0 : 1)
          }
        }
        return sh
      }))
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <LiveOverview sharedScans={scans} sharedIncidents={incidents} />
      case 'sites':
        return <SitesAndRoutes />
      case 'checkpoints':
        return <Checkpoints checkpoints={checkpoints} setCheckpoints={setCheckpoints} />
      case 'log':
        return <CheckpointLog sharedScans={scans} />
      case 'incidents':
        return <Incidents sharedIncidents={incidents} setSharedIncidents={setIncidents} />
      case 'reports':
        return <ShiftReports sharedShifts={shifts} setSharedShifts={setShifts} sharedScans={scans} />
      case 'kpis':
        return <KPITracking sharedShifts={shifts} sharedScans={scans} sharedCheckpoints={checkpoints} />
      case 'audit':
        return <AuditTrail sharedAuditLogs={auditLogs} />
      case 'users':
        return <UsersAndRoles sharedUsers={users} setSharedUsers={setUsers} />
      case 'diagnostics':
        return <DeviceCapabilityScreen />
      case 'simulator':
        return (
          <MobileSimulator
            onAddScan={handleAddScan}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
            activeShift={activeShiftSite}
            initialScanCode={initialScanCode}
            sharedUsers={users}
            checkpoints={checkpoints}
          />
        )
      default:
        return <LiveOverview sharedScans={scans} sharedIncidents={incidents} />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F0E] text-[#E2E8F0] font-sans relative">
      {/* Sidebar navigation container */}
      <div 
        className={`fixed md:relative z-40 transition-transform duration-300 transform h-full shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onCloseMobile={() => setSidebarOpen(false)} />
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Mobile Header top bar */}
        <header className="h-14 border-b border-white/5 flex items-center px-4 bg-[#12181A] md:hidden shrink-0 justify-between">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-white hover:bg-white/5 rounded"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-white tracking-wide">PatrolIQ</span>
          <div className="w-8 h-8 rounded-full bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#3DDCC5] font-mono">OP</span>
          </div>
        </header>

        <div className="flex-grow overflow-hidden flex flex-col">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
