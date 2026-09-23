import type { ChangeEvent } from 'react'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-my-red/40 focus:border-my-red"
      />
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-my-red/40 focus:border-my-red"
      />
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export function RadioCards<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; title: string; desc: string }[]
}) {
  return (
    <div className="mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(opt => {
          const active = value === opt.value
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-md border px-3 py-2 transition-colors ${
                active ? 'border-my-red bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <span className={`block text-sm font-semibold ${active ? 'text-my-red' : 'text-my-black'}`}>{opt.title}</span>
              <span className="block text-xs text-gray-500">{opt.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
