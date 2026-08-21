import React, { useState, useEffect } from 'react'
import { 
  Shield, Camera, Navigation, Radio, Zap, Volume2, Wifi, WifiOff, 
  Lock, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Smartphone, 
  Trash2, FileText, ArrowLeft, Info, HelpCircle
} from 'lucide-react'
import { useHardwareCapabilities, getHardwareLogs, clearHardwareLogs, getHighAccuracyPosition } from '../services/hardwareCapabilities'

export default function DeviceCapabilityScreen({ onBack }) {
  const { capabilities, refreshCapabilities } = useHardwareCapabilities()
  const [testingGps, setTestingGps] = useState(false)
  const [gpsTestResult, setGpsTestResult] = useState(null)
  const [logs, setLogs] = useState([])
  const [activeSubTab, setActiveSubTab] = useState('diagnostics') // 'diagnostics' | 'logs' | 'guidance'

  useEffect(() => {
    setLogs(getHardwareLogs())
  }, [capabilities])

  const handleRunFullDiagnostics = async () => {
    setTestingGps(true)
    setGpsTestResult(null)
    await refreshCapabilities()

    try {
      const pos = await getHighAccuracyPosition()
      setGpsTestResult({
        success: true,
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy,
        source: pos.source
      })
    } catch (err) {
      setGpsTestResult({
        success: false,
        error: err.message
      })
    } finally {
      setTestingGps(false)
      setLogs(getHardwareLogs())
    }
  }

  const handleClearLogs = () => {
    clearHardwareLogs()
    setLogs([])
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0B0F0E] text-white w-full h-full overflow-y-auto p-4 md:p-6">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition"
              title="Return to Mobile App"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-heading text-lg md:text-xl font-bold flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-[#3DDCC5]" />
              Mobile Device Capability & Hardware Diagnostics
            </h1>
            <p className="text-xs text-white/50">
              Inspect real hardware interfaces, browser permissions, and hardware error logs.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunFullDiagnostics}
          disabled={testingGps}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#3DDCC5] hover:bg-[#34c6b1] text-black font-semibold text-xs rounded-lg transition shadow-lg shadow-[#3DDCC5]/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${testingGps ? 'animate-spin' : ''}`} />
          <span>{testingGps ? 'Testing Hardware...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveSubTab('diagnostics')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeSubTab === 'diagnostics'
              ? 'bg-[#3DDCC5]/15 text-[#3DDCC5] border border-[#3DDCC5]/30'
              : 'text-white/60 hover:bg-white/5'
          }`}
        >
          Hardware Status Grid
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
            activeSubTab === 'logs'
              ? 'bg-[#3DDCC5]/15 text-[#3DDCC5] border border-[#3DDCC5]/30'
              : 'text-white/60 hover:bg-white/5'
          }`}
        >
          <span>Hardware Error Logs</span>
          {logs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full font-mono font-bold">
              {logs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('guidance')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeSubTab === 'guidance'
              ? 'bg-[#3DDCC5]/15 text-[#3DDCC5] border border-[#3DDCC5]/30'
              : 'text-white/60 hover:bg-white/5'
          }`}
        >
          Real Device Field Setup Guide
        </button>
      </div>

      {/* Security Context Alert if HTTP */}
      {!capabilities.secureContext && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">
              Insecure Context Warning (HTTP)
            </h4>
            <p className="text-xs text-white/70 mt-1">
              Mobile browsers (Chrome Android & Safari iOS) restrict Camera (`getUserMedia`), Geolocation, and NFC to HTTPS connections or `localhost`. Accessing PatrolIQ via unencrypted local IP (e.g. `http://192.168.x.x`) will cause hardware APIs to be blocked by the browser.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: DIAGNOSTICS GRID */}
      {activeSubTab === 'diagnostics' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. CAMERA */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Camera Interface</h3>
                    <p className="text-[11px] text-white/50 font-mono">getUserMedia API</p>
                  </div>
                </div>
                {capabilities.camera ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    SUPPORTED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    UNSUPPORTED
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Permission State:</span>
                  <span className="font-mono text-white capitalize">{capabilities.cameraPermission}</span>
                </div>
                <div className="flex justify-between">
                  <span>Video Cameras Found:</span>
                  <span className="font-mono text-white">{capabilities.videoDevicesCount}</span>
                </div>
              </div>
            </div>

            {/* 2. QR SCANNER */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">QR Code Decoder</h3>
                    <p className="text-[11px] text-white/50 font-mono">jsQR Canvas Engine</p>
                  </div>
                </div>
                {capabilities.qrScanner ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    READY
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    UNAVAILABLE
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Decoder Engine:</span>
                  <span className="font-mono text-white">jsQR 60FPS</span>
                </div>
                <div className="flex justify-between">
                  <span>Multi-Camera Switch:</span>
                  <span className="font-mono text-white">Available</span>
                </div>
              </div>
            </div>

            {/* 3. GPS */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">GPS / Geolocation</h3>
                    <p className="text-[11px] text-white/50 font-mono">navigator.geolocation</p>
                  </div>
                </div>
                {capabilities.gps ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AVAILABLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    UNAVAILABLE
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Location Source:</span>
                  <span className="font-mono font-bold text-[#3DDCC5]">{capabilities.locationSource}</span>
                </div>
                <div className="flex justify-between">
                  <span>Permission:</span>
                  <span className="font-mono text-white capitalize">{capabilities.locationPermission}</span>
                </div>
              </div>
            </div>

            {/* 4. NFC */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Web NFC</h3>
                    <p className="text-[11px] text-white/50 font-mono">NDEFReader API</p>
                  </div>
                </div>
                {capabilities.nfc ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    SUPPORTED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    UNSUPPORTED
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Platform Requirement:</span>
                  <span className="font-mono text-white">Android Chrome</span>
                </div>
                <div className="flex justify-between">
                  <span>Fallback State:</span>
                  <span className="font-mono text-white">QR / Manual Fallback</span>
                </div>
              </div>
            </div>

            {/* 5. TORCH */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Torch / Flashlight</h3>
                    <p className="text-[11px] text-white/50 font-mono">Track Advanced Constraint</p>
                  </div>
                </div>
                {capabilities.torch ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AVAILABLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    UNSUPPORTED
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Control Method:</span>
                  <span className="font-mono text-white">Video Track Torch</span>
                </div>
              </div>
            </div>

            {/* 6. VIBRATION */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Haptic Vibration</h3>
                    <p className="text-[11px] text-white/50 font-mono">navigator.vibrate</p>
                  </div>
                </div>
                {capabilities.vibration ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AVAILABLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    UNSUPPORTED
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Haptic Feedback:</span>
                  <span className="font-mono text-white">Scan Confirmation</span>
                </div>
              </div>
            </div>

            {/* 7. INTERNET */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    {capabilities.online ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Internet Connectivity</h3>
                    <p className="text-[11px] text-white/50 font-mono">navigator.onLine</p>
                  </div>
                </div>
                {capabilities.online ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ONLINE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    OFFLINE
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Sync Queue Engine:</span>
                  <span className="font-mono text-white">Offline-First Auto Sync</span>
                </div>
              </div>
            </div>

            {/* 8. SERVICE WORKER */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Service Worker PWA</h3>
                    <p className="text-[11px] text-white/50 font-mono">serviceWorker</p>
                  </div>
                </div>
                {capabilities.serviceWorker ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    INACTIVE
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>PWA Installable:</span>
                  <span className="font-mono text-white">Supported</span>
                </div>
              </div>
            </div>

            {/* 9. SECURE CONTEXT */}
            <div className="p-4 rounded-xl bg-[#12181A] border border-white/10 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3DDCC5]/10 text-[#3DDCC5]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Secure Context</h3>
                    <p className="text-[11px] text-white/50 font-mono">window.isSecureContext</p>
                  </div>
                </div>
                {capabilities.secureContext ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    HTTPS (SECURE)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    HTTP RESTRICTED
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs flex flex-col gap-1 text-white/70">
                <div className="flex justify-between">
                  <span>Protocol:</span>
                  <span className="font-mono text-white">{window.location.protocol}</span>
                </div>
              </div>
            </div>

          </div>

          {/* GPS Live Probe Result */}
          {gpsTestResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              gpsTestResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
            }`}>
              {gpsTestResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs flex-1">
                <h4 className="font-bold uppercase tracking-wide text-white">
                  Live GPS Sensor Probe Test
                </h4>
                {gpsTestResult.success ? (
                  <div className="mt-1 font-mono text-emerald-300 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>Lat: {gpsTestResult.lat.toFixed(5)}</div>
                    <div>Lon: {gpsTestResult.lng.toFixed(5)}</div>
                    <div>Accuracy: {gpsTestResult.accuracy}m</div>
                    <div>Source: {gpsTestResult.source}</div>
                  </div>
                ) : (
                  <div className="mt-1 text-red-300 font-mono">
                    Failed: {gpsTestResult.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HARDWARE LOGS */}
      {activeSubTab === 'logs' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3DDCC5]" />
              Structured Hardware & Error Event Log
            </h3>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Logs
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center bg-[#12181A] rounded-xl border border-white/10 text-white/40 text-xs">
              No hardware errors or diagnostic events recorded.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-[#12181A] rounded-lg border border-white/5 text-xs font-mono flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-white/10 text-[#3DDCC5] font-bold rounded text-[10px]">
                      {log.code}
                    </span>
                    <span className="text-white/40 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-white/90 font-sans mt-1">{log.message}</div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-[10px] text-white/40 mt-0.5">
                      Details: {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REAL DEVICE FIELD SETUP GUIDE */}
      {activeSubTab === 'guidance' && (
        <div className="flex flex-col gap-4 text-xs text-white/80 leading-relaxed bg-[#12181A] p-6 rounded-xl border border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-[#3DDCC5]" />
            Real Mobile Device Field Setup Instructions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div className="p-4 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-2">
              <h4 className="font-bold text-[#3DDCC5] uppercase tracking-wide">Android Setup (Google Chrome)</h4>
              <ol className="list-decimal list-inside flex flex-col gap-1.5 text-white/70">
                <li>Ensure device is connected over HTTPS or secure network.</li>
                <li>When prompted, tap <strong>Allow</strong> for Camera and Location permissions.</li>
                <li>To enable Web NFC: ensure NFC is turned ON in Android Settings, and tap <strong>Allow</strong> on Chrome's NFC prompt.</li>
                <li>If permission was previously denied: tap Chrome menu (⋮) → Settings → Site Settings → Camera / Location → Allow.</li>
              </ol>
            </div>

            <div className="p-4 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-2">
              <h4 className="font-bold text-[#3DDCC5] uppercase tracking-wide">iPhone Setup (Apple Safari)</h4>
              <ol className="list-decimal list-inside flex flex-col gap-1.5 text-white/70">
                <li>Open PatrolIQ in Safari on iOS 15+.</li>
                <li>Tap <strong>Allow</strong> when Safari asks for Camera and Precise Location permissions.</li>
                <li>Note: Web NFC (`NDEFReader`) is not supported by WebKit on Safari iOS. PatrolIQ automatically defaults to rear QR scanning or manual code entry.</li>
                <li>If camera is blocked: go to iPhone Settings → Safari → Camera → Allow.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
