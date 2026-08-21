import React, { useState } from 'react'
import { FileCheck, Search, Filter, Shield, User, Clock, CheckCircle, AlertTriangle, Key } from 'lucide-react'

export default function AuditTrail({ sharedAuditLogs }) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const filteredLogs = sharedAuditLogs.filter(log => {
    const matchesSearch = (log.user || '').toLowerCase().includes(search.toLowerCase()) ||
                          (log.action || '').toLowerCase().includes(search.toLowerCase()) ||
                          (log.details || '').toLowerCase().includes(search.toLowerCase())
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    return matchesSearch && matchesAction
  })

  return (
    <div className="p-6 flex flex-col gap-6 overflow-y-auto h-full bg-[#0B0F0E] text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-[#3DDCC5]" />
            <h2 className="text-xl font-bold font-heading text-white">System Audit Trail</h2>
          </div>
          <p className="text-xs text-white/50 mt-1">Immutable security log of patrol events, shift starts, checkpoint scans, incidents, and administrative overrides.</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12181A] p-4 rounded-xl border border-white/5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search audit logs by user, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0F0E] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#3DDCC5]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-white/50 font-mono">
          <Filter className="w-3.5 h-3.5 text-white/40" />
          <span>ACTION TYPE:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#0B0F0E] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="all">ALL ACTIONS</option>
            <option value="SHIFT_START">SHIFT START</option>
            <option value="CHECKPOINT_SCAN">CHECKPOINT SCAN</option>
            <option value="INCIDENT_REPORTED">INCIDENT REPORTED</option>
            <option value="SHIFT_END">SHIFT END</option>
            <option value="USER_LOGIN">USER LOGIN</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#12181A] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white/80">
            <thead className="bg-[#0B0F0E] text-white/40 font-mono text-[10px] uppercase border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Device / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-white/40">
                    No audit records match your current search filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-white/60 text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#3DDCC5]" />
                      <span>{log.user}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-white/5 border border-white/10 text-white/70">
                        {log.role || 'GUARD'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#3DDCC5]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-white/70">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/40 text-[10px]">
                      {log.ip_address || 'Mobile Device'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
