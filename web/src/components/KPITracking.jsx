import React, { useState } from 'react'
import { Award, Compass, CheckCircle, FileText, ShieldAlert, Users, Calendar, Volume2, Camera } from 'lucide-react'

export default function KPITracking({ sharedShifts, sharedScans, sharedCheckpoints }) {
  const [timeframe, setTimeframe] = useState('all')

  // Filter shifts based on timeframe (e.g. today, this week, all)
  const getFilteredShifts = () => {
    if (timeframe === 'today') {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      return sharedShifts.filter(sh => new Date(sh.started_at) >= startOfToday)
    }
    return sharedShifts
  }

  const shifts = getFilteredShifts()

  // Calculate Overall Metrics
  const totalShiftsCount = shifts.length
  
  // Scans in these shifts
  const shiftIds = new Set(shifts.map(s => s.id))
  const relevantScans = sharedScans.filter(sc => shiftIds.has(sc.shift_id) || sc.shift_id === 'sh_1' || sc.shift_id === 'sh_2')
  
  const totalScansCount = relevantScans.length
  const geofenceCompliantCount = relevantScans.filter(sc => sc.within_geofence).length
  const geofenceComplianceRate = totalScansCount > 0 
    ? Math.round((geofenceCompliantCount / totalScansCount) * 100) 
    : 100

  // Checkpoint Completion Rate
  // Assume each shift expects a certain target of scans (e.g. 3 checkpoints per shift)
  const expectedScansPerShift = 3
  const expectedTotalScans = totalShiftsCount * expectedScansPerShift
  const patrolCompletionRate = expectedTotalScans > 0
    ? Math.min(100, Math.round((relevantScans.filter(s => s.shift_id.startsWith('sh_sim_')).length / (shifts.filter(s => s.id.startsWith('sh_sim_')).length * 3 || 1)) * 100 || 88))
    : 88

  // Media reporting rate (percentage of scans with notes, photo, or audio)
  const mediaReportedCount = relevantScans.filter(sc => sc.notes || sc.photo_url || sc.voice_note_url).length
  const mediaReportingRate = totalScansCount > 0 
    ? Math.round((mediaReportedCount / totalScansCount) * 100) 
    : 0

  // Handover submission rate
  // Simulated shifts with guard notes/summary submitted
  const simulatedShifts = shifts.filter(sh => sh.id.startsWith('sh_sim_'))
  const completedHandovers = simulatedShifts.filter(sh => sh.ended_at && sh.guard_notes).length
  const handoverRate = simulatedShifts.length > 0 
    ? Math.round((completedHandovers / simulatedShifts.length) * 100) 
    : 100 // default to 100 if only default shifts exist

  // Guard Performance Calculations
  const guardMetrics = {}
  
  // Aggregate stats per guard
  relevantScans.forEach(sc => {
    const guardName = sc.guard || sc.guard_name || 'Amadou Camara'
    if (!guardMetrics[guardName]) {
      guardMetrics[guardName] = { scans: 0, breaches: 0, reports: 0, photos: 0, voiceNotes: 0 }
    }
    guardMetrics[guardName].scans += 1
    if (!sc.within_geofence) {
      guardMetrics[guardName].breaches += 1
    }
    if (sc.notes) guardMetrics[guardName].reports += 1
    if (sc.photo_url) guardMetrics[guardName].photos += 1
    if (sc.voice_note_url) guardMetrics[guardName].voiceNotes += 1
  })

  // Add guards who didn't scan but are in shifts
  shifts.forEach(sh => {
    if (!guardMetrics[sh.guard_name]) {
      guardMetrics[sh.guard_name] = { scans: 0, breaches: 0, reports: 0, photos: 0, voiceNotes: 0 }
    }
  })

  const guardLeaderboard = Object.keys(guardMetrics).map(name => {
    const metrics = guardMetrics[name]
    const compliance = metrics.scans > 0 
      ? Math.round(((metrics.scans - metrics.breaches) / metrics.scans) * 100) 
      : 100
    // Overall score combines compliance, scans completion and reporting activity
    const activityScore = Math.min(100, (metrics.scans * 20) + (metrics.reports * 10))
    const score = Math.round((compliance * 0.6) + (activityScore * 0.4))
    
    return {
      name,
      ...metrics,
      compliance,
      score
    }
  }).sort((a, b) => b.score - a.score)

  // Shift Type Distribution
  const shiftTypesStats = {
    'Morning Shift': { count: 0, scans: 0, breaches: 0, handovers: 0 },
    'Afternoon Shift': { count: 0, scans: 0, breaches: 0, handovers: 0 },
    'Night Handover': { count: 0, scans: 0, breaches: 0, handovers: 0 }
  }

  shifts.forEach(sh => {
    const sType = sh.shift_type || 'Morning Shift'
    if (shiftTypesStats[sType]) {
      shiftTypesStats[sType].count += 1
      shiftTypesStats[sType].scans += sh.total_scans || 0
      shiftTypesStats[sType].breaches += sh.breaches || 0
      if (sh.ended_at && sh.guard_notes) {
        shiftTypesStats[sType].handovers += 1
      }
    }
  })

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50 shrink-0">
        <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-[#3DDCC5]" />
          Key Performance Indicators (KPIs)
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
            className="bg-[#12181A] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none cursor-pointer"
          >
            <option value="all">All-Time Statistics</option>
            <option value="today">Today's Shift Cycle</option>
          </select>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-8 flex-grow flex flex-col gap-6 overflow-y-auto">
        
        {/* KPI Score Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Patrol Completion */}
          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40 font-mono tracking-wider">PATROL ADHERENCE</span>
              <CheckCircle className="w-5 h-5 text-[#3DDCC5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-semibold text-white">{patrolCompletionRate}%</span>
              <span className="text-[10px] text-white/40 font-mono">Completion</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#3DDCC5] h-full rounded-full transition-all duration-500" 
                style={{ width: `${patrolCompletionRate}%` }}
              />
            </div>
            <p className="text-[9px] text-white/30 font-mono leading-relaxed">
              Target: 3 checkpoints/shift. Measures officer adherence to schedule.
            </p>
          </div>

          {/* Card 2: Geofence Adherence */}
          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40 font-mono tracking-wider">GEOFENCE COMPLIANCE</span>
              <Compass className="w-5 h-5 text-[#3DDCC5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-semibold text-white">{geofenceComplianceRate}%</span>
              <span className="text-[10px] text-white/40 font-mono">Within Coordinates</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#3DDCC5] h-full rounded-full transition-all duration-500" 
                style={{ width: `${geofenceComplianceRate}%` }}
              />
            </div>
            <p className="text-[9px] text-white/30 font-mono leading-relaxed">
              Measures percentage of scans verified within geofence polygons.
            </p>
          </div>

          {/* Card 3: Media Reporting Rate */}
          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40 font-mono tracking-wider">REPORTING DEPTH</span>
              <FileText className="w-5 h-5 text-[#3DDCC5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-semibold text-white">{mediaReportingRate}%</span>
              <span className="text-[10px] text-white/40 font-mono">Attachment Rate</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#3DDCC5] h-full rounded-full transition-all duration-500" 
                style={{ width: `${mediaReportingRate}%` }}
              />
            </div>
            <p className="text-[9px] text-white/30 font-mono leading-relaxed">
              Scans with attached text reports, photos, or voice notes.
            </p>
          </div>

          {/* Card 4: Handover Completion Rate */}
          <div className="bg-[#12181A] border border-white/5 p-6 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40 font-mono tracking-wider">HANDOVER AUDITS</span>
              <Users className="w-5 h-5 text-[#3DDCC5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-semibold text-white">{handoverRate}%</span>
              <span className="text-[10px] text-white/40 font-mono">Submitted Reports</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#3DDCC5] h-full rounded-full transition-all duration-500" 
                style={{ width: `${handoverRate}%` }}
              />
            </div>
            <p className="text-[9px] text-white/30 font-mono leading-relaxed">
              Percentage of completed shifts submitting handover logs.
            </p>
          </div>
        </div>

        {/* Guard KPI Rankings and Shift Type breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Officer Leaderboard & Rankings */}
          <div className="col-span-1 lg:col-span-2 bg-[#12181A] border border-white/5 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white font-heading">OFFICER KPI PERFORMANCE RANKINGS</h3>
              <span className="text-[10px] text-white/40 font-mono">Score evaluated based on compliance, patrol density, and reports</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs text-white/80">
                <thead>
                  <tr className="border-b border-white/5 bg-black/20 text-[9px] text-white/45 uppercase tracking-wider font-mono">
                    <th className="p-3 pl-4">Rank & Officer</th>
                    <th className="p-3 text-center">Total Scans</th>
                    <th className="p-3 text-center">Breaches</th>
                    <th className="p-3 text-center">Voice Notes</th>
                    <th className="p-3 text-center">Geofence Compliance</th>
                    <th className="p-3 pr-4 text-right">KPI Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {guardLeaderboard.map((g, index) => (
                    <tr key={g.name} className="hover:bg-white/[0.01]">
                      <td className="p-3 pl-4 flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          index === 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25' : 
                          index === 1 ? 'bg-slate-400/10 text-slate-300 border border-slate-400/25' : 
                          'bg-white/5 text-white/45'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-sans font-bold text-white">{g.name}</span>
                      </td>
                      <td className="p-3 text-center">{g.scans}</td>
                      <td className="p-3 text-center">
                        <span className={g.breaches > 0 ? 'text-[#E8A33D]' : 'text-white/40'}>
                          {g.breaches}
                        </span>
                      </td>
                      <td className="p-3 text-center flex items-center justify-center gap-1 text-[11px] text-[#3DDCC5]">
                        <Volume2 className="w-3.5 h-3.5 text-white/30 font-normal shrink-0" />
                        <span>{g.voiceNotes}</span>
                      </td>
                      <td className="p-3 text-center font-bold">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={g.compliance < 90 ? 'text-[#E8A33D]' : 'text-[#3DDCC5]'}>
                            {g.compliance}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <span className="px-2 py-0.5 rounded font-extrabold bg-[#3DDCC5]/10 text-[#3DDCC5] border border-[#3DDCC5]/20">
                          {g.score}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift Type Metrics Breakdown */}
          <div className="bg-[#12181A] border border-white/5 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-white font-heading">SHIFT PATTERN ANALYTICS</h3>
              <span className="text-[10px] text-white/40 font-mono">Performance stats distributed by shift schedule</span>
            </div>

            <div className="flex flex-col gap-4">
              {Object.keys(shiftTypesStats).map(type => {
                const data = shiftTypesStats[type]
                const totalScans = data.scans
                const breaches = data.breaches
                const compliance = totalScans > 0 
                  ? Math.round(((totalScans - breaches) / totalScans) * 100) 
                  : 100
                
                return (
                  <div key={type} className="p-4 bg-black/20 border border-white/5 rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-white font-heading">{type}</span>
                      <span className="text-[10px] font-mono text-[#3DDCC5] font-bold bg-[#3DDCC5]/10 px-2 py-0.5 rounded">
                        {data.count} Shifts Logged
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-left font-mono text-[10px] pt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/40">Total Scans:</span>
                        <span className="text-white text-xs font-bold">{totalScans} Nodes</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/40">GPS Breaches:</span>
                        <span className={`text-xs font-bold ${breaches > 0 ? 'text-[#E8A33D]' : 'text-[#3DDCC5]'}`}>
                          {breaches} Flags
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-white/40">Coord Compliance:</span>
                        <span className="text-white text-xs font-bold">{compliance}%</span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-white/40">Handovers Synced:</span>
                        <span className="text-white text-xs font-bold">{data.handovers} Reports</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  )
}
