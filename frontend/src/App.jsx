import { useState } from 'react'
import TopBar from './components/TopBar'
import SlicerPage from './pages/SlicerPage'
import PrintersPage from './pages/PrintersPage'

export default function App() {
  const [page, setPage]                   = useState('slicer')
  const [selectedPrinter, setSelectedPrinter] = useState(null)

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <TopBar
        activePage={page}
        onNavigate={setPage}
        selectedPrinter={selectedPrinter}
        onSelectPrinter={setSelectedPrinter}
      />
      {page === 'slicer'    && <SlicerPage selectedPrinter={selectedPrinter} />}
      {page === 'printers'  && <PrintersPage />}
    </div>
  )
}
