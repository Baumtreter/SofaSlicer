import { useState } from 'react'
import { slice as sliceApi } from '../api'

function fmtTime(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function StatItem({ label, value }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div className="label">{label}</div>
      <div style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:500, color:'var(--teal)' }}>
        {value}
      </div>
    </div>
  )
}

export default function ActionBar({ selectedFile, params, selectedPrinter }) {
  const [job, setJob]       = useState(null)
  const [slicing, setSlicing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError]   = useState(null)

  const canSlice = !!selectedFile && !!params.printer_id && !!params.process_file && !!params.filament_file && !slicing
  const canSend  = job?.status === 'sliced' && !!selectedPrinter && !sending

  const handleSlice = async () => {
    setSlicing(true); setError(null); setJob(null)
    try {
      const newJob = await sliceApi.start(selectedFile, params)
      setJob(newJob)
      await sliceApi.poll(newJob.id, setJob)
    } catch (e) {
      setError(e.message)
    } finally { setSlicing(false) }
  }

  const handleSend = async () => {
    if (!job || !selectedPrinter) return
    setSending(true); setError(null)
    try {
      await sliceApi.send(job.id, selectedPrinter)
      setJob(prev => ({ ...prev, status: 'printing' }))
    } catch (e) {
      setError(e.message)
    } finally { setSending(false) }
  }

  const progress = slicing
    ? (job?.status === 'slicing' ? null : 1)
    : (job?.status === 'sliced' ? 1 : 0)

  return (
    <div style={{
      background:'var(--bg-0)', borderTop:'1px solid var(--border)',
      padding:'10px 14px', display:'flex', flexDirection:'column', gap:8, flexShrink:0,
    }}>
      {/* Stats */}
      {job?.status === 'sliced' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          <StatItem label="Druckzeit"  value={fmtTime(job.print_time_seconds)} />
          <StatItem label="Filament"   value={job.filament_used_mm ? `${(job.filament_used_mm/1000).toFixed(1)}m` : '—'} />
          <StatItem label="Layer"      value={job.layer_count ?? '—'} />
          <StatItem label="Gewicht"    value={job.weight_g ? `${job.weight_g}g` : '—'} />
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height:2, background:'var(--border)', borderRadius:1, overflow:'hidden' }}>
        <div style={{
          height:'100%', background:'var(--accent)',
          borderRadius:1, boxShadow:'0 0 8px var(--accent)',
          width: slicing ? undefined : `${(progress ?? 0) * 100}%`,
          transition: slicing ? 'none' : 'width .4s',
          animation: slicing ? 'progress-pulse 2s ease-in-out infinite' : 'none',
        }} />
      </div>

      <style>{`
        @keyframes progress-pulse {
          0%   { width: 0%; margin-left: 0; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>

      {/* Error */}
      {error && (
        <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--red)', lineHeight:1.5 }}>
          ✕ {error}
        </div>
      )}

      {/* Buttons */}
      <button className="btn btn-primary" style={{ width:'100%', height:42, fontSize:13 }}
        disabled={!canSlice} onClick={handleSlice}>
        {slicing
          ? `⟳ Slice läuft${job?.status === 'slicing' ? '…' : ''}`
          : job?.status === 'sliced' ? '↺ Erneut slicen' : '◆ Jetzt slicen'}
      </button>

      <button className="btn btn-secondary" style={{ width:'100%', height:36 }}
        disabled={!canSend} onClick={handleSend}>
        {sending ? '↗ Wird übertragen…' : '↗ An Drucker senden'}
      </button>

      {!selectedPrinter && (
        <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', textAlign:'center' }}>
          Keinen Drucker ausgewählt
        </div>
      )}
    </div>
  )
}
