'use client'

import type { Area } from '@/lib/supabase/types'

interface AreaSelectorProps {
  areas: Area[]
  selectedAreaId: string
}

export default function AreaSelector({ areas, selectedAreaId }: AreaSelectorProps) {
  return (
    <form action="/admin/disponibilita" method="get">
      <select
        name="area"
        value={selectedAreaId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Seleziona area"
      >
        {areas.map((area) => (
          <option key={area.id} value={area.id}>{area.nome}</option>
        ))}
      </select>
    </form>
  )
}
