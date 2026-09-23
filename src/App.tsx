import { useState } from 'react'
import { Phone, Ruler, FileText, Settings } from 'lucide-react'
import { MASON_YOUNG_LOGO_BASE64 } from './assets/logoBase64'
import PropertyReports from './components/PropertyReports/PropertyReports'

type Tab = 'enquiries' | 'floorplans' | 'reports'

const TABS: { id: Tab; label: string; icon: typeof Phone }[] = [
  { id: 'enquiries', label: 'Enquiries', icon: Phone },
  { id: 'floorplans', label: 'Floor Plans', icon: Ruler },
  { id: 'reports', label: 'Property Reports', icon: FileText },
]

function Placeholder({ name }: { name: string }) {
  return (
    <div className="max-w-3xl mx-auto mt-10 rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
      <p className="font-semibold text-my-black mb-1">{name}</p>
      <p className="text-sm">
        This tab wasn't part of this build — it's a placeholder until the original tool is reconnected.
      </p>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('reports')

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={MASON_YOUNG_LOGO_BASE64} alt="Mason Young" className="h-9 w-auto" />
            <span className="text-sm text-gray-500 hidden sm:inline">Admin Portal</span>
          </div>
          <button className="text-gray-400 hover:text-gray-600" aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
        <nav className="max-w-6xl mx-auto flex gap-8 px-6">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-my-red text-my-red'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="px-4 py-6">
        {tab === 'enquiries' && <Placeholder name="Enquiries" />}
        {tab === 'floorplans' && <Placeholder name="Floor Plans" />}
        {tab === 'reports' && <PropertyReports />}
      </main>

      <footer className="text-center text-xs text-gray-400 pb-6">
        Internal tool — not part of the public masonyoung.co.uk website.
      </footer>
    </div>
  )
}
