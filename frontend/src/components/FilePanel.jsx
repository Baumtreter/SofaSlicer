import { useState, useEffect, useRef } from 'react'
import { files as filesApi } from '../api'

const EXT_ICON = { stl: '◼', '3mf': '◈', obj: '◉' }

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FilePanel({ selectedFile, onSelect }) {
  const [tab, setTab]         = useState('printables')
  const [fileList, setFileList] = useState([])
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const fileInputRef          = useRef()

  const refresh = () => filesApi.list().then(setFileList).catch(() => {})

  useEffect(() => { refresh() }, [])

  const handleUrl = async () => {
    if (!url.trim()) return
    setLoading(true); setError(null)
    try {
      const result = await filesApi.fetchUrl(url.trim())
      setUrl('')
      await refresh()
      onSelect(result.filename)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null)
    try {
      const result = await filesApi.upload(file)
      await refresh()
      onSelect(result.filename)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const handleDelete = async (filename, ev) => {
    ev.stopPropagation()
    await filesApi.delete(filename)
    if (selectedFile === filename) onSelect(null)
    refresh()
  }

  const ext = (name) => name.split('.').pop().toLowerCase()

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Source tabs */}
      <div className="panel-section">
        <div className="label" style={{ marginBottom:8 }}>Datei-Quelle</div>
        <div style={{
          display:'flex', gap:2, background:'var(--bg-0)',
          borderRadius:'var(--radius)', padding:2, marginBottom:10,
        }}>
          {[['printables','Printables'],['upload','Upload']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                flex:1, padding:'5px 4px', fontFamily:'var(--mono)', fontSize:9,
                letterSpacing:'.06em', textTransform:'uppercase',
                background: tab === id ? 'var(--bg-3)' : 'transparent',
                border: `1px solid ${tab === id ? 'var(--border)' : 'transparent'}`,
                borderRadius:3, cursor:'pointer',
                color: tab === id ? 'var(--accent)' : 'var(--text-3)',
                transition:'all .15s',
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'printables' && (
          <div style={{ display:'flex', gap:4 }}>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrl()}
              placeholder="Direktlink zur .stl / .3mf Datei"
              style={{ flex:1 }}
            />
            <button className="btn btn-primary" onClick={handleUrl}
              disabled={loading || !url.trim()}
              style={{ padding:'6px 10px', fontSize:11 }}>
              {loading ? '…' : '↓'}
            </button>
          </div>
        )}

        {tab === 'upload' && (
          <>
            <input ref={fileInputRef} type="file" accept=".stl,.3mf,.obj"
              style={{ display:'none' }} onChange={handleUpload} />
            <button className="btn btn-ghost" style={{ width:'100%' }}
              onClick={() => fileInputRef.current?.click()} disabled={loading}>
              {loading ? 'Lädt hoch…' : '+ Datei auswählen'}
            </button>
          </>
        )}

        {error && (
          <div style={{ marginTop:6, fontFamily:'var(--mono)', fontSize:9, color:'var(--red)' }}>
            {error}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="panel-section" style={{ border:'none', paddingBottom:4 }}>
        <div className="label">Dateien ({fileList.length})</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'4px 6px' }}>
        {fileList.length === 0 && (
          <div style={{ padding:16, textAlign:'center', fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)' }}>
            Noch keine Dateien
          </div>
        )}
        {fileList.map(f => {
          const active = f.filename === selectedFile
          const icon = EXT_ICON[ext(f.filename)] ?? '▪'
          return (
            <div key={f.filename} onClick={() => onSelect(f.filename)}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                borderRadius:'var(--radius)', cursor:'pointer',
                border: `1px solid ${active ? 'var(--accent-dim)' : 'transparent'}`,
                background: active ? 'var(--bg-3)' : 'transparent',
                marginBottom:2, position:'relative',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                transition:'all .12s',
              }}>
              <div style={{
                width:32, height:32, background:'var(--bg-0)', borderRadius:3,
                border:'1px solid var(--border)', display:'flex', alignItems:'center',
                justifyContent:'center', color:'var(--accent)', fontSize:14, flexShrink:0,
              }}>{icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {f.filename}
                </div>
                <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', marginTop:2 }}>
                  {ext(f.filename).toUpperCase()} · {fmt(f.size)}
                </div>
              </div>
              <button onClick={(e) => handleDelete(f.filename, e)}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--text-3)', fontSize:12, padding:'2px 4px',
                  opacity:0, transition:'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                title="Löschen">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
