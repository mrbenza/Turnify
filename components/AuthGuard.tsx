'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_MINUTES = 60      // logout dopo 60 min di inattività
const WARNING_BEFORE_SECONDS = 60  // avviso 60 sec prima del logout

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

export default function AuthGuard() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_BEFORE_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function resetTimers() {
    // Cancella timers esistenti
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    setShowWarning(false)

    const inactivityMs = INACTIVITY_MINUTES * 60 * 1000
    const warningMs = inactivityMs - WARNING_BEFORE_SECONDS * 1000

    // Timer avviso
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(WARNING_BEFORE_SECONDS)
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => s - 1)
      }, 1000)
    }, warningMs)

    // Timer logout
    timerRef.current = setTimeout(() => {
      logout()
    }, inactivityMs)
  }

  useEffect(() => {
    const supabase = createClient()

    // Ascolta cambi di sessione Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') router.push('/login')
      }
    })

    // Avvia timers inattività (defer per evitare setState sincrono nell'effect)
    const initTimer = setTimeout(resetTimers, 0)
    EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))

    return () => {
      clearTimeout(initTimer)
      subscription.unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimers))
    }
  }, [])

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Sessione in scadenza</h2>
        <p className="text-sm text-gray-500 mb-4">
          Verrai disconnesso tra <strong className="text-amber-600">{secondsLeft}</strong> secondi per inattività.
        </p>
        <div className="flex gap-2">
          <button
            onClick={resetTimers}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Rimani connesso
          </button>
          <button
            onClick={logout}
            className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Esci ora
          </button>
        </div>
      </div>
    </div>
  )
}
