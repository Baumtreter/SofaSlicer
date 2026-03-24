import { useState, useEffect } from 'react'
import { printers as printersApi } from '../api'

const statusDot = (status) => {
  const map = { online:'online', printing:'printing', idle:'idle', offline:'offline', error:'error' }
  return <span className={`dot dot-${map[status] ?? 'offline'}`} />
}

export default function TopBar({ activePage, onNavigate, selectedPrinter, onSelectPrinter }) {
  const [printerList, setPrinterList] = useState([])
  const [states, setStates] = useState({})

  useEffect(() => {
    printersApi.list().then(setPrinterList).catch(() => {})
  }, [activePage])   // neu laden wenn von Settings zurückgekehrt

  // Status aller Drucker alle 8s pollen
  useEffect(() => {
    if (!printerList.length) return
    const poll = async () => {
      const results = await Promise.allSettled(printerList.map(p => printersApi.state(p.id)))
      const next = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[printerList[i].id] = r.value
      })
      setStates(next)
    }
    poll()
    const t = setInterval(poll, 8000)
    return () => clearInterval(t)
  }, [printerList])

  const current = printerList.find(p => p.id === selectedPrinter)
  const currentState = current ? states[current.id] : null

  return (
    <header style={{
      height: 52, background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
      position: 'relative', zIndex: 100, flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:15, letterSpacing:'.06em', whiteSpace:'nowrap' }}>
        <div style={{
          width:20, height:20, background:'var(--accent)',
          clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
        }} />
        Sofa<span style={{ color:'var(--accent)' }}>Slicer</span>
      </div>

      <div style={{ width:1, height:24, background:'var(--border)' }} />

      {/* Drucker-Selector */}
      {printerList.length > 0 ? (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {printerList.map(p => {
            const st = states[p.id]
            const active = p.id === selectedPrinter
            return (
              <button key={p.id} onClick={() => onSelectPrinter(p.id)}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  background: active ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `1px solid ${active ? 'var(--accent-dim)' : 'var(--border)'}`,
                  borderRadius:'var(--radius)', padding:'4px 10px', cursor:'pointer',
                  fontFamily:'var(--mono)', fontSize:10, color: active ? 'var(--text-1)' : 'var(--text-2)',
                  transition:'all .15s',
                }}>
                {statusDot(st?.status ?? 'offline')}
                {p.name}
              </button>
            )
          })}
        </div>
      ) : (
        <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)' }}>
          Kein Drucker — <button onClick={() => onNavigate('printers')}
            style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--mono)', fontSize:10 }}>
            jetzt einrichten →
          </button>
        </span>
      )}

      <div style={{ flex:1 }} />

      {/* Temps wenn Drucker aktiv */}
      {currentState && (
        <div style={{ display:'flex', gap:12, fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)' }}>
          {currentState.hotend_temp != null && (
            <span>⬆ <span style={{ color:'var(--accent)' }}>{Math.round(currentState.hotend_temp)}°</span></span>
          )}
          {currentState.bed_temp != null && (
            <span>⬛ <span style={{ color:'var(--teal)' }}>{Math.round(currentState.bed_temp)}°</span></span>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ display:'flex', gap:4 }}>
        {[['slicer','Slicer'],['printers','Drucker']].map(([page, label]) => (
          <button key={page} onClick={() => onNavigate(page)}
            style={{
              padding:'5px 12px', fontFamily:'var(--mono)', fontSize:10,
              letterSpacing:'.08em', textTransform:'uppercase',
              background: activePage === page ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${activePage === page ? 'var(--accent-dim)' : 'transparent'}`,
              borderRadius:'var(--radius)', cursor:'pointer',
              color: activePage === page ? 'var(--accent)' : 'var(--text-2)',
              transition:'all .15s',
            }}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}
