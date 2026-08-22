import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { ShieldAlert, CheckCircle, Search, FileText, Camera, Volume2, FilePen } from 'lucide-react'

export default function CheckpointLog({ sharedScans }) {
  const [logs, setLogs] = useState(sharedScans)

  const [siteFilter, setSiteFilter] = useState('All')
  const [geofenceFilter, setGeofenceFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data: dbScans } = await supabase
          .from('checkpoint_scans')
          .select('id, scanned_at, within_geofence, client_generated_id, notes, photo_url, voice_note_url, checkpoints(name, routes(name, sites(name))), profiles(name)')
          .order('scanned_at', { ascending: false })

        if (dbScans) {
          const formatted = dbScans.map(s => ({
            id: s.id,
            site: s.checkpoints?.routes?.sites?.name || 'Main Depot',
            route: s.checkpoints?.routes?.name || 'Main Route',
            checkpoint: s.checkpoints?.name || 'Checkpoint',
            guard: s.profiles?.name || 'Guard',
            scanned_at: s.scanned_at,
            within_geofence: s.within_geofence,
            tag_code: s.client_generated_id?.substring(0, 8) || 'SYNCED',
            notes: s.notes || '',
            photo_url: s.photo_url || null,
            voice_note_url: s.voice_note_url || null
          }))
          
          // Merge local simulator logs and remote database logs
          const merged = [...sharedScans]
          formatted.forEach(f => {
            if (!merged.some(m => m.id === f.id)) {
              merged.push(f)
            }
          })
          setLogs(merged)
        } else {
          setLogs(sharedScans)
        }
      } catch (err) {
        setLogs(sharedScans)
      }
    }
    fetchLogs()
  }, [sharedScans])

  const filtered = logs.filter(log => {
    const matchesSite = siteFilter === 'All' || log.site === siteFilter
    const matchesGeofence = geofenceFilter === 'All' || 
      (geofenceFilter === 'inside' && log.within_geofence) ||
      (geofenceFilter === 'outside' && !log.within_geofence)
    const matchesSearch = log.guard.toLowerCase().includes(search.toLowerCase()) ||
      log.checkpoint.toLowerCase().includes(search.toLowerCase()) ||
      log.tag_code.toLowerCase().includes(search.toLowerCase()) ||
      (log.notes && log.notes.toLowerCase().includes(search.toLowerCase()))

    return matchesSite && matchesGeofence && matchesSearch
  })

  const handleExport = () => {
    const headers = ['Scan ID', 'Site', 'Route', 'Checkpoint', 'Guard', 'Scanned At', 'Geofence Validated', 'Tag Code', 'Notes']
    const rows = filtered.map(l => [
      l.id,
      `"${(l.site || '').replace(/"/g, '""')}"`,
      `"${(l.route || '').replace(/"/g, '""')}"`,
      `"${(l.checkpoint || '').replace(/"/g, '""')}"`,
      `"${(l.guard || '').replace(/"/g, '""')}"`,
      l.scanned_at || '',
      l.within_geofence ? 'YES' : 'BREACH',
      l.tag_code || '',
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PatrolIQ_Checkpoint_Logs_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50">
        <h2 className="font-heading text-lg font-bold text-white">Checkpoint Patrol Log Reports</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-all font-mono cursor-pointer"
            title="Export Patrol Log CSV"
          >
            <FileText className="w-3.5 h-3.5 text-[#3DDCC5]" />
            <span>EXPORT CSV SPREADSHEET</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-8 flex-grow flex flex-col gap-6 overflow-y-auto">
        {/* Filters */}
        <div className="bg-[#12181A] border border-white/5 p-5 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 font-mono">SITE DIVISION</label>
              <select
                value={siteFilter}
                onChange={e => setSiteFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
              >
                <option value="All">All Divisions</option>
                <option value="Main Mining Depot">Main Mining Depot</option>
                <option value="Washing Plant Area">Washing Plant Area</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 font-mono">GEOFENCE STATUS</label>
              <select
                value={geofenceFilter}
                onChange={e => setGeofenceFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="inside">Within Geofence</option>
                <option value="outside">Breach (Outside Geofence)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 font-mono">SEARCH KEYWORD</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  placeholder="Type to search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          <span className="text-[10px] text-white/40 font-mono mt-auto">MATCHED RECORD COUNT: {filtered.length}</span>
        </div>

        {/* Logs Desktop Table */}
        <div className="hidden md:block bg-[#12181A] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20 text-[10px] text-white/45 font-mono uppercase tracking-wider">
                <th className="p-4 pl-6">Guard</th>
                <th className="p-4">Checkpoint Node</th>
                <th className="p-4">Scan Time</th>
                <th className="p-4 w-[280px]">Report Details</th>
                <th className="p-4">Media Attachments</th>
                <th className="p-4">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono text-white/80">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.01] items-center">
                  <td className="p-4 pl-6 font-bold text-white">
                    <div className="flex flex-col">
                      <span>{log.guard}</span>
                      <span className="text-[9px] text-white/40 font-mono tracking-tight font-normal">
                        {log.site}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white/90">{log.checkpoint}</span>
                      <span className="text-[9px] text-[#3DDCC5] font-mono font-medium">TAG: {log.tag_code}</span>
                    </div>
                  </td>
                  <td className="p-4 text-white/45">
                    {new Date(log.scanned_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                    })}
                  </td>
                  <td className="p-4 max-w-[280px] break-words text-white/77 leading-relaxed font-sans text-[11px]">
                    {log.notes ? (
                      <div className="flex items-start gap-1.5">
                        <FilePen className="w-3.5 h-3.5 text-[#3DDCC5] shrink-0 mt-0.5" />
                        <span>{log.notes}</span>
                      </div>
                    ) : (
                      <span className="text-white/20 italic">No notes reported.</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {log.photo_url ? (
                        <button
                          onClick={() => setPreviewImage(log.photo_url)}
                          className="relative w-12 h-12 rounded border border-white/10 overflow-hidden hover:scale-105 transition-transform"
                        >
                          <img src={log.photo_url} alt="Attached patrol report" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Camera className="w-3 h-3 text-white" />
                          </div>
                        </button>
                      ) : null}
                      {log.voice_note_url ? (
                        <div className="flex items-center gap-1 bg-black/40 border border-white/5 px-2 py-1 rounded">
                          <Volume2 className="w-3.5 h-3.5 text-[#3DDCC5] shrink-0" />
                          <audio
                            src={log.voice_note_url}
                            controls
                            className="h-6 w-40 text-xs focus:outline-none opacity-85"
                            style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                          />
                        </div>
                      ) : null}
                      {!log.photo_url && !log.voice_note_url ? (
                        <span className="text-white/20 italic">No media.</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4 pr-6">
                    {log.within_geofence ? (
                      <div className="flex items-center gap-1.5 text-[#3DDCC5] bg-[#3DDCC5]/10 px-2 py-0.5 rounded w-max text-[10px] font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        VALIDATED
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#E8A33D] bg-[#E8A33D]/10 px-2 py-0.5 rounded w-max text-[10px] font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        BREACH
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-white/30 text-xs">
                    No checkpoint scan records match your filter query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Logs Mobile Cards List */}
        <div className="block md:hidden flex flex-col gap-4">
          {filtered.map(log => (
            <div key={log.id} className="bg-[#12181A] border border-white/5 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">{log.guard}</span>
                  <span className="text-[10px] text-white/40 font-mono">{log.site} • {log.route}</span>
                </div>
                <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${
                  log.within_geofence ? 'bg-[#3DDCC5]/10 text-[#3DDCC5]' : 'bg-[#E8A33D]/10 text-[#E8A33D]'
                }`}>
                  {log.within_geofence ? 'VALIDATED' : 'BREACH'}
                </span>
              </div>

              <div className="border-t border-white/5 pt-2.5 flex flex-col gap-1">
                <span className="text-[11px] text-white/70 font-semibold">{log.checkpoint}</span>
                <span className="text-[9px] text-[#3DDCC5] font-mono">TAG: {log.tag_code}</span>
                <span className="text-[9px] text-white/30 font-mono">
                  {new Date(log.scanned_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              {log.notes && (
                <p className="text-[11px] text-white/60 font-sans leading-relaxed bg-black/20 p-2.5 rounded border border-white/5">
                  "{log.notes}"
                </p>
              )}

              {(log.photo_url || log.voice_note_url) && (
                <div className="flex items-center gap-3 border-t border-white/5 pt-2">
                  {log.photo_url && (
                    <button
                      onClick={() => setPreviewImage(log.photo_url)}
                      className="w-12 h-12 rounded border border-white/10 overflow-hidden shrink-0"
                    >
                      <img src={log.photo_url} className="w-full h-full object-cover" alt="Attachment" />
                    </button>
                  )}
                  {log.voice_note_url && (
                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2 py-1 rounded flex-grow">
                      <Volume2 className="w-3.5 h-3.5 text-[#3DDCC5]" />
                      <audio
                        src={log.voice_note_url}
                        controls
                        className="h-6 w-full text-xs focus:outline-none"
                        style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-white/30 text-xs py-8">
              No checkpoint scans match filters.
            </div>
          )}
        </div>
      </main>

      {/* Image Preview Overlay Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[85vh] border border-white/10 rounded-lg overflow-hidden">
            <img src={previewImage} alt="Expanded patrol attachment" className="max-w-full max-h-[80vh] object-contain block" />
            <div className="bg-[#12181A] px-4 py-2 text-center text-xs text-white/60 font-mono border-t border-white/5">
              Click anywhere to close preview
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
