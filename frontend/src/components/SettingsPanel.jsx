import { useState, useEffect } from 'react'
import { setup as setupApi } from '../api'

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
      <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-2)', flex:1 }}>{label}</span>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      <div style={{ padding:'11px 14px 10px' }}>
        <div className="label">{title}</div>
      </div>
      <div style={{ padding:'0 14px 12px', display:'flex', flexDirection:'column', gap:10 }}>
        {children}
      </div>
    </div>
  )
}

export default function SettingsPanel({ params, onChange }) {
  const set = (key, val) => onChange({ ...params, [key]: val })
  const [setupPrinters, setSetupPrinters] = useState([])
  const [profiles, setProfiles] = useState({ process_files: [], filament_files: [] })

  useEffect(() => {
    setupApi.list().then(setSetupPrinters).catch(() => {})
  }, [])

  useEffect(() => {
    if (!params.printer_id) {
      setProfiles({ process_files: [], filament_files: [] })
      return
    }
    setupApi.profiles(params.printer_id).then(setProfiles).catch(() => {})
  }, [params.printer_id])

  const handlePrinterChange = (printer_id) => {
    onChange({ printer_id, process_file: '', filament_file: '' })
  }

  const readyPrinters = setupPrinters.filter(p => p.ready)

  return (
    <div style={{ overflowY:'auto', flex:1 }}>
      <Group title="Drucker & Profile">
        <Row label="Drucker">
          <select value={params.printer_id} onChange={e => handlePrinterChange(e.target.value)}
            style={{ width:160, fontSize:10 }}>
            <option value="">– kein Drucker –</option>
            {readyPrinters.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </Row>
        {readyPrinters.length === 0 && (
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', lineHeight:1.6 }}>
            Noch keine Drucker eingerichtet.<br />
            Unter „Drucker" → „Profil-Drucker" einrichten.
          </div>
        )}
        <Row label="Druckprofil">
          <select value={params.process_file} onChange={e => set('process_file', e.target.value)}
            style={{ width:160, fontSize:10 }} disabled={!params.printer_id}>
            <option value="">– kein Profil –</option>
            {profiles.process_files.map(f => (
              <option key={f} value={f}>{f.replace('.json', '')}</option>
            ))}
          </select>
        </Row>
        <Row label="Filament">
          <select value={params.filament_file} onChange={e => set('filament_file', e.target.value)}
            style={{ width:160, fontSize:10 }} disabled={!params.printer_id}>
            <option value="">– kein Filament –</option>
            {profiles.filament_files.map(f => (
              <option key={f} value={f}>{f.replace('.json', '')}</option>
            ))}
          </select>
        </Row>
      </Group>
    </div>
  )
}
