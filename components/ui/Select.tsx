'use client'

import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  'aria-label'?: string
  id?: string
  disabled?: boolean
  title?: string
  searchable?: boolean
}

/**
 * Custom select con dropdown renderizzato via Portal su document.body.
 * Risolve il misposizionamento dei <select> nativi in Chrome su Windows
 * (causato da position:fixed negli antenati o dal page zoom ≠ 100%).
 */
export default function Select({
  value,
  onChange,
  options,
  className = '',
  'aria-label': ariaLabel,
  id,
  disabled,
  title,
  searchable,
}: Props) {
  const [open, setOpen] = useState(false)
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Filtra le opzioni in base alla query di ricerca (solo se searchable)
  const filteredOptions = useMemo(
    () =>
      searchable
        ? options.filter((o) =>
            o.label.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : options,
    [options, searchQuery, searchable]
  )

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  const close = useCallback(() => {
    setOpen(false)
    setActiveIdx(-1)
  }, [])

  function openDropdown() {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setTriggerRect(r)
    setOpen(true)
    setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)))
  }

  // Reset ricerca alla chiusura del dropdown
  useEffect(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    if (!open) setSearchQuery('')
  }, [open])

  // Auto-focus sull'input di ricerca all'apertura
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open, searchable])

  function handleTriggerClick() {
    if (open) { close(); return }
    openDropdown()
  }

  function handleSelect(optValue: string) {
    onChange(optValue)
    close()
    triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) { openDropdown(); return }
        setActiveIdx((i) => Math.min(i + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) { openDropdown(); return }
        setActiveIdx((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!open) { openDropdown(); return }
        if (activeIdx >= 0 && activeIdx < filteredOptions.length) {
          handleSelect(filteredOptions[activeIdx].value)
        }
        break
      case 'Escape':
        if (open) { e.preventDefault(); close() }
        break
      case 'Tab':
        if (open) close()
        break
    }
  }

  // Chiudi al click fuori (esclude il trigger e l'intero container del dropdown,
  // incluso l'input di ricerca quando searchable=true)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownContainerRef.current?.contains(e.target as Node)
      ) return
      close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  // Aggiorna posizione al scroll
  useEffect(() => {
    if (!open) return
    function update() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setTriggerRect(r)
    }
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Scroll verso l'opzione attiva nella lista
  useEffect(() => {
    if (!open || activeIdx < 0) return
    const li = listRef.current?.children[activeIdx] as HTMLElement | undefined
    li?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIdx])

  // Calcola posizione dropdown (fixed, viewport-relative)
  const GAP = 4
  const dropdownStyle: React.CSSProperties = triggerRect
    ? (() => {
        const spaceBelow = window.innerHeight - triggerRect.bottom
        const spaceAbove = triggerRect.top
        const base: React.CSSProperties = {
          position: 'fixed',
          left: triggerRect.left,
          minWidth: triggerRect.width,
          maxHeight: '15rem',
          zIndex: 9999,
        }
        return spaceBelow >= 160 || spaceBelow >= spaceAbove
          ? { ...base, top: triggerRect.bottom + GAP }
          : { ...base, bottom: window.innerHeight - triggerRect.top + GAP }
      })()
    : { position: 'fixed', zIndex: 9999 }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex items-center justify-between gap-1.5 ${className}`}
      >
        <span className="truncate min-w-0">{selectedLabel}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && triggerRect && createPortal(
        <div
          ref={dropdownContainerRef}
          className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={dropdownStyle}
        >
          {searchable && (
            <div className="px-2 pt-2 pb-1 border-b border-gray-100">
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setActiveIdx(0) }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filteredOptions.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && activeIdx < filteredOptions.length) { handleSelect(filteredOptions[activeIdx].value) } }
                  if (e.key === 'Escape') { e.preventDefault(); close() }
                }}
                placeholder="Cerca..."
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800"
                aria-label="Cerca opzione"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="py-1 overflow-y-auto"
            style={{ maxHeight: '13rem' }}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 select-none">Nessun risultato</li>
            ) : (
              filteredOptions.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer select-none
                    ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                    ${activeIdx === idx && opt.value !== value ? 'bg-gray-100' : ''}
                  `}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </>
  )
}
