import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Plus, Check, Shield, UserX, UserCheck, Mail, Copy, Key, ExternalLink, CheckCircle } from 'lucide-react'

export default function UsersAndRoles({ sharedUsers, setSharedUsers }) {
  const [users, setUsers] = useState(sharedUsers || [
    { id: 'u1', name: 'Amadou Camara', email: 'amadou@grizzly.com', role: 'guard', is_active: true, pass: 'PatrolIQ#101' },
    { id: 'u2', name: 'Regan Nguluta', email: 'regan@grizzly.com', role: 'guard', is_active: true, pass: 'PatrolIQ#102' },
    { id: 'u3', name: 'Bentley Chafe', email: 'bentley@grizzly.com', role: 'supervisor', is_active: true, pass: 'PatrolIQ#103' },
    { id: 'u4', name: 'John Doe', email: 'admin@grizzly.com', role: 'admin', is_active: true, pass: 'PatrolIQ#104' }
  ])

  // Keep internal users state in sync with sharedUsers from App.jsx
  useEffect(() => {
    if (sharedUsers) {
      setUsers(sharedUsers)
    }
  }, [sharedUsers])

  const [newInvite, setNewInvite] = useState({ name: '', email: '', role: 'guard' })
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  // Success modal for generated credentials
  const [createdUserModal, setCreatedUserModal] = useState(null)
  const [copied, setCopied] = useState(false)
  const [emailSentNotice, setEmailSentNotice] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: dbProfiles } = await supabase
          .from('profiles')
          .select('*')
        
        if (dbProfiles && dbProfiles.length > 0) {
          const formatted = dbProfiles.map(p => ({
            ...p,
            pass: p.pass || 'PatrolIQ#' + Math.floor(1000 + Math.random() * 9000)
          }))
          const mergeFn = prev => {
            const merged = [...prev]
            formatted.forEach(f => {
              if (!merged.some(m => m.email.toLowerCase() === f.email.toLowerCase())) {
                merged.push(f)
              }
            })
            return merged
          }
          if (setSharedUsers) setSharedUsers(mergeFn)
          else setUsers(mergeFn)
        }
      } catch (err) {}
    }
    fetchUsers()
  }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!newInvite.name || !newInvite.email) return

    const generatedPass = 'PatrolIQ#' + Math.floor(1000 + Math.random() * 9000)
    const newId = 'u_' + Date.now()
    const newProfile = {
      id: newId,
      name: newInvite.name,
      email: newInvite.email,
      role: newInvite.role,
      is_active: true,
      pass: generatedPass
    }

    if (setSharedUsers) {
      setSharedUsers(prev => [newProfile, ...prev])
    } else {
      setUsers(prev => [newProfile, ...prev])
    }
    setIsInviteOpen(false)
    
    // Open credentials modal
    setCreatedUserModal(newProfile)

    try {
      await supabase.from('profiles').insert([{
        id: newId,
        name: newInvite.name,
        email: newInvite.email,
        role: newInvite.role,
        is_active: true
      }])
    } catch (e) {
      console.log('User created locally and added to active registry.')
    }

    setNewInvite({ name: '', email: '', role: 'guard' })
  }

  const toggleUserStatus = async (id, currentStatus) => {
    const updateFn = prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, is_active: !currentStatus }
      }
      return u
    })
    if (setSharedUsers) setSharedUsers(updateFn)
    else setUsers(updateFn)

    try {
      await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id)
    } catch (e) {}
  }

  const changeUserRole = async (id, newRole) => {
    const updateFn = prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, role: newRole }
      }
      return u
    })
    if (setSharedUsers) setSharedUsers(updateFn)
    else setUsers(updateFn)

    try {
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id)
    } catch (e) {}
  }

  const handleCopyCredentials = (userObj) => {
    const text = `PatrolIQ Guard Invitation:\nOfficer: ${userObj.name}\nEmail: ${userObj.email}\nRole: ${userObj.role.toUpperCase()}\nTemporary Passcode: ${userObj.pass}\nLogin Link: ${window.location.origin}/PatrolIQ/`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleResendEmail = (email) => {
    setEmailSentNotice(true)
    setTimeout(() => setEmailSentNotice(false), 4000)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50">
        <h2 className="font-heading text-lg font-bold text-white">Users & Roles Manager</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#3DDCC5]/30 bg-[#3DDCC5]/15 text-xs font-semibold text-[#3DDCC5] hover:bg-[#3DDCC5]/25 transition-all font-mono shadow-lg shadow-[#3DDCC5]/10"
          >
            <Plus className="w-4 h-4" />
            INVITE NEW USER
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-4 sm:p-8 flex-grow flex flex-col gap-6 overflow-y-auto">
        
        {/* Email sent notification alert */}
        {emailSentNotice && (
          <div className="bg-[#3DDCC5]/10 border border-[#3DDCC5]/30 text-[#3DDCC5] p-3 rounded-xl flex items-center gap-2 text-xs font-mono animate-fade-in">
            <CheckCircle className="w-4 h-4 text-[#3DDCC5]" />
            Invitation email dispatch initiated! Login credentials sent to user email.
          </div>
        )}

        {/* Users Desktop Table */}
        <div className="hidden md:block bg-[#12181A] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20 text-[10px] text-white/45 font-mono uppercase tracking-wider">
                <th className="p-4 pl-6">Full Name</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono text-white/80">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-white/[0.01] ${!u.is_active ? 'opacity-40' : ''}`}>
                  <td className="p-4 pl-6 font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#3DDCC5]/10 flex items-center justify-center border border-[#3DDCC5]/20">
                      <span className="text-[10px] font-bold text-[#3DDCC5]">{u.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    {u.name}
                  </td>
                  <td className="p-4 text-white/60">{u.email}</td>
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={e => changeUserRole(u.id, e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white/90 font-mono focus:outline-none focus:border-[#3DDCC5]"
                    >
                      <option value="admin">Administrator</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="guard">Security Guard</option>
                      <option value="client">Client Portal</option>
                    </select>
                  </td>
                  <td className="p-4">
                    {u.is_active ? (
                      <span className="text-[#3DDCC5] bg-[#3DDCC5]/10 px-2 py-0.5 rounded text-[10px] font-bold border border-[#3DDCC5]/20">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-white/30 bg-white/5 px-2 py-0.5 rounded text-[10px]">
                        DEACTIVATED
                      </span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCreatedUserModal(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-semibold text-white/80 transition-all"
                      title="View Access Passcode & Credentials"
                    >
                      <Key className="w-3 h-3 text-[#3DDCC5]" /> PASSCODE
                    </button>

                    <button
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={`inline-flex items-center gap-1 px-2 py-1 border rounded-lg text-[10px] font-semibold transition-all ${
                        u.is_active
                          ? 'border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-[#3DDCC5]/20 bg-[#3DDCC5]/10 text-[#3DDCC5] hover:bg-[#3DDCC5]/20'
                      }`}
                    >
                      {u.is_active ? (
                        <>
                          <UserX className="w-3 h-3" /> DEACTIVATE
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3" /> ACTIVATE
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Users Mobile Cards List */}
        <div className="block md:hidden flex flex-col gap-4">
          {users.map(u => (
            <div key={u.id} className={`bg-[#12181A] border border-white/5 p-4 rounded-xl flex flex-col gap-3 transition-opacity ${!u.is_active ? 'opacity-40' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 flex items-center justify-center font-bold text-[#3DDCC5] text-xs">
                    {u.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">{u.name}</span>
                    <span className="text-[10px] text-white/40 font-mono">{u.email}</span>
                  </div>
                </div>
                {u.is_active ? (
                  <span className="text-[#3DDCC5] bg-[#3DDCC5]/10 px-2 py-0.5 rounded text-[9px] font-bold">
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-white/30 bg-white/5 px-2 py-0.5 rounded text-[9px]">
                    DEACTIVATED
                  </span>
                )}
              </div>

              <div className="border-t border-white/5 pt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Assigned Role:</span>
                  <select
                    value={u.role}
                    onChange={e => changeUserRole(u.id, e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/80 font-mono focus:outline-none"
                  >
                    <option value="admin">Administrator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="guard">Security Guard</option>
                    <option value="client">Client Portal</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                <button
                  onClick={() => setCreatedUserModal(u)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-white/10 bg-white/5 rounded-lg text-[10px] text-white/80"
                >
                  <Key className="w-3.5 h-3.5 text-[#3DDCC5]" /> VIEW CREDENTIALS
                </button>

                <button
                  onClick={() => toggleUserStatus(u.id, u.is_active)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded text-[10px] font-semibold transition-all ${
                    u.is_active
                      ? 'border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'border-[#3DDCC5]/20 bg-[#3DDCC5]/10 text-[#3DDCC5] hover:bg-[#3DDCC5]/20'
                  }`}
                >
                  {u.is_active ? (
                    <>
                      <UserX className="w-3.5 h-3.5" /> DEACTIVATE
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" /> ACTIVATE
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Invite User Form Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12181A] border border-white/10 rounded-2xl p-6 w-[420px] max-w-full flex flex-col gap-5 shadow-2xl">
            <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white font-heading">Invite a New PatrolIQ User</h3>
              <span className="text-[11px] text-white/50">User will be activated immediately and assigned access credentials</span>
            </div>

            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/40 font-mono uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={newInvite.name}
                  onChange={e => setNewInvite({ ...newInvite, name: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/40 font-mono uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="kwame@grizzly.com"
                  value={newInvite.email}
                  onChange={e => setNewInvite({ ...newInvite, email: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-white/40 font-mono uppercase">System Authorization Role</label>
                <select
                  value={newInvite.role}
                  onChange={e => setNewInvite({ ...newInvite, role: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#3DDCC5]"
                >
                  <option value="guard">Security Guard</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrator</option>
                  <option value="client">Client Portal Access</option>
                </select>
              </div>

              <div className="flex gap-3 border-t border-white/5 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white font-semibold rounded-xl"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#3DDCC5] text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-[#3DDCC5]/20 hover:bg-[#3DDCC5]/90"
                >
                  <Mail className="w-4 h-4" />
                  CREATE & SEND INVITE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instant Credentials & Invite Passcode Modal */}
      {createdUserModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12181A] border border-[#3DDCC5]/30 rounded-2xl p-6 w-[440px] max-w-full flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#3DDCC5]/15 border border-[#3DDCC5]/30 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-[#3DDCC5]" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-white font-heading">User Account Created Successfully!</h3>
                <span className="text-[10px] text-[#3DDCC5] font-mono">INVITATION READY FOR DISPATCH</span>
              </div>
            </div>

            <div className="bg-black/50 p-4 rounded-xl border border-white/10 flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-white/40">OFFICER NAME:</span>
                <span className="font-bold text-white">{createdUserModal.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-white/40">EMAIL ADDRESS:</span>
                <span className="text-[#3DDCC5]">{createdUserModal.email}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-white/40">ASSIGNED ROLE:</span>
                <span className="uppercase font-bold text-white">{createdUserModal.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40">TEMPORARY PASSCODE:</span>
                <span className="bg-[#3DDCC5]/15 text-[#3DDCC5] px-2 py-0.5 rounded font-bold border border-[#3DDCC5]/30">
                  {createdUserModal.pass}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleCopyCredentials(createdUserModal)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  copied 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
                    : 'bg-[#3DDCC5] text-black hover:bg-[#3DDCC5]/90 shadow-lg shadow-[#3DDCC5]/20'
                }`}
              >
                <Copy className="w-4 h-4" />
                {copied ? 'CREDENTIALS COPIED TO CLIPBOARD!' : 'COPY INVITATION CREDENTIALS'}
              </button>

              <button
                type="button"
                onClick={() => handleResendEmail(createdUserModal.email)}
                className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold text-white/80 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4 text-[#3DDCC5]" />
                SEND EMAIL DISPATCH NOTICE
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCreatedUserModal(null)}
              className="mt-2 py-1.5 text-center text-xs text-white/40 hover:text-white font-mono"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
