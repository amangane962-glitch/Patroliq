import { Activity, Map, MapPin, List, Users, Shield, FileText, Smartphone, X, Award, ShieldAlert, FileCheck, Cpu, Download } from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab, onCloseMobile }) {
  const menuItems = [
    { id: 'overview', label: 'Live Overview', icon: Activity },
    { id: 'sites', label: 'Sites & Routes', icon: Map },
    { id: 'checkpoints', label: 'Checkpoints', icon: MapPin },
    { id: 'log', label: 'Checkpoint Log', icon: List },
    { id: 'incidents', label: 'Security Incidents', icon: ShieldAlert },
    { id: 'reports', label: 'Shift Reports', icon: FileText },
    { id: 'kpis', label: 'KPI Tracker', icon: Award },
    { id: 'audit', label: 'Audit Trail', icon: FileCheck },
    { id: 'simulator', label: 'Guard Mobile App', icon: Smartphone },
    { id: 'diagnostics', label: 'Device Diagnostics', icon: Cpu },
    { id: 'users', label: 'Users & Roles', icon: Users },
  ]

  return (
    <aside className="w-64 bg-[#0d151c] border-r border-[#00f2fe]/15 flex flex-col justify-between h-screen sticky top-0 shadow-2xl">
      <div className="flex flex-col">
        {/* Brand/Logo Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#00f2fe]/15 bg-[#070c12]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00f2fe]/10 flex items-center justify-center border border-[#00f2fe]/30 shadow-[0_0_10px_rgba(0,242,254,0.2)]">
              <Shield className="w-5 h-5 text-[#00f2fe]" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-white tracking-wider">PatrolIQ</h1>
              <span className="text-[9px] text-[#00f2fe] font-mono tracking-widest uppercase font-bold">OPS COMMAND CENTER</span>
            </div>
          </div>
          <button 
            onClick={onCloseMobile} 
            className="md:hidden text-white/40 hover:text-white p-1 rounded hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-200px)]">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  if (onCloseMobile) onCloseMobile()
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-[#00f2fe]/15 text-[#00f2fe] font-semibold border border-[#00f2fe]/30 shadow-[0_0_12px_rgba(0,242,254,0.15)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00f2fe]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer: APK Download & User Info */}
      <div className="p-4 border-t border-[#00f2fe]/15 bg-[#070c12] flex flex-col gap-3">
        <a
          href="/PatrolIQ.apk"
          download="PatrolIQ-Security-App.apk"
          className="w-full py-2 px-3 bg-[#00f2fe]/20 hover:bg-[#00f2fe]/30 border border-[#00f2fe]/40 text-[#00f2fe] font-bold rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition shadow-[0_0_10px_rgba(0,242,254,0.2)]"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD APK</span>
        </a>

        <div className="flex items-center gap-3 pt-1">
          <div className="w-8 h-8 rounded-full bg-[#00f2fe]/10 border border-[#00f2fe]/30 flex items-center justify-center">
            <span className="text-xs font-semibold text-[#00f2fe] font-mono font-bold">AD</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white">Security Command</span>
            <span className="text-[10px] text-[#00f2fe] font-mono font-bold">ROLE: ADMIN</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

