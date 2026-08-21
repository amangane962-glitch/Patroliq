import React, { useState } from 'react'
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Search, Filter, Camera, Mic, MapPin, User, ChevronRight, Check } from 'lucide-react'

export default function Incidents({ sharedIncidents, setSharedIncidents }) {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState(null)

  const handleUpdateStatus = (incidentId, newStatus) => {
    setSharedIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return { ...inc, status: newStatus }
      }
      return inc
    }))
    if (selectedIncident && selectedIncident.id === incidentId) {
      setSelectedIncident(prev => ({ ...prev, status: newStatus }))
    }
  }

  const filteredIncidents = sharedIncidents.filter(inc => {
    const matchesSearch = (inc.title || '').toLowerCase().includes(search.toLowerCase()) ||
                          (inc.site || '').toLowerCase().includes(search.toLowerCase()) ||
                          (inc.reported_by || '').toLowerCase().includes(search.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter
    return matchesSearch && matchesSeverity && matchesStatus
  })

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-[#3DDCC5]/10 text-[#3DDCC5] border-[#3DDCC5]/20'
      case 'under_investigation':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'open':
      default:
        return 'bg-red-500/10 text-red-400 border-red-500/20'
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6 overflow-y-auto h-full bg-[#0B0F0E] text-slate-100 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold font-heading text-white">Security Incidents</h2>
          </div>
          <p className="text-xs text-white/50 mt-1">Real-time incident reporting, photo/voice evidence, and supervisor investigation log.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-bold flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>OPEN INCIDENTS: {sharedIncidents.filter(i => i.status === 'open').length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12181A] p-4 rounded-xl border border-white/5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search by title, site, or reporting Guard..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0F0E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#3DDCC5]"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/50 font-mono">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <span>SEVERITY:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#0B0F0E] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value="all">ALL SEVERITIES</option>
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-white/50 font-mono">
            <span>STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B0F0E] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value="all">ALL STATUSES</option>
              <option value="open">OPEN</option>
              <option value="under_investigation">INVESTIGATING</option>
              <option value="resolved">RESOLVED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incidents List Column */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {filteredIncidents.length === 0 ? (
            <div className="bg-[#12181A] border border-white/5 rounded-xl p-12 text-center text-white/40">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-white/20" />
              <p className="text-sm font-medium">No incident records found.</p>
              <p className="text-xs text-white/30 mt-1">Guards can report incidents directly from their mobile patrol app.</p>
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`bg-[#12181A] border rounded-xl p-4 transition-all duration-200 cursor-pointer hover:border-white/20 ${
                  selectedIncident?.id === inc.id ? 'border-[#3DDCC5] bg-[#12181A]/90' : 'border-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase block">{inc.category.replace('_', ' ')}</span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{inc.title}</h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${getSeverityBadge(inc.severity)}`}>
                      {inc.severity}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${getStatusBadge(inc.status)}`}>
                      {inc.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white/70 line-clamp-2 mb-3">{inc.description}</p>

                <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-[#3DDCC5]" />
                      <span className="text-white/80">{inc.reported_by}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-white/40" />
                      <span>{inc.site}</span>
                    </span>
                  </div>

                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-white/30" />
                    <span>{new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Incident Detail Pane */}
        <div className="bg-[#12181A] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          {selectedIncident ? (
            <div className="flex flex-col gap-4">
              <div className="border-b border-white/5 pb-3">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">INCIDENT DETAILS</span>
                <h3 className="text-base font-bold text-white mt-1">{selectedIncident.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${getSeverityBadge(selectedIncident.severity)}`}>
                    {selectedIncident.severity}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${getStatusBadge(selectedIncident.status)}`}>
                    {selectedIncident.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-white/40 font-mono block text-[10px]">SITE LOCATION</span>
                  <span className="text-white font-medium">{selectedIncident.site}</span>
                </div>
                <div>
                  <span className="text-white/40 font-mono block text-[10px]">REPORTING GUARD</span>
                  <span className="text-white font-medium">{selectedIncident.reported_by}</span>
                </div>
                <div>
                  <span className="text-white/40 font-mono block text-[10px]">TIME REPORTED</span>
                  <span className="text-white/80 font-mono">{new Date(selectedIncident.reported_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#0B0F0E] p-3 rounded-lg border border-white/5">
                <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">GUARD DESCRIPTION</span>
                <p className="text-xs text-white/80 leading-relaxed">{selectedIncident.description}</p>
              </div>

              {/* Photo Evidence */}
              {selectedIncident.photo_url && (
                <div>
                  <span className="text-[10px] font-mono text-white/40 uppercase block mb-1 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-[#3DDCC5]" />
                    PHOTO EVIDENCE
                  </span>
                  <img
                    src={selectedIncident.photo_url}
                    alt="Incident evidence"
                    className="w-full h-40 object-cover rounded-lg border border-white/10"
                  />
                </div>
              )}

              {/* Voice Memo Evidence */}
              {selectedIncident.voice_note_url && (
                <div>
                  <span className="text-[10px] font-mono text-white/40 uppercase block mb-1 flex items-center gap-1">
                    <Mic className="w-3 h-3 text-[#3DDCC5]" />
                    VOICE MEMO RECORDING
                  </span>
                  <audio controls src={selectedIncident.voice_note_url} className="w-full h-8 rounded" />
                </div>
              )}

              {/* Supervisor Actions */}
              <div className="pt-4 border-t border-white/5">
                <span className="text-[10px] font-mono text-white/40 uppercase block mb-2">SUPERVISOR ACTION</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.id, 'under_investigation')}
                    className="flex-1 py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium font-mono transition-all"
                  >
                    INVESTIGATE
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.id, 'resolved')}
                    className="flex-1 py-2 px-3 bg-[#3DDCC5]/10 hover:bg-[#3DDCC5]/20 text-[#3DDCC5] border border-[#3DDCC5]/30 rounded-lg text-xs font-medium font-mono transition-all"
                  >
                    MARK RESOLVED
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
              <ShieldAlert className="w-12 h-12 mb-3 text-white/10" />
              <p className="text-xs font-medium">Select an incident from the list to view detailed evidence and supervisor status actions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
