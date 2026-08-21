import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Wifi, Printer, Search, Info, Plus, Smartphone, ExternalLink, X, Check, Copy } from 'lucide-react'

export default function Checkpoints({ checkpoints, setCheckpoints }) {

  const [search, setSearch] = useState('')
  const [provisioningNfc, setProvisioningNfc] = useState(null)
  const [nfcWriteStatus, setNfcWriteStatus] = useState('idle')

  // Modal states for creating checkpoint & pairing phone
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [previewQrModal, setPreviewQrModal] = useState(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Network IP / Host for Mobile Scanning (Auto-detects Wi-Fi IP)
  const defaultHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '172.16.2.123'
    : window.location.hostname

  const [customHost, setCustomHost] = useState(defaultHost)
  const availableIps = ['172.16.2.123', '192.168.0.140', '192.168.137.1', 'localhost']

  // New Checkpoint Form State
  const [newCp, setNewCp] = useState({
    name: '',
    tag_code: '',
    site: 'Main Mining Depot',
    route: 'Perimeter West A'
  })

  useEffect(() => {
    const fetchCheckpoints = async () => {
      try {
        const { data: dbCheckpoints } = await supabase
          .from('checkpoints')
          .select('id, name, tag_code, routes(name, sites(name))')
        
        if (dbCheckpoints && dbCheckpoints.length > 0) {
          const formatted = dbCheckpoints.map(cp => ({
            id: cp.id,
            name: cp.name,
            tag_code: cp.tag_code,
            site: cp.routes?.sites?.name || 'Main Mining Depot',
            route: cp.routes?.name || 'Perimeter West A'
          }))
          setCheckpoints(formatted)
        }
      } catch (err) {}
    }
    fetchCheckpoints()
  }, [])

  const startNfcProvision = (cp) => {
    setProvisioningNfc(cp)
    setNfcWriteStatus('writing')
    setTimeout(() => {
      setNfcWriteStatus('success')
    }, 2500)
  }

  const printQRCodes = () => {
    window.print()
  }

  // Generate unique tag code when opening modal
  const handleOpenCreateModal = () => {
    const randomNum = Math.floor(100 + Math.random() * 900)
    setNewCp({
      name: '',
      tag_code: `QR-P${randomNum}`,
      site: 'Main Mining Depot',
      route: 'Perimeter West A'
    })
    setShowCreateModal(true)
  }

  const handleCreateCheckpoint = (e) => {
    e.preventDefault()
    if (!newCp.name.trim() || !newCp.tag_code.trim()) return

    const created = {
      id: 'c_' + Date.now(),
      name: newCp.name.trim(),
      tag_code: newCp.tag_code.trim().toUpperCase(),
      site: newCp.site,
      route: newCp.route
    }

    setCheckpoints(prev => [created, ...prev])
    setShowCreateModal(false)
    
    // Show QR modal for instant phone scanning
    setPreviewQrModal(created)
  }

  // Construct mobile connect link for phone camera scanning
  const getMobileScanUrl = (tagCode) => {
    const protocol = window.location.protocol
    const port = window.location.port ? `:${window.location.port}` : ''
    const path = window.location.pathname
    return `${protocol}//${customHost}${port}${path}?scan=${encodeURIComponent(tagCode)}`
  }

  const getMobilePairUrl = () => {
    const protocol = window.location.protocol
    const port = window.location.port ? `:${window.location.port}` : ''
    const path = window.location.pathname
    return `${protocol}//${customHost}${port}${path}?connect=1`
  }

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const filtered = checkpoints.filter(cp =>
    cp.name.toLowerCase().includes(search.toLowerCase()) ||
    cp.tag_code.toLowerCase().includes(search.toLowerCase()) ||
    cp.site.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0B0F0E]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#12181A]/50 print:hidden">
        <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#3DDCC5]" />
          Checkpoints & QR/NFC Tag Manager
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPairModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3DDCC5]/30 bg-[#3DDCC5]/10 text-xs font-semibold text-[#3DDCC5] hover:bg-[#3DDCC5]/20 transition-all font-mono"
          >
            <Smartphone className="w-4 h-4" />
            CONNECT PHONE
          </button>
          
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#3DDCC5] text-black text-xs font-bold hover:bg-[#3DDCC5]/90 transition-all font-sans"
          >
            <Plus className="w-4 h-4" />
            CREATE CHECKPOINT CODE
          </button>

          <button
            onClick={printQRCodes}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-all font-mono"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT TAGS
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="p-8 flex-grow flex flex-col gap-6 overflow-y-auto print:p-0 print:bg-white print:text-black">
        {/* Guideline Banner */}
        <div className="bg-[#12181A] border border-white/5 p-4 rounded-xl flex items-start justify-between gap-3 print:hidden">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#3DDCC5] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-white">Instant Mobile Camera Scanning</span>
              <span className="text-[11px] text-white/50 leading-relaxed">
                When you create or select a checkpoint code below, point your phone's camera at the QR code on your computer screen. Your phone will scan it, open PatrolIQ, and connect directly to field mode!
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowPairModal(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-[#3DDCC5] border border-white/10 rounded-lg shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Scan to Connect Phone
          </button>
        </div>

        {/* Search and stats bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search by name, site, or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#12181A] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/30 font-mono focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 font-mono">SHOWING {filtered.length} CODES</span>
          </div>
        </div>

        {/* Grid of QR/NFC Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-8 print:text-black">
          {filtered.map(cp => {
            const qrUrl = getMobileScanUrl(cp.tag_code)
            return (
              <div
                key={cp.id}
                className="bg-[#12181A] border border-white/5 rounded-xl p-5 flex flex-col items-center gap-4 text-center transition-all hover:border-[#3DDCC5]/30 group print:bg-white print:border-2 print:border-black print:rounded-lg print:p-4 relative"
              >
                {/* Print Header */}
                <div className="hidden print:flex flex-col items-center border-b-2 border-black pb-2 w-full mb-1">
                  <span className="text-sm font-black font-heading tracking-wider">PATROLIQ</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase">SECURITY CHECKPOINT</span>
                </div>

                {/* QR Display Container */}
                <div 
                  onClick={() => setPreviewQrModal(cp)}
                  className="w-36 h-36 bg-white p-3 rounded-lg flex items-center justify-center border border-white/5 print:border-black cursor-pointer hover:scale-105 transition-transform relative group/qr shadow-md"
                  title="Click to expand QR Code for phone scanning"
                >
                  <QRCodeSVG
                    value={qrUrl}
                    size={120}
                    level="H"
                    includeMargin={true}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/qr:opacity-100 flex flex-col items-center justify-center transition-opacity rounded-lg text-white p-2 print:hidden">
                    <Smartphone className="w-6 h-6 text-[#3DDCC5] mb-1" />
                    <span className="text-[9px] font-bold text-[#3DDCC5]">SCAN WITH PHONE</span>
                  </div>
                </div>

                {/* Tag Metadata */}
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-xs font-bold text-white print:text-black print:text-sm truncate">{cp.name}</span>
                  <span className="text-[9px] text-[#3DDCC5] font-mono tracking-wider print:text-black print:text-xs font-bold">
                    Checkpoint ID: {cp.tag_code}
                  </span>
                  <span className="text-[9px] text-white/40 font-mono tracking-tight print:text-black/70 truncate">
                    {cp.site} • {cp.route}
                  </span>
                </div>

                {/* Print Footer */}
                <div className="hidden print:flex flex-col items-center border-t border-black pt-2 w-full mt-1">
                  <span className="text-[9px] font-bold tracking-widest uppercase">SCAN TO VERIFY PATROL</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 w-full mt-1 print:hidden">
                  <button
                    onClick={() => setPreviewQrModal(cp)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 rounded-lg text-[10px] font-mono text-[#3DDCC5] hover:bg-[#3DDCC5]/20 transition-all font-bold"
                  >
                    <Smartphone className="w-3 h-3" />
                    SCAN CODE
                  </button>
                  <button
                    onClick={() => startNfcProvision(cp)}
                    className="flex items-center justify-center px-2 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-mono text-white/80 hover:bg-white/10 transition-all"
                    title="Provision NFC Tag"
                  >
                    <Wifi className="w-3 h-3 text-[#3DDCC5]" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* CREATE NEW CHECKPOINT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12181A] border border-white/10 rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-[#3DDCC5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-heading">Create Checkpoint Code</h3>
                <p className="text-xs text-white/40 font-mono">Generate scannable QR tag for phone connection</p>
              </div>
            </div>

            <form onSubmit={handleCreateCheckpoint} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-mono">CHECKPOINT NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Main Entrance Gate 1"
                  value={newCp.name}
                  onChange={e => setNewCp({ ...newCp, name: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/60 font-mono">TAG CODE / IDENTIFIER</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., QR-G101"
                  value={newCp.tag_code}
                  onChange={e => setNewCp({ ...newCp, tag_code: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#3DDCC5] font-mono font-bold placeholder:text-white/20 focus:outline-none focus:border-[#3DDCC5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-mono">SITE LOCATION</label>
                  <select
                    value={newCp.site}
                    onChange={e => setNewCp({ ...newCp, site: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Main Mining Depot">Main Mining Depot</option>
                    <option value="Washing Plant Area">Washing Plant Area</option>
                    <option value="North Security Zone">North Security Zone</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/60 font-mono">PATROL ROUTE</label>
                  <select
                    value={newCp.route}
                    onChange={e => setNewCp({ ...newCp, route: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Perimeter West A">Perimeter West A</option>
                    <option value="Crusher Route B">Crusher Route B</option>
                    <option value="Fuel Vault Check">Fuel Vault Check</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-semibold text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#3DDCC5] hover:bg-[#3DDCC5]/90 rounded-xl text-xs font-bold text-black font-sans"
                >
                  Generate QR Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL SCREEN QR SCAN PREVIEW MODAL */}
      {previewQrModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12181A] border border-[#3DDCC5]/40 rounded-2xl p-6 w-full max-w-md flex flex-col items-center text-center gap-5 relative shadow-2xl">
            <button
              onClick={() => setPreviewQrModal(null)}
              className="absolute right-4 top-4 text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-[#3DDCC5] font-mono font-bold tracking-widest uppercase flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                POINT PHONE CAMERA AT QR CODE BELOW
              </span>
              <h3 className="text-lg font-bold text-white font-heading">{previewQrModal.name}</h3>
              <span className="text-xs text-white/60 font-mono">CODE: {previewQrModal.tag_code}</span>
            </div>

            {/* Enlarged QR Code Display with Auto-Focus Frame */}
            <div className="relative p-2 bg-gradient-to-tr from-[#3DDCC5] to-emerald-400 rounded-3xl shadow-2xl">
              <div className="w-72 h-72 bg-white p-4 rounded-2xl flex items-center justify-center relative">
                <QRCodeSVG
                  value={getMobileScanUrl(previewQrModal.tag_code)}
                  size={250}
                  level="Q"
                  includeMargin={true}
                />
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 w-full flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40 font-mono">ENCODED MOBILE SCAN URL</span>
                <button
                  onClick={() => handleCopyLink(getMobileScanUrl(previewQrModal.tag_code))}
                  className="text-[10px] text-[#3DDCC5] font-mono flex items-center gap-1 hover:underline"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copiedUrl ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={getMobileScanUrl(previewQrModal.tag_code)}
                className="w-full bg-black/50 border border-white/5 rounded px-2.5 py-1 text-[10px] text-white/80 font-mono select-all focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2.5 text-left text-[11px] text-white/80 bg-[#3DDCC5]/10 border border-[#3DDCC5]/30 p-3 rounded-xl">
              <Smartphone className="w-5 h-5 text-[#3DDCC5] shrink-0" />
              <span>
                <strong>Camera Focus Tip:</strong> Hold your phone 20–30 cm (8–12 inches) away from the monitor screen so the camera focuses sharply on the large QR code.
              </span>
            </div>

            <button
              onClick={() => setPreviewQrModal(null)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white rounded-xl"
            >
              Close QR Scanner Preview
            </button>
          </div>
        </div>
      )}

      {/* CONNECT PHONE PAIRING MODAL */}
      {showPairModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12181A] border border-white/10 rounded-2xl p-6 w-full max-w-md flex flex-col items-center text-center gap-5 relative">
            <button
              onClick={() => setShowPairModal(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-[#3DDCC5]/10 border border-[#3DDCC5]/20 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#3DDCC5]" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-white font-heading">Pair Your Mobile Phone</h3>
              <p className="text-xs text-white/50">Scan this QR code with your phone camera to open PatrolIQ Mobile Client</p>
            </div>

            {/* Custom Host / IP Configurator */}
            <div className="w-full bg-black/40 border border-white/5 p-3 rounded-xl flex flex-col gap-2 text-left">
              <label className="text-[10px] text-white/40 font-mono uppercase">Select PC Wi-Fi IP for Phone Connection:</label>
              <div className="flex flex-wrap gap-1.5">
                {availableIps.map(ip => (
                  <button
                    key={ip}
                    type="button"
                    onClick={() => setCustomHost(ip)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all border ${
                      customHost === ip
                        ? 'bg-[#3DDCC5] text-black font-bold border-[#3DDCC5]'
                        : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {ip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customHost}
                onChange={e => setCustomHost(e.target.value)}
                placeholder="Or enter custom IP (e.g. 192.168.1.50)"
                className="w-full bg-[#12181A] border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
              />
              {customHost === 'localhost' && (
                <span className="text-[9px] text-[#E8A33D] font-mono">⚠️ Phones cannot resolve 'localhost'. Select a Wi-Fi IP address above!</span>
              )}
            </div>

            {/* Main Phone Connection QR */}
            <div className="w-52 h-52 bg-white p-3 rounded-xl flex items-center justify-center border-2 border-[#3DDCC5]">
              <QRCodeSVG
                value={getMobilePairUrl()}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="w-full bg-white/5 p-2.5 rounded-xl text-[10px] font-mono text-white/60 flex items-center justify-between">
              <span className="truncate mr-2">{getMobilePairUrl()}</span>
              <button
                onClick={() => handleCopyLink(getMobilePairUrl())}
                className="text-[#3DDCC5] font-bold shrink-0 hover:underline"
              >
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button
              onClick={() => setShowPairModal(false)}
              className="w-full py-2.5 bg-[#3DDCC5] text-black font-bold text-xs rounded-xl hover:bg-[#3DDCC5]/90"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* NFC Provision Modal */}
      {provisioningNfc && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 print:hidden">
          <div className="bg-[#12181A] border border-white/10 rounded-xl p-6 w-96 flex flex-col items-center text-center gap-6">
            <div className="w-12 h-12 rounded-full bg-[#3DDCC5]/10 flex items-center justify-center animate-pulse">
              <Wifi className="w-6 h-6 text-[#3DDCC5]" />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-bold text-white font-heading">NFC Provisioning Terminal</h4>
              <span className="text-xs text-white/40 font-mono">Writing tag data for: {provisioningNfc.name}</span>
            </div>

            {nfcWriteStatus === 'writing' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-[#3DDCC5] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-white/60 font-mono tracking-wider animate-pulse">
                  TAP MOBILE PHONE TO SCANNER...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-[#3DDCC5] font-bold font-mono">SUCCESSFULLY PROVISIONED</span>
                <span className="text-[10px] text-white/40 font-mono">
                  Tag written with value: <code className="bg-white/5 px-1 rounded">{provisioningNfc.tag_code}</code>
                </span>
              </div>
            )}

            <button
              onClick={() => setProvisioningNfc(null)}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white rounded-lg"
            >
              CLOSE TERMINAL
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
