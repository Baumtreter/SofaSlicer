import { useState, useEffect } from 'react'
import { printers as printersApi } from '../api'

const EMPTY = {
  name: '', protocol: 'moonraker', host: '',
  port: 7125, moonraker_api_key: '', serial: '', access_code: '',
}

function statusLabel(status) {
  const map = { online:'Online', printing:'Druckt', idle:'Bereit', offline:'Offline', error:'Fehler' }
  return map[status] ?? status
}

function PrinterCard({ printer, onDelete, onEdit }) {
  const [state, setState]   = useState(null)
  const [testing, setTesting] = useState(false)

  const test = async () => {
    setTesting(true)
    try { setState(await printersApi.state(printer.id)) }
    catch (e) { setState({ status:'error', message: e.message }) }
    finally { setTesting(false) }
  }

  const statusColor = { online:'var(--teal)', printing:'var(--accent)', idle:'var(--yellow)',
    offline:'var(--text-3)', error:'var(--red)' }

  return (
    <div style={{
      background:'var(--bg-2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:14,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{printer.name}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em' }}>
            {printer.protocol} · {printer.host}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:10 }} onClick={onEdit}>Bearbeiten</button>
          <button className="btn btn-danger" style={{ padding:'4px 8px', fontSize:10 }} onClick={onDelete}>✕</button>
        </div>
      </div>

      {/* Verbindung testen */}
      <button className="btn btn-ghost" style={{ width:'100%', marginBottom: state ? 8 : 0 }}
        disabled={testing} onClick={test}>
        {testing ? '⟳ Verbinde…' : '⚡ Verbindung testen'}
      </button>

      {state && (
        <div style={{
          background:'var(--bg-0)', border:'1px solid var(--border)',
          borderRadius:'var(--radius)', padding:'8px 10px', marginTop:8,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: state.hotend_temp != null ? 8 : 0 }}>
            <span className={`dot dot-${state.status}`} />
            <span style={{ fontFamily:'var(--mono)', fontSize:10,
              color: statusColor[state.status] ?? 'var(--text-2)' }}>
              {statusLabel(state.status)}
            </span>
            {state.message && (
              <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', marginLeft:4 }}>
                — {state.message}
              </span>
            )}
          </div>
          {state.hotend_temp != null && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[
                ['Hotend', `${Math.round(state.hotend_temp)}°C`, 'var(--accent)'],
                ['Heizbett', `${Math.round(state.bed_temp)}°C`, 'var(--teal)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background:'var(--bg-1)', borderRadius:3, padding:'5px 8px', border:'1px solid var(--border)' }}>
                  <div className="label" style={{ marginBottom:2 }}>{label}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:500, color }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PrinterForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isBambu = form.protocol === 'bambu'

  return (
    <div style={{
      background:'var(--bg-2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:16,
    }}>
      <div className="label" style={{ marginBottom:12 }}>
        {initial ? 'Drucker bearbeiten' : 'Neuer Drucker'}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div>
          <div className="label" style={{ marginBottom:4 }}>Name</div>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Bambu P1S" />
        </div>

        <div>
          <div className="label" style={{ marginBottom:4 }}>Protokoll</div>
          <select value={form.protocol} onChange={e => {
            set('protocol', e.target.value)
            set('port', e.target.value === 'bambu' ? 8883 : 7125)
          }}>
            <option value="moonraker">Moonraker (Klipper) — Creality K1 Max, Snapmaker U1</option>
            <option value="bambu">Bambu Lab — P1S, A1, X1C</option>
          </select>
        </div>

        <div>
          <div className="label" style={{ marginBottom:4 }}>IP-Adresse</div>
          <input value={form.host} onChange={e => set('host', e.target.value)} placeholder="192.168.1.XXX" />
        </div>

        {!isBambu && (
          <>
            <div>
              <div className="label" style={{ marginBottom:4 }}>Port</div>
              <input type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} />
            </div>
            <div>
              <div className="label" style={{ marginBottom:4 }}>API-Key <span style={{ color:'var(--text-3)' }}>(optional)</span></div>
              <input value={form.moonraker_api_key} onChange={e => set('moonraker_api_key', e.target.value)}
                placeholder="Nur nötig wenn trusted_clients nicht greift" />
            </div>
          </>
        )}

        {isBambu && (
          <>
            <div>
              <div className="label" style={{ marginBottom:4 }}>Seriennummer</div>
              <input value={form.serial} onChange={e => set('serial', e.target.value)}
                placeholder="z.B. 01P00A330123456" style={{ fontFamily:'var(--mono)' }} />
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', marginTop:4 }}>
                Display → Einstellungen → Geräteinfo
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom:4 }}>LAN-Zugangscode</div>
              <input value={form.access_code} onChange={e => set('access_code', e.target.value)}
                placeholder="8-stelliger Code" style={{ fontFamily:'var(--mono)' }} />
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', marginTop:4 }}>
                Display → Netzwerk → LAN-Modus aktivieren
              </div>
            </div>
          </>
        )}

        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button className="btn btn-primary" style={{ flex:1 }}
            disabled={!form.name || !form.host}
            onClick={() => onSave(form)}>
            Speichern
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

export default function PrintersPage() {
  const [printerList, setPrinterList] = useState([])
  const [editing, setEditing]   = useState(null)   // printer object oder 'new'
  const [error, setError]       = useState(null)

  const refresh = () => printersApi.list().then(setPrinterList).catch(() => {})
  useEffect(() => { refresh() }, [])

  const handleSave = async (form) => {
    setError(null)
    try {
      const clean = {
        ...form,
        moonraker_api_key: form.moonraker_api_key || null,
        serial:      form.serial      || null,
        access_code: form.access_code || null,
      }
      if (editing === 'new') await printersApi.add(clean)
      else                   await printersApi.update(editing.id, { ...clean, id: editing.id })
      setEditing(null)
      refresh()
    } catch (e) { setError(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Drucker wirklich löschen?')) return
    await printersApi.delete(id)
    refresh()
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:16 }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h1 style={{ fontSize:16, fontWeight:800, letterSpacing:'.04em' }}>Drucker verwalten</h1>
          {editing !== 'new' && (
            <button className="btn btn-primary" style={{ padding:'6px 14px' }}
              onClick={() => setEditing('new')}>
              + Drucker hinzufügen
            </button>
          )}
        </div>

        {error && (
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--red)',
            background:'rgba(232,64,64,.08)', border:'1px solid rgba(232,64,64,.2)',
            borderRadius:'var(--radius)', padding:'8px 12px' }}>
            {error}
          </div>
        )}

        {editing === 'new' && (
          <PrinterForm onSave={handleSave} onCancel={() => setEditing(null)} />
        )}

        {printerList.map(p => (
          editing?.id === p.id ? (
            <PrinterForm key={p.id} initial={p} onSave={handleSave} onCancel={() => setEditing(null)} />
          ) : (
            <PrinterCard key={p.id} printer={p}
              onDelete={() => handleDelete(p.id)}
              onEdit={() => setEditing(p)} />
          )
        ))}

        {printerList.length === 0 && editing !== 'new' && (
          <div style={{ textAlign:'center', padding:40, fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)' }}>
            Noch keine Drucker eingerichtet.<br />
            <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setEditing('new')}>
              Ersten Drucker hinzufügen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
