import type { ReactNode } from 'react'

export default function StepCard({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white mb-4">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-my-red text-white text-xs font-bold shrink-0">
          {number}
        </span>
        <h2 className="font-semibold text-my-black">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
