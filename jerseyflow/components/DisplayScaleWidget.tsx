"use client"

import { useEffect, useState, useRef } from "react"
import { Type, Check, X } from "lucide-react"

type ScaleMode = "100" | "112" | "125"

const SCALE_OPTIONS: { key: ScaleMode; label: string; zoom: string; desc: string }[] = [
  { key: "100", label: "Ringkas (100%)", zoom: "1", desc: "Standar bawaan & padat kartu" },
  { key: "112", label: "Nyaman (112%)", zoom: "1.12", desc: "Rekomendasi layar laptop" },
  { key: "125", label: "Besar (125%)", zoom: "1.25", desc: "Monitor & baca jarak jauh" },
]

export default function DisplayScaleWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentScale, setCurrentScale] = useState<ScaleMode>("100")
  const popoverRef = useRef<HTMLDivElement>(null)

  // 1. Muat skala tersimpan saat pertama kali dibuka
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jerseyflow_display_scale") as ScaleMode | null
      if (saved && (saved === "100" || saved === "112" || saved === "125")) {
        setCurrentScale(saved)
        applyZoom(saved)
      }
    } catch {}
  }, [])

  // 2. Tutup popover jika mengklik di luar area widget
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const applyZoom = (mode: ScaleMode) => {
    const opt = SCALE_OPTIONS.find((s) => s.key === mode)
    if (opt && typeof document !== "undefined") {
      (document.documentElement.style as any).zoom = opt.zoom
    }
  }

  const handleSelectMode = (mode: ScaleMode) => {
    setCurrentScale(mode)
    applyZoom(mode)
    try {
      localStorage.setItem("jerseyflow_display_scale", mode)
    } catch {}
    setIsOpen(false)
  }

  return (
    <div ref={popoverRef} className="fixed bottom-4 right-4 z-40 print:hidden select-none">
      {/* Popover Menu Pilihan Ukuran */}
      {isOpen && (
        <div className="absolute bottom-11 right-0 w-60 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-lg shadow-xl p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-zinc-600" />
              Ukuran Tampilan
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {SCALE_OPTIONS.map((opt) => {
              const isSelected = currentScale === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectMode(opt.key)}
                  className={`w-full text-left p-2 rounded flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white shadow-2xs font-bold"
                      : "hover:bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <div>
                    <span className="text-xs block leading-tight">{opt.label}</span>
                    <span className={`text-[9.5px] block leading-tight ${isSelected ? "text-zinc-300 font-normal" : "text-zinc-500"}`}>
                      {opt.desc}
                    </span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
                </button>
              )
            })}
          </div>

          <div className="pt-1 border-t border-zinc-100 text-[9px] text-zinc-400 font-mono text-center">
            Tersimpan otomatis di browser ini
          </div>
        </div>
      )}

      {/* Tombol Mungil Melayang [ A± ] */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 rounded-full bg-white/90 hover:bg-white backdrop-blur-sm border border-zinc-300/90 hover:border-zinc-400 text-zinc-700 hover:text-zinc-950 flex items-center justify-center shadow-md transition-all active:scale-95"
        title="Sesuaikan Skala Tampilan (Ukuran Teks)"
      >
        <span className="text-[11px] font-black font-sans leading-none flex items-center gap-0.2">
          <span>A</span>
          <span className="text-[8px] font-bold text-zinc-500">±</span>
        </span>
      </button>
    </div>
  )
}
