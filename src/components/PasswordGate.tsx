import { useState, type FormEvent, type ReactNode } from 'react'
import { MASON_YOUNG_LOGO_BASE64 } from '../assets/logoBase64'

const SITE_PASSWORD = '2323'

// Not stored anywhere (no localStorage/cookie) — the password is required
// again on every fresh page load, as requested.
export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (value === SITE_PASSWORD) {
      setUnlocked(true)
    } else {
      setError(true)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <img src={MASON_YOUNG_LOGO_BASE64} alt="Mason Young" className="h-10 w-auto mx-auto mb-6" />
        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1">Enter password</span>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setError(false)
            }}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-my-red/40 focus:border-my-red'
            }`}
          />
        </label>
        {error && <p className="text-sm text-red-600 mb-4">Incorrect password.</p>}
        <button type="submit" className="w-full bg-my-red hover:bg-my-red-dark text-white font-semibold rounded-md px-4 py-2 text-sm">
          Enter
        </button>
      </form>
    </div>
  )
}
