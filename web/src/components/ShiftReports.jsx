import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { FileText, Star, ShieldAlert, CheckCircle, Clock, Printer, Save, Calendar, User, Camera, Volume2, ArrowRight } from 'lucide-react'

export default function ShiftReports({ sharedShifts, setSharedShifts, sharedScans }) {
  const [shifts, setShifts] = useState(sharedShifts)

  const [activeShift, setActiveShift] = useState(null)
  const [activeShiftScans, setActiveShiftScans] = useState([])
  const [reportForm, setReportForm] = useState({ summary_notes: '', rating: 5 })
  const [isLoading, setIsLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    if (sharedShifts) {
      setShifts(sharedShifts)
    }
  }, [sharedShifts])

  // Load scans for the reviewed shift
  useEffect(() => {
    if (!activeShift) {
      setActiveShiftScans([])
      return
    }

    const loadScans = async () => {
      try {
        const { data: dbScans } = await supabase
          .from('checkpoint_scans')
          .select('id, scanned_at, within_geofence, notes, photo_url, voice_note_url, checkpoints(name, tag_code)')
          .eq('shift_id', activeShift.id)
          .order('scanned_at', { ascending: true })

        // Extract simulator/local scans for the active shift
        const localMatching = sharedScans
          .filter(s => s.shift_id === activeShift.id)
          .map(s => ({
            id: s.id,
            checkpoint_name: s.checkpoint || s.checkpoint_name,
            tag_code: s.tag_code,
            scanned_at: s.scanned_at,
            within_geofence: s.within_geofence,
            notes: s.notes || '',
            photo_url: s.photo_url || null,
            voice_note_url: s.voice_note_url || null
          }))

        const mergedScans = [...localMatching]
        
        if (dbScans && dbScans.length > 0) {
          dbScans.forEach(ds => {
            const mapped = {
              id: ds.id,
              checkpoint_name: ds.checkpoints?.name || 'Checkpoint',
              tag_code: ds.checkpoints?.tag_code || 'TAG',
              scanned_at: ds.scanned_at,
              within_geofence: ds.within_geofence,
              notes: ds.notes || '',
              photo_url: ds.photo_url || null,
              voice_note_url: ds.voice_note_url || null
            }
            if (!mergedScans.some(ms => ms.id === mapped.id)) {
              mergedScans.push(mapped)
            }
          })
        }

        if (mergedScans.length > 0) {
          setActiveShiftScans(mergedScans)
        } else {
          _loadMockScans(activeShift.id)
        }
      } catch (e) {
        _loadMockScans(activeShift.id)
      }
    }

    loadScans()
  }, [activeShift, sharedScans])

  const _loadMockScans = (shiftId) => {
    if (shiftId === 'sh_1') {
      setActiveShiftScans([
        {
          id: 's1',
          checkpoint_name: 'North Gate Perimeter',
          tag_code: 'QR-N483',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
          within_geofence: true,
          notes: 'Secure. Gate lock checked.',
          photo_url: null,
          voice_note_url: null
        },
        {
          id: 's2',
          checkpoint_name: 'Fuel Depot Storage',
          tag_code: 'NFC-F239',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          within_geofence: true,
          notes: 'Fuel vault is locked. Area normal.',
          photo_url: null,
          voice_note_url: null
        },
        {
          id: 's3',
          checkpoint_name: 'Primary Crusher Point',
          tag_code: 'QR-P102',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          within_geofence: true,
          notes: 'Crusher unit checked. Slight wear on gate lock 3.',
          photo_url: null,
          voice_note_url: null
        }
      ])
    } else {
      setActiveShiftScans([
        {
          id: 's4',
          checkpoint_name: 'North Gate Perimeter',
          tag_code: 'QR-N483',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
          within_geofence: true,
          notes: 'North gate area checked. Normal operations.',
          photo_url: null,
          voice_note_url: null
        },
        {
          id: 's5',
          checkpoint_name: 'Fuel Depot Storage',
          tag_code: 'NFC-F239',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
          within_geofence: false,
          notes: 'Poor GPS calibration triggered fence breach. Vault is securely locked.',
          photo_url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop',
          voice_note_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        },
        {
          id: 's6',
          checkpoint_name: 'Explosives Vault Entrance',
          tag_code: 'QR-X901',
          scanned_at: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
          within_geofence: true,
          notes: 'Explosives storage double locked and verified.',
          photo_url: null,
          voice_note_url: null
        }
      ])
    }
  }

  const handleOpenReview = (sh) => {
    setActiveShift(sh)
    setReportForm({
      summary_notes: sh.report?.summary_notes || '',
      rating: sh.report?.rating || 5
    })
  }

  const handleSaveReport = async () => {
    if (!activeShift) return
    setIsLoading(true)

    try {
      if (activeShift.report) {
        await supabase
          .from('shift_reports')
          .update({
            summary_notes: reportForm.summary_notes,
            rating: reportForm.rating,
          })
          .eq('id', activeShift.report.id)
      } else {
        await supabase
          .from('shift_reports')
          .insert({
            shift_id: activeShift.id,
            summary_notes: reportForm.summary_notes,
            rating: reportForm.rating,
            total_scans: activeShift.total_scans,
            geofence_breaches: activeShift.breaches
          })
      }

      const updatedShifts = shifts.map(sh => {
        if (sh.id === activeShift.id) {
          return {
            ...sh,
            report: {
              id: sh.report?.id || 'rep_' + Date.now(),
              summary_notes: reportForm.summary_notes,
              rating: reportForm.rating
            }
          }
        }
        return sh
      })
      setShifts(updatedShifts)
      if (setSharedShifts) {
        setSharedShifts(updatedShifts)
      }
      setActiveShift(null)
    } catch (e) {
      const updatedShifts = shifts.map(sh => {
        if (sh.id === activeShift.id) {
          return {
            ...sh,
            report: {
              id: 'rep_' + Date.now(),
              summary_notes: reportForm.summary_notes,
              rating: reportForm.rating
            }
          }
        }
        return sh
      })
      setShifts(updatedShifts)
      if (setSharedShifts) {
        setSharedShifts(updatedShifts)
      }
      setActiveShift(null)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerPrintReport = () => {
    window.print()
  }

  const calculateDuration = (start, end) => {
    const s = new Date(start)
    const e = new Date(end)
    const diffMs = e.getTime() - s.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E] print:bg-white print:text-black">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50 print:hidden">
        <h2 className="font-heading text-lg font-bold text-white">Management Shift Review Center</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded font-mono">
            COMPLETED PATROLS
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-8 flex-grow flex flex-col gap-6 overflow-y-auto print:p-0">
        <div className="flex flex-col print:hidden">
          <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wide">SHIFT REPORTS INDEX</h3>
          <span className="text-[10px] text-white/45">Review finished shifts, assign management ratings, and compile PDF reports</span>
        </div>

        {/* Shift List Desktop Table */}
        <div className="hidden md:block bg-[#12181A] border border-white/5 rounded-xl overflow-hidden print:hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20 text-[10px] text-white/45 font-mono uppercase tracking-wider">
                <th className="p-4 pl-6">Guard Name</th>
                <th className="p-4">Site Location</th>
                <th className="p-4">Shift Start</th>
                <th className="p-4">Shift End</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Scans Count</th>
                <th className="p-4">Breaches</th>
                <th className="p-4">Report Review</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono text-white/80">
              {shifts.map(sh => (
                <tr key={sh.id} className="hover:bg-white/[0.01]">
                  <td className="p-4 pl-6 font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#3DDCC5]/10 flex items-center justify-center border border-[#3DDCC5]/20">
                      <span className="text-[10px] font-bold text-[#3DDCC5]">
                        {sh.guard_name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans font-bold text-white">{sh.guard_name}</span>
                      <span className="text-[9px] text-[#3DDCC5] font-mono tracking-wide uppercase font-semibold">
                        {sh.shift_type || 'Morning Shift'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-white/60">{sh.site_name}</td>
                  <td className="p-4 text-white/45">
                    {new Date(sh.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-4 text-white/45">
                    {new Date(sh.ended_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-4 text-white/80">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-white/40" />
                      {calculateDuration(sh.started_at, sh.ended_at)}
                    </div>
                  </td>
                  <td className="p-4 text-white/80">{sh.total_scans} Nodes</td>
                  <td className="p-4">
                    {sh.breaches > 0 ? (
                      <span className="text-[#E8A33D] bg-[#E8A33D]/10 px-2 py-0.5 rounded text-[10px] font-bold">
                        {sh.breaches} BREACHES
                      </span>
                    ) : (
                      <span className="text-[#3DDCC5] bg-[#3DDCC5]/10 px-2 py-0.5 rounded text-[10px]">
                        0 BREACHES
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {sh.report ? (
                      <div className="flex items-center gap-1.5 text-[#3DDCC5]">
                        <div className="flex text-[#3DDCC5]">
                          {[...Array(sh.report.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                          ))}
                        </div>
                        <span className="text-[10px] text-white/50">(Reviewed)</span>
                      </div>
                    ) : (
                      <span className="text-white/30 text-[10px]">PENDING REVIEW</span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => handleOpenReview(sh)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#3DDCC5]/20 bg-[#3DDCC5]/10 text-[#3DDCC5] hover:bg-[#3DDCC5]/20 rounded text-[11px] font-semibold transition-all font-mono"
                    >
                      <FileText className="w-3 h-3" />
                      REVIEW
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Shift Reports Mobile Cards List */}
        <div className="block md:hidden flex flex-col gap-4 print:hidden">
          {shifts.map(sh => (
            <div key={sh.id} className="bg-[#12181A] border border-white/5 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 flex items-center justify-center font-bold text-[#3DDCC5] text-xs">
                    {sh.guard_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">{sh.guard_name}</span>
                    <span className="text-[10px] text-white/40 font-mono">
                      {sh.site_name} • {sh.shift_type || 'Morning Shift'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenReview(sh)}
                  className="px-2.5 py-1 border border-[#3DDCC5]/20 bg-[#3DDCC5]/10 text-[#3DDCC5] rounded text-[10px] font-bold font-mono"
                >
                  REVIEW
                </button>
              </div>

              <div className="border-t border-white/5 pt-2 flex flex-col gap-1 text-[10px] text-white/60 font-mono">
                <div><span className="text-white/30">Start:</span> {new Date(sh.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div><span className="text-white/30">End:</span> {new Date(sh.ended_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div><span className="text-white/30">Duration:</span> {calculateDuration(sh.started_at, sh.ended_at)}</div>
              </div>

              <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px]">
                <span className="text-white/70">{sh.total_scans} Nodes Checked</span>
                {sh.breaches > 0 ? (
                  <span className="text-[#E8A33D] bg-[#E8A33D]/10 px-1.5 py-0.5 rounded font-bold">
                    {sh.breaches} BREACHES
                  </span>
                ) : (
                  <span className="text-[#3DDCC5] bg-[#3DDCC5]/10 px-1.5 py-0.5 rounded">
                    0 BREACHES
                  </span>
                )}
              </div>

              {sh.report && (
                <div className="flex items-center gap-1.5 text-[#3DDCC5] border-t border-white/5 pt-2">
                  <div className="flex">
                    {[...Array(sh.report.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                  <span className="text-[9px] text-white/40">(Reviewed)</span>
                </div>
              )}
            </div>
          ))}

          {shifts.length === 0 && (
            <div className="text-center text-white/30 text-xs py-8">
              No shifts reported.
            </div>
          )}
        </div>
      </main>

      {/* Review & Print Shift Report Modal */}
      {activeShift && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 overflow-y-auto p-4 print:static print:bg-white print:p-0 print:overflow-visible">
          {/* Modal Card */}
          <div className="bg-[#12181A] border border-white/10 rounded-xl p-8 w-full max-w-2xl md:w-[720px] flex flex-col gap-6 max-h-[90vh] overflow-y-auto print:border-none print:w-full print:max-h-full print:bg-white print:text-black print:static print:p-0">
            
            {/* Print Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4 print:border-black print:pb-2">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white print:text-black font-heading tracking-wide uppercase">
                  SHIFT PATROL REVIEW CARD
                </h3>
                <span className="text-[10px] text-[#3DDCC5] font-mono print:text-black print:font-semibold">
                  PATROLIQ OFFICIAL MANAGEMENT REPORT
                </span>
              </div>
              <div className="text-right flex flex-col text-[10px] text-white/40 font-mono print:text-black">
                <span>DATE EXPORTED: {new Date().toLocaleDateString()}</span>
                <span>SHIFT ID: {activeShift.id.toUpperCase()}</span>
              </div>
            </div>

            {/* Shift metadata block */}
            <div className="grid grid-cols-2 gap-6 bg-black/20 border border-white/5 p-4 rounded-lg print:border-black print:bg-transparent print:rounded-none">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#3DDCC5] print:text-black" />
                  <span className="text-xs font-bold text-white print:text-black">Guard Officer:</span>
                  <span className="text-xs text-white/80 print:text-black">{activeShift.guard_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3DDCC5] print:text-black" />
                  <span className="text-xs font-bold text-white print:text-black">Site Location:</span>
                  <span className="text-xs text-white/80 print:text-black">{activeShift.site_name}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-right items-end print:text-left print:items-start">
                <div className="text-xs text-white/60 print:text-black">
                  <span className="font-bold text-white print:text-black">Start: </span>
                  {new Date(activeShift.started_at).toLocaleString()}
                </div>
                <div className="text-xs text-white/60 print:text-black">
                  <span className="font-bold text-white print:text-black">End: </span>
                  {new Date(activeShift.ended_at).toLocaleString()}
                </div>
                <div className="text-xs font-bold text-[#3DDCC5] print:text-black font-mono">
                  DURATION: {calculateDuration(activeShift.started_at, activeShift.ended_at)}
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-white/5 bg-white/[0.01] p-3 rounded text-center print:border-black">
                <span className="text-[9px] text-white/40 font-mono block print:text-black/60">TOTAL NODES SCAN</span>
                <span className="text-lg font-bold text-white print:text-black">{activeShift.total_scans} Nodes</span>
              </div>
              <div className="border border-white/5 bg-white/[0.01] p-3 rounded text-center print:border-black">
                <span className="text-[9px] text-white/40 font-mono block print:text-black/60">GEOFENCE BREACHES</span>
                <span className={`text-lg font-bold ${activeShift.breaches > 0 ? 'text-[#E8A33D]' : 'text-[#3DDCC5]'} print:text-black`}>
                  {activeShift.breaches} Breach
                </span>
              </div>
              <div className="border border-white/5 bg-white/[0.01] p-3 rounded text-center print:border-black">
                <span className="text-[9px] text-white/40 font-mono block print:text-black/60">PATROL COVERAGE</span>
                <span className="text-lg font-bold text-white print:text-black">
                  {activeShift.total_scans > 0 ? '100%' : '0%'}
                </span>
              </div>
            </div>

            {/* Detailed Patrol Scan Timeline */}
            <div className="flex flex-col gap-3 border-t border-white/5 pt-4 print:border-black">
              <h5 className="text-xs font-bold text-white print:text-black font-mono uppercase tracking-wider">
                PATROL LOG DETAILS (EACH CHECKPOINT REPORT)
              </h5>
              
              <div className="flex flex-col gap-3">
                {activeShiftScans.map((scan, idx) => (
                  <div key={scan.id} className="p-3 bg-black/30 border border-white/5 rounded-lg flex flex-col gap-2 print:border-black print:bg-transparent print:p-0 print:border-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/60 print:border-black print:text-black font-semibold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white print:text-black">{scan.checkpoint_name}</span>
                        <span className="text-[9px] text-[#3DDCC5]/80 bg-[#3DDCC5]/10 px-1 rounded font-mono print:text-black print:border print:border-black">
                          {scan.tag_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-white/40 font-mono print:text-black/70">
                          {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {scan.within_geofence ? (
                          <span className="text-[9px] text-[#3DDCC5] font-bold font-mono">VALID</span>
                        ) : (
                          <span className="text-[9px] text-[#E8A33D] font-bold font-mono">BREACH</span>
                        )}
                      </div>
                    </div>

                    {/* Report info */}
                    <div className="pl-7 flex flex-col gap-2">
                      {scan.notes ? (
                        <p className="text-[11px] text-white/70 print:text-black/80 font-sans leading-relaxed">
                          "{scan.notes}"
                        </p>
                      ) : (
                        <p className="text-[10px] text-white/20 italic print:text-black/40">No text note submitted.</p>
                      )}

                      {/* Scan media */}
                      {(scan.photo_url || scan.voice_note_url) && (
                        <div className="flex items-center gap-3 print:hidden">
                          {scan.photo_url && (
                            <button
                              onClick={() => setPreviewImage(scan.photo_url)}
                              className="w-10 h-10 rounded overflow-hidden border border-white/15"
                            >
                              <img src={scan.photo_url} className="w-full h-full object-cover" alt="Scan upload" />
                            </button>
                          )}

                          {scan.voice_note_url && (
                            <div className="flex items-center gap-1 bg-black/40 border border-white/5 px-2 py-0.5 rounded">
                              <Volume2 className="w-3 h-3 text-[#3DDCC5]" />
                              <audio
                                src={scan.voice_note_url}
                                controls
                                className="h-5 w-32 focus:outline-none opacity-80"
                                style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Printed media fallback indicator */}
                      <div className="hidden print:block pl-2 border-l border-black/30">
                        {scan.photo_url && (
                          <span className="text-[9px] text-black/60 font-mono block">
                            [Photo Attachment URL: {scan.photo_url}]
                          </span>
                        )}
                        {scan.voice_note_url && (
                          <span className="text-[9px] text-black/60 font-mono block">
                            [Voice Note URL: {scan.voice_note_url}]
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                ))}

                {activeShiftScans.length === 0 && (
                  <span className="text-xs text-white/30 italic">No checkpoint scans logged on this shift.</span>
                )}
              </div>
            </div>

            {/* Guard Notes wrapper */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-4 print:border-black">
              <h5 className="text-xs font-bold text-white print:text-black font-mono uppercase">
                Guard Shift Handover & Wrap-Up Report ({activeShift.shift_type || 'Morning Shift'})
              </h5>
              <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-3 print:border-none print:p-0">
                {activeShift.guard_notes ? (
                  <p className="text-xs text-white/80 print:text-black/80 italic leading-relaxed">
                    "{activeShift.guard_notes}"
                  </p>
                ) : (
                  <p className="text-xs text-white/30 italic">No text summary submitted.</p>
                )}

                {/* Handover Media files */}
                {(activeShift.guard_photo_url || activeShift.guard_voice_note_url) && (
                  <div className="flex items-center gap-4 mt-1 print:hidden">
                    {activeShift.guard_photo_url && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-white/45 font-mono uppercase">Handover Evidence Photo</span>
                        <button
                          onClick={() => setPreviewImage(activeShift.guard_photo_url)}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-white/15 hover:scale-105 transition-transform"
                        >
                          <img src={activeShift.guard_photo_url} className="w-full h-full object-cover" alt="Handover attachment" />
                        </button>
                      </div>
                    )}

                    {activeShift.guard_voice_note_url && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-white/45 font-mono uppercase">Handover Voice Report</span>
                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-lg w-max">
                          <Volume2 className="w-4 h-4 text-[#3DDCC5]" />
                          <audio
                            src={activeShift.guard_voice_note_url}
                            controls
                            className="h-6 w-44 focus:outline-none opacity-85"
                            style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Print layout fallback */}
                <div className="hidden print:block text-[9px] text-black/60 font-mono border-t border-black/20 pt-1.5 mt-1.5">
                  {activeShift.guard_photo_url && <div>[Handover Photo URL: {activeShift.guard_photo_url}]</div>}
                  {activeShift.guard_voice_note_url && <div>[Handover Voice note URL: {activeShift.guard_voice_note_url}]</div>}
                </div>
              </div>
            </div>

            {/* Supervisor Form */}
            <div className="flex flex-col gap-4 border-t border-white/5 pt-4 print:hidden">
              <h5 className="text-xs font-bold text-[#3DDCC5] font-mono uppercase">Supervisor Management Review</h5>
              
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60">Performance Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      key={stars}
                      onClick={() => setReportForm({ ...reportForm, rating: stars })}
                      className="text-white hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          reportForm.rating >= stars
                            ? 'text-[#3DDCC5] fill-[#3DDCC5]'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/40 font-mono">REVIEW NOTES FOR MANAGEMENT</label>
                <textarea
                  rows="3"
                  placeholder="Input summary notes review regarding shift, security incidents, or actions taken..."
                  value={reportForm.summary_notes}
                  onChange={e => setReportForm({ ...reportForm, summary_notes: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]/40"
                />
              </div>
            </div>

            {/* Printed supervisor review overlay */}
            <div className="hidden print:flex print:flex-col print:gap-3 print:border-t print:border-black print:pt-4">
              <h5 className="text-xs font-bold text-black font-mono uppercase">Supervisor Management Review Summary</h5>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-black">Performance Rating:</span>
                <div className="flex text-black">
                  {[...Array(reportForm.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-black/80 leading-relaxed font-sans font-medium">
                {reportForm.summary_notes || 'No supervisor notes compiled yet.'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 border-t border-white/5 pt-4 print:hidden">
              <button
                onClick={() => setActiveShift(null)}
                className="flex-1 py-2 bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white font-semibold rounded-lg"
              >
                CANCEL
              </button>
              <button
                onClick={triggerPrintReport}
                className="px-4 py-2 bg-white/5 border border-white/10 text-xs text-white/80 hover:text-white font-mono rounded-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                PRINT PDF
              </button>
              <button
                onClick={handleSaveReport}
                disabled={isLoading}
                className="flex-1 py-2 bg-[#3DDCC5]/20 border border-[#3DDCC5]/30 text-[#3DDCC5] hover:bg-[#3DDCC5]/35 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-[#3DDCC5] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    SAVE REVIEW
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Global CSS for Print-Media Override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          /* Make modal card and its children visible */
          .fixed, .fixed * {
            visibility: visible;
          }
          .fixed {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

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
