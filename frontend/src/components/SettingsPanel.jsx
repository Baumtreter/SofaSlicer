const QUALITY = [
  { id: 'draft',   label: 'Draft',   layer: 0.28, icon: '⚡' },
  { id: 'optimal', label: 'Optimal', layer: 0.20, icon: '⚖' },
  { id: 'fine',    label: 'Fine',    layer: 0.12, icon: '◆' },
]

const SUPPORT_TYPES = [
  { id: 'normal',  label: 'Normal' },
  { id: 'tree',    label: 'Tree' },
  { id: 'organic', label: 'Organic' },
]

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
      <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-2)', flex:1 }}>{label}</span>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, unit, min, max, step=1, width=64 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width, textAlign:'right', color:'var(--accent)', padding:'4px 8px' }}
      />
      {unit && <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)' }}>{unit}</span>}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} />
  )
}

function Group({ title, children, defaultOpen = true }) {
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

export default function SettingsPanel({ params, onChange, machineProfiles = [], processProfiles = [], filamentProfiles = [] }) {
  const set = (key, val) => onChange({ ...params, [key]: val })

  const qualityId = QUALITY.find(q => q.layer === params.layer_height)?.id ?? 'custom'

  return (
    <div style={{ overflowY:'auto', flex:1 }}>

      {/* Drucker-Profil */}
      <Group title="Drucker-Profil">
        <Row label="Maschine">
          <select value={params.machine_profile} onChange={e => set('machine_profile', e.target.value)}
            style={{ width:150, fontSize:10 }}>
            <option value="">– kein Profil –</option>
            {machineProfiles.map(p => (
              <option key={p.path} value={p.path}>{p.vendor} · {p.name}</option>
            ))}
          </select>
        </Row>
        <Row label="Prozess">
          <select value={params.process_profile} onChange={e => set('process_profile', e.target.value)}
            style={{ width:150, fontSize:10 }}>
            <option value="">– kein Profil –</option>
            {processProfiles.map(p => (
              <option key={p.path} value={p.path}>{p.vendor} · {p.name}</option>
            ))}
          </select>
        </Row>
      </Group>

      {/* Qualität */}
      <Group title="Druckqualität">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4 }}>
          {QUALITY.map(q => (
            <div key={q.id} onClick={() => set('layer_height', q.layer)}
              style={{
                padding:'8px 6px', background:'var(--bg-0)',
                border:`1px solid ${qualityId === q.id ? 'var(--accent)' : 'var(--border)'}`,
                background: qualityId === q.id ? 'var(--accent-glow)' : 'var(--bg-0)',
                borderRadius:'var(--radius)', textAlign:'center', cursor:'pointer',
                transition:'all .15s',
              }}>
              <div style={{ fontSize:14, marginBottom:3 }}>{q.icon}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, textTransform:'uppercase',
                letterSpacing:'.08em', color: qualityId === q.id ? 'var(--accent)' : 'var(--text-2)' }}>
                {q.label}
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'var(--text-3)', marginTop:2 }}>
                {q.layer}mm
              </div>
            </div>
          ))}
        </div>
        <Row label="Layerhöhe">
          <NumInput value={params.layer_height} onChange={v => set('layer_height', v)}
            unit="mm" min={0.05} max={0.5} step={0.01} width={70} />
        </Row>
      </Group>

      {/* Filament */}
      <Group title="Filament">
        <Row label="Profil">
          <select value={params.filament_profile} onChange={e => set('filament_profile', e.target.value)}
            style={{ width:150, fontSize:10 }}>
            <option value="">– kein Profil –</option>
            {filamentProfiles.map(p => (
              <option key={p.path} value={p.path}>{p.vendor} · {p.name}</option>
            ))}
          </select>
        </Row>
        <Row label="Nozzle-Temp">
          <NumInput value={params.nozzle_temp} onChange={v => set('nozzle_temp', v)} unit="°C" min={150} max={300} width={64} />
        </Row>
        <Row label="Bett-Temp">
          <NumInput value={params.bed_temp} onChange={v => set('bed_temp', v)} unit="°C" min={0} max={120} width={64} />
        </Row>
      </Group>

      {/* Parameter */}
      <Group title="Druckparameter">
        <Row label="Infill">
          <NumInput value={params.infill_percent} onChange={v => set('infill_percent', v)} unit="%" min={0} max={100} width={55} />
        </Row>
        <Row label="Infill-Muster">
          <select value={params.infill_pattern} onChange={e => set('infill_pattern', e.target.value)}
            style={{ width:110 }}>
            <option value="gyroid">Gyroid</option>
            <option value="grid">Grid</option>
            <option value="honeycomb">Honeycomb</option>
            <option value="lines">Lines</option>
            <option value="triangles">Triangles</option>
          </select>
        </Row>
        <Row label="Perimeter">
          <NumInput value={params.perimeters} onChange={v => set('perimeters', v)} min={1} max={10} width={55} />
        </Row>
        <Row label="Geschwindigkeit">
          <NumInput value={params.speed_mm_s} onChange={v => set('speed_mm_s', v)} unit="mm/s" min={10} max={500} width={64} />
        </Row>
      </Group>

      {/* Support & Haftung */}
      <Group title="Support & Haftung">
        <Row label="Support">
          <Toggle value={params.support} onChange={v => set('support', v)} />
        </Row>

        {/* Support-Typ — nur sichtbar wenn Support aktiv */}
        {params.support && (
          <div style={{ display:'flex', gap:4, paddingLeft:0 }}>
            {SUPPORT_TYPES.map(t => (
              <button key={t.id} onClick={() => set('support_type', t.id)}
                style={{
                  flex:1, padding:'5px 4px',
                  fontFamily:'var(--mono)', fontSize:9, textTransform:'uppercase', letterSpacing:'.06em',
                  background: params.support_type === t.id ? 'var(--accent-glow)' : 'var(--bg-0)',
                  border:`1px solid ${params.support_type === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius:'var(--radius)', cursor:'pointer',
                  color: params.support_type === t.id ? 'var(--accent)' : 'var(--text-2)',
                  transition:'all .15s',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <Row label="Brim">
          <Toggle value={params.brim} onChange={v => set('brim', v)} />
        </Row>
        {params.brim && (
          <Row label="Brim-Breite">
            <NumInput value={params.brim_width_mm} onChange={v => set('brim_width_mm', v)} unit="mm" min={1} max={30} width={55} />
          </Row>
        )}
      </Group>

    </div>
  )
}
