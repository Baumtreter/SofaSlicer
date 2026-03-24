export default function MobileNav({ activeTab, onTab }) {
  const tabs = [
    { id: 'files',    icon: '📁', label: 'Dateien' },
    { id: 'settings', icon: '⚙', label: 'Parameter' },
    { id: 'viewport', icon: '◈',  label: 'Vorschau' },
    { id: 'printers', icon: '🖨', label: 'Drucker' },
  ]

  return (
    <nav style={{
      display: 'flex',
      background: 'var(--bg-1)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onTab(t.id)}
          style={{
            flex: 1, padding: '10px 4px 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            borderTop: `2px solid ${activeTab === t.id ? 'var(--accent)' : 'transparent'}`,
            transition: 'all .15s',
          }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: activeTab === t.id ? 'var(--accent)' : 'var(--text-3)',
          }}>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
