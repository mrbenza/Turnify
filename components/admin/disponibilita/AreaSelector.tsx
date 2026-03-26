'use client'

import { useRouter } from 'next/navigation'
import type { Area } from '@/lib/supabase/types'

interface AreaSelectorProps {
  areas: Area[]
  selectedAreaId: string
}

export default function AreaSelector({ areas, selectedAreaId }: AreaSelectorProps) {
  const router = useRouter()

  return (
    <select
      value={selectedAreaId}
      onChange={(e) => router.push(`/admin/disponibilita?area=${e.target.value}`)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-label="Seleziona area"
    >
      {areas.map((area) => (
        <option key={area.id} value={area.id}>{area.nome}</option>
      ))}
    </select>
  )
}
