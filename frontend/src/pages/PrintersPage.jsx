import { useState, useEffect } from 'react'
import { printers as printersApi, setup as setupApi } from '../api'

// ── Netzwerk-Drucker ──────────────────────────────────────────────────────────

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

// ── Setup-Drucker (OrcaSlicer-Profile) ───────────────────────────────────────

function SetupPrinterCard({ printer, onDelete, onRefresh }) {
  // Wenn nicht ready: alle 3s pollen bis ready=true
  useEffect(() => {
    if (printer.ready) return
    const t = setInterval(onRefresh, 3000)
    return () => clearInterval(t)
  }, [printer.ready])

  return (
    <div style={{
      background:'var(--bg-2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:14,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{printer.display_name}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em' }}>
            {printer.vendor} · {printer.machine_file.replace('.json', '')}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {printer.ready ? (
            <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--teal)' }}>
              ✓ Bereit · {printer.process_count} Profile · {printer.filament_count} Filamente
            </span>
          ) : (
            <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)' }}>
              ⟳ Wird heruntergeladen…
            </span>
          )}
          <button className="btn btn-danger" style={{ padding:'4px 8px', fontSize:10 }} onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  )
}

function SetupPrinterForm({ onSave, onCancel }) {
  const [vendors, setVendors]     = useState([])
  const [machines, setMachines]   = useState([])
  const [vendor, setVendor]       = useState('')
  const [machineFile, setMachineFile] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [loadingMachines, setLoadingMachines] = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    setupApi.vendors()
      .then(list => { setVendors(list); setLoadingVendors(false) })
      .catch(e => { setError(`Hersteller laden fehlgeschlagen: ${e.message}`); setLoadingVendors(false) })
  }, [])

  const handleVendorChange = async (v) => {
    setVendor(v)
    setMachineFile('')
    setDisplayName('')
    setMachines([])
    if (!v) return
    setLoadingMachines(true)
    try {
      const list = await setupApi.machines(v)
      setMachines(list)
    } catch (e) {
      setError(`Geräte laden fehlgeschlagen: ${e.message}`)
    } finally {
      setLoadingMachines(false)
    }
  }

  const handleMachineChange = (m) => {
    setMachineFile(m)
    setDisplayName(m.replace('.json', ''))
  }

  const handleSubmit = () => {
    if (!vendor || !machineFile || !displayName) return
    onSave({ display_name: displayName, vendor, machine_file: machineFile })
  }

  return (
    <div style={{
      background:'var(--bg-2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:16,
    }}>
      <div className="label" style={{ marginBottom:12 }}>Profil-Drucker einrichten</div>

      {error && (
        <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--red)',
          background:'rgba(232,64,64,.08)', border:'1px solid rgba(232,64,64,.2)',
          borderRadius:'var(--radius)', padding:'6px 10px', marginBottom:10 }}>
          {error}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div>
          <div className="label" style={{ marginBottom:4 }}>Hersteller</div>
          <select value={vendor} onChange={e => handleVendorChange(e.target.value)} disabled={loadingVendors}>
            <option value="">{loadingVendors ? 'Wird geladen…' : '– Hersteller wählen –'}</option>
            {vendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>

        <div>
          <div className="label" style={{ marginBottom:4 }}>Gerät</div>
          <select value={machineFile} onChange={e => handleMachineChange(e.target.value)}
            disabled={!vendor || loadingMachines}>
            <option value="">{loadingMachines ? 'Wird geladen…' : '– Gerät wählen –'}</option>
            {machines.map(m => <option key={m} value={m}>{m.replace('.json', '')}</option>)}
          </select>
        </div>

        <div>
          <div className="label" style={{ marginBottom:4 }}>Name</div>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="z.B. Bambu P1S" disabled={!machineFile} />
        </div>

        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button className="btn btn-primary" style={{ flex:1 }}
            disabled={!vendor || !machineFile || !displayName}
            onClick={handleSubmit}>
            Hinzufügen &amp; Profile herunterladen
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Seite ─────────────────────────────────────────────────────────────────────

export default function PrintersPage() {
  const [tab, setTab] = useState('setup')

  // Netzwerk-Drucker
  const [printerList, setPrinterList] = useState([])
  const [editing, setEditing]   = useState(null)
  const [netError, setNetError] = useState(null)

  // Setup-Drucker
  const [setupList, setSetupList] = useState([])
  const [addingSetup, setAddingSetup] = useState(false)
  const [setupError, setSetupError] = useState(null)

  const refreshNet   = () => printersApi.list().then(setPrinterList).catch(() => {})
  const refreshSetup = () => setupApi.list().then(setSetupList).catch(() => {})

  useEffect(() => { refreshNet(); refreshSetup() }, [])

  const handleNetSave = async (form) => {
    setNetError(null)
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
      refreshNet()
    } catch (e) { setNetError(e.message) }
  }

  const handleNetDelete = async (id) => {
    if (!confirm('Drucker wirklich löschen?')) return
    await printersApi.delete(id)
    refreshNet()
  }

  const handleSetupAdd = async (data) => {
    setSetupError(null)
    try {
      await setupApi.add(data)
      setAddingSetup(false)
      refreshSetup()
    } catch (e) { setSetupError(e.message) }
  }

  const handleSetupDelete = async (id) => {
    if (!confirm('Drucker wirklich löschen?')) return
    await setupApi.delete(id)
    refreshSetup()
  }

  const tabStyle = (t) => ({
    padding:'5px 14px', fontFamily:'var(--mono)', fontSize:10,
    letterSpacing:'.08em', textTransform:'uppercase',
    background: tab === t ? 'var(--accent-glow)' : 'transparent',
    border: `1px solid ${tab === t ? 'var(--accent-dim)' : 'var(--border)'}`,
    borderRadius:'var(--radius)', cursor:'pointer',
    color: tab === t ? 'var(--accent)' : 'var(--text-2)',
    transition:'all .15s',
  })

  return (
    <div style={{ flex:1, overflowY:'auto', padding:16 }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Tabs */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:6 }}>
            <button style={tabStyle('setup')} onClick={() => setTab('setup')}>Profil-Drucker</button>
            <button style={tabStyle('network')} onClick={() => setTab('network')}>Netzwerk</button>
          </div>
          {tab === 'setup' && !addingSetup && (
            <button className="btn btn-primary" style={{ padding:'6px 14px' }} onClick={() => setAddingSetup(true)}>
              + Drucker einrichten
            </button>
          )}
          {tab === 'network' && editing !== 'new' && (
            <button className="btn btn-primary" style={{ padding:'6px 14px' }} onClick={() => setEditing('new')}>
              + Drucker hinzufügen
            </button>
          )}
        </div>

        {/* ── Profil-Drucker Tab ── */}
        {tab === 'setup' && (
          <>
            {setupError && (
              <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--red)',
                background:'rgba(232,64,64,.08)', border:'1px solid rgba(232,64,64,.2)',
                borderRadius:'var(--radius)', padding:'8px 12px' }}>
                {setupError}
              </div>
            )}

            {addingSetup && (
              <SetupPrinterForm
                onSave={handleSetupAdd}
                onCancel={() => setAddingSetup(false)}
              />
            )}

            {setupList.map(p => (
              <SetupPrinterCard key={p.id} printer={p}
                onDelete={() => handleSetupDelete(p.id)}
                onRefresh={refreshSetup}
              />
            ))}

            {setupList.length === 0 && !addingSetup && (
              <div style={{ textAlign:'center', padding:40, fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)' }}>
                Noch keine Profil-Drucker eingerichtet.<br />
                <div style={{ fontFamily:'var(--mono)', fontSize:9, marginTop:8, lineHeight:1.7 }}>
                  Profil-Drucker werden für den Slice benötigt.<br />
                  OrcaSlicer lädt die Profile direkt vom Hersteller.
                </div>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setAddingSetup(true)}>
                  Ersten Drucker einrichten
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Netzwerk Tab ── */}
        {tab === 'network' && (
          <>
            {netError && (
              <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--red)',
                background:'rgba(232,64,64,.08)', border:'1px solid rgba(232,64,64,.2)',
                borderRadius:'var(--radius)', padding:'8px 12px' }}>
                {netError}
              </div>
            )}

            {editing === 'new' && (
              <PrinterForm onSave={handleNetSave} onCancel={() => setEditing(null)} />
            )}

            {printerList.map(p => (
              editing?.id === p.id ? (
                <PrinterForm key={p.id} initial={p} onSave={handleNetSave} onCancel={() => setEditing(null)} />
              ) : (
                <PrinterCard key={p.id} printer={p}
                  onDelete={() => handleNetDelete(p.id)}
                  onEdit={() => setEditing(p)} />
              )
            ))}

            {printerList.length === 0 && editing !== 'new' && (
              <div style={{ textAlign:'center', padding:40, fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)' }}>
                Noch keine Netzwerk-Drucker eingerichtet.<br />
                <div style={{ fontFamily:'var(--mono)', fontSize:9, marginTop:8, lineHeight:1.7 }}>
                  Netzwerk-Drucker werden für die G-Code-Übertragung benötigt.<br />
                  Moonraker (Klipper) oder Bambu Lab LAN-Modus.
                </div>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setEditing('new')}>
                  Ersten Drucker hinzufügen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
