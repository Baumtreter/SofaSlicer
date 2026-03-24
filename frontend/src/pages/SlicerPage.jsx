import FilePanel from '../components/FilePanel'
import SettingsPanel from '../components/SettingsPanel'
import ActionBar from '../components/ActionBar'
import MobileNav from '../components/MobileNav'
import { useState } from 'react'

const DEFAULT_PARAMS = {
  layer_height: 0.20, infill_percent: 15, infill_pattern: 'gyroid',
  perimeters: 3, support: false, support_type: null,
  brim: false, brim_width_mm: 8,
  nozzle_temp: 215, bed_temp: 60, speed_mm_s: 150,
  printer_profile: 'default', filament_profile: 'pla',
}

// Desktop: 3-Spalten. Tablet/Mobile: Tab-basiert
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 860)
  useState(() => {
    const handler = () => setMobile(window.innerWidth < 860)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  })
  return mobile
}

export default function SlicerPage({ selectedPrinter }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [params, setParams]             = useState(DEFAULT_PARAMS)
  const [mobileTab, setMobileTab]       = useState('files')
  const isMobile                        = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Mobile content area */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {mobileTab === 'files' && (
            <FilePanel selectedFile={selectedFile} onSelect={setSelectedFile} />
          )}
          {mobileTab === 'settings' && (
            <SettingsPanel params={params} onChange={setParams} />
          )}
          {mobileTab === 'viewport' && (
            <ViewportPlaceholder filename={selectedFile} />
          )}
          {mobileTab === 'printers' && (
            // Kurzinfo Drucker-Status direkt im Slicer (volle Verwaltung über TopBar-Nav)
            <div style={{ padding:16, fontFamily:'var(--mono)', fontSize:11, color:'var(--text-2)' }}>
              Drucker-Verwaltung über das Menü oben.
            </div>
          )}
        </div>

        {/* ActionBar immer sichtbar */}
        <ActionBar selectedFile={selectedFile} params={params} selectedPrinter={selectedPrinter} />

        {/* Mobile Nav */}
        <MobileNav activeTab={mobileTab} onTab={setMobileTab} />
      </div>
    )
  }

  // Desktop: 3-Spalten
  return (
    <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr 300px', overflow:'hidden' }}>
      {/* Links: Dateien */}
      <div style={{ background:'var(--bg-1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <FilePanel selectedFile={selectedFile} onSelect={setSelectedFile} />
      </div>

      {/* Mitte: Viewport */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <ViewportPlaceholder filename={selectedFile} />
      </div>

      {/* Rechts: Settings + ActionBar */}
      <div style={{ background:'var(--bg-1)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <SettingsPanel params={params} onChange={setParams} />
        <ActionBar selectedFile={selectedFile} params={params} selectedPrinter={selectedPrinter} />
      </div>
    </div>
  )
}

function ViewportPlaceholder({ filename }) {
  return (
    <div style={{
      flex:1, background:'var(--bg-0)', position:'relative',
      display:'flex', alignItems:'center', justifyContent:'center',
      overflow:'hidden',
    }}>
      {/* Grid */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(var(--bg-1) 1px,transparent 1px),linear-gradient(90deg,var(--bg-1) 1px,transparent 1px)',
        backgroundSize:'40px 40px', opacity:.4,
      }} />
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse at center, transparent 30%, var(--bg-0) 100%)',
      }} />

      {filename ? (
        <div style={{ position:'relative', textAlign:'center' }}>
          {/* Isometrisches Box-Icon */}
          <svg viewBox="-80 -80 160 160" width="200" height="200" style={{ filter:'drop-shadow(0 0 20px rgba(245,98,15,0.2))' }}>
            <polygon points="-50,-50 0,-75 50,-50 50,50 0,75 -50,50" fill="#0D0500" stroke="#2A1005" strokeWidth="0.5"/>
            <polygon points="-50,-50 0,-75 0,25 -50,50" fill="#3A1508" stroke="#F5620F" strokeWidth="0.5"/>
            <polygon points="0,-75 50,-50 50,50 0,25" fill="#1E0A04" stroke="#7A3108" strokeWidth="0.5"/>
            <polygon points="-50,-50 0,-75 50,-50 0,-25" fill="#F5620F" stroke="#F5620F" strokeWidth="1" opacity=".85"/>
          </svg>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-2)', marginTop:8 }}>
            {filename}
          </div>
        </div>
      ) : (
        <div style={{ position:'relative', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:36, opacity:.15 }}>◈</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text-2)' }}>Datei auswählen</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)', lineHeight:1.7 }}>
            STL oder 3MF aus der Dateiliste wählen<br />
            oder URL einfügen
          </div>
          <div style={{ display:'flex', gap:6, marginTop:4 }}>
            {['STL','3MF','OBJ'].map(f => (
              <span key={f} style={{
                padding:'3px 8px', border:'1px solid var(--border)', borderRadius:3,
                fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', textTransform:'uppercase',
              }}>{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
