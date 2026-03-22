'use client'

import { useState } from 'react'
import ListaTurni from '@/components/admin/turni/ListaTurni'
import type { Shift, User } from '@/lib/supabase/types'

interface TurniCollapsibiliProps {
  initialShifts: Shift[]
  initialMonth: number  // 0-based (same as Date.getMonth())
  initialYear: number
  initialLocked: boolean
  users: User[]
  shiftCount: number
}

export default function TurniCollapsibili({
  initialShifts,
  initialMonth,
  initialYear,
  initialLocked,
  users,
  shiftCount,
}: TurniCollapsibiliProps) {
  const [open, setOpen] = useState(false)

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.nome]))
  const enriched = initialShifts.map((s) => ({
    ...s,
    userName: userMap.get(s.user_id) ?? s.user_nome ?? s.user_id,
    createdByName: userMap.get(s.created_by) ?? s.created_by,
  }))

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100" aria-labelledby="turni-heading">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 rounded-2xl"
        aria-expanded={open}
        aria-controls="turni-body"
      >
        <div>
          <h2 id="turni-heading" className="text-base font-semibold text-gray-900">Turni assegnati</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {shiftCount > 0 ? `${shiftCount} turni questo mese` : 'Nessun turno questo mese'}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div id="turni-body" className="px-5 pb-5 border-t border-gray-100 pt-4">
          <ListaTurni
            initialShifts={enriched}
            initialMonth={initialMonth}
            initialYear={initialYear}
            initialLocked={initialLocked}
            users={users}
          />
        </div>
      )}
    </section>
  )
}
