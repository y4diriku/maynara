"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  QrCode, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  Shirt, 
  Calendar, 
  AlertCircle,
  Clock,
  Printer,
  Scissors,
  CheckCheck
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  fabric_type: string
  collar_type: string
  total_qty: number
  current_status: string
  priority: string
  deadline_date: string
  is_makloon?: boolean
  makloon_vendor_name?: string | null
}

const STAGES = [
  { key: "DESIGN_QUEUE", label: "Antrean Desain", next: "PRINTING", nextLabel: "Cetak & Sublim" },
  { key: "PRINTING", label: "Cetak & Sublim", next: "CUTTING", nextLabel: "Cutting Pola" },
  { key: "CUTTING", label: "Cutting Pola", next: "SEWING", nextLabel: "Lini Jahit" },
  { key: "SEWING", label: "Lini Jahit", next: "QC_PACKING", nextLabel: "QC & Packing" },
  { key: "QC_PACKING", label: "QC & Packing", next: "READY_FOR_DELIVERY", nextLabel: "Siap Diambil" },
  { key: "READY_FOR_DELIVERY", label: "Siap Diambil", next: "COMPLETED", nextLabel: "Pesanan Selesai" },
]

function formatDateID(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

function KioskContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialOrderQuery = searchParams.get("order") || ""

  const [orderNumberInput, setOrderNumberInput] = useState(initialOrderQuery)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  // Status penyelesaian tugas di pos
  const [completedStageInfo, setCompletedStageInfo] = useState<{
    stageFinished: string
    nextStage: string
    operatorName: string
  } | null>(null)

  // Info Operator yang sedang login
  const [operatorInfo, setOperatorInfo] = useState<{ name: string; role: string }>({
    name: "Operator Workshop",
    role: "OPERATOR"
  })

  useEffect(() => {
    async function getOperator() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setOperatorInfo({
            name: profile.full_name || session.user.email?.split("@")[0] || "Operator",
            role: (profile.role || "OPERATOR").toUpperCase()
          })
        }
      }
    }
    getOperator()
  }, [])

  useEffect(() => {
    if (initialOrderQuery) {
      handleLookup(initialOrderQuery)
    }
  }, [initialOrderQuery])

  const handleLookup = async (queryNum?: string) => {
    const target = (queryNum || orderNumberInput).trim()
    if (!target) return

    setLoading(true)
    setMessage(null)
    setCompletedStageInfo(null)

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", target)
        .single()

      if (error || !data) {
        setCurrentOrder(null)
        setMessage({ type: "error", text: `Pesanan "${target}" tidak ditemukan di sistem.` })
      } else {
        setCurrentOrder(data)
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal mencari order" })
    } finally {
      setLoading(false)
    }
  }

  // Proses Selesaikan Pekerjaan & Rekam Audit Trail
  const handleFinishCurrentStage = async () => {
    if (!currentOrder) return
    setUpdating(true)
    setMessage(null)

    const stageConfig = STAGES.find((s) => s.key === currentOrder.current_status)
    if (!stageConfig || !stageConfig.next) {
      setMessage({ type: "info", text: "Pesanan ini sudah mencapai tahap akhir produksi." })
      setUpdating(false)
      return
    }

    const nextStageKey = stageConfig.next
    const finishedLabel = stageConfig.label
    const nextLabel = stageConfig.nextLabel

    try {
      // 1. Update status pesanan ke tahap selanjutnya
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          current_status: nextStageKey,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentOrder.id)

      if (updateErr) throw updateErr

      // 2. Simpan Rekam Jejak Audit Trail (Production Logs)
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from("production_logs").insert({
        order_id: currentOrder.id,
        stage: nextStageKey,
        notes: `Diselesaikan di pos ${finishedLabel} oleh ${operatorInfo.name} (${operatorInfo.role}) dan diserahkan ke ${nextLabel}.`,
        operator_id: session?.user?.id || null
      })

      // 3. Tampilkan Layar Sukses / Handover Feedback (Bukan form lagi!)
      setCompletedStageInfo({
        stageFinished: finishedLabel,
        nextStage: nextLabel,
        operatorName: operatorInfo.name
      })

      setCurrentOrder((prev) => prev ? { ...prev, current_status: nextStageKey } : null)
    } catch (err: any) {
      setMessage({ type: "error", text: "Gagal memperbarui status: " + err.message })
    } finally {
      setUpdating(false)
    }
  }

  const handleScanNext = () => {
    setCurrentOrder(null)
    setCompletedStageInfo(null)
    setOrderNumberInput("")
    setMessage(null)
    router.replace("/kiosk")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12 pt-2">
      {/* Header Pos Scanner */}
      <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black text-zinc-900 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-zinc-800" /> Pos Pemindaian SPK Produksi
          </h1>
          <p className="text-[11px] text-zinc-500">
            Operator: <strong className="text-zinc-800">{operatorInfo.name}</strong> ({operatorInfo.role})
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Scanner Aktif
        </span>
      </div>

      {/* Input Pencarian Manual / Scan Barcode Reader */}
      <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleLookup()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Scan QR Code kamera HP atau ketik no order (cth: JR-2610...)"
            value={orderNumberInput}
            onChange={(e) => setOrderNumberInput(e.target.value)}
            className="flex-1 px-3 py-2 border border-zinc-300 rounded text-xs font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Mencari..." : "Cari SPK"}
          </button>
        </form>
      </div>

      {message && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          message.type === "error"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 1. TAMPILAN SUKSES & SERAH TERIMA TUGAS (HANDOVER SCREEN) */}
      {completedStageInfo ? (
        <div className="border-2 border-emerald-500 bg-emerald-50/60 p-6 rounded-lg shadow-sm text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="h-14 w-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCheck className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-black text-emerald-950 uppercase">
              Tugas di Pos {completedStageInfo.stageFinished} Telah Selesai!
            </h2>
            <p className="text-xs text-emerald-800">
              Audit trail berhasil dicatat oleh PIC: <strong>{completedStageInfo.operatorName}</strong>
            </p>
          </div>

          <div className="border border-emerald-200 bg-white p-3.5 rounded text-xs text-zinc-700 space-y-1.5 max-w-md mx-auto">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
              Instruksi Alur Selanjutnya
            </span>
            <p className="font-semibold text-zinc-900">
              Silakan bawa fisik berkas SPK & kain ke pos:
            </p>
            <div className="inline-block bg-zinc-900 text-white font-black px-3 py-1 rounded text-xs font-mono">
              &rarr; {completedStageInfo.nextStage}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleScanNext}
              className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded text-xs transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pindai SPK Berikutnya</span>
            </button>
          </div>
        </div>
      ) : currentOrder ? (
        /* 2. TAMPILAN RINCIAN SPK YANG SEDANG DIKERJAKAN */
        <div className="border border-zinc-200 bg-white rounded-lg shadow-2xs overflow-hidden">
          {/* Header Kartu SPK */}
          <div className="bg-zinc-900 text-white p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block">
                SURAT PERINTAH KERJA
              </span>
              <strong className="text-sm font-mono tracking-wide">{currentOrder.order_number}</strong>
            </div>
            <div className="text-right">
              <span className="border border-white/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                {currentOrder.priority}
              </span>
            </div>
          </div>

          {/* Rincian Spesifikasi */}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs border-b border-zinc-100 pb-3">
              <div>
                <span className="text-zinc-500 block text-[11px]">Nama Pemesan</span>
                <strong className="text-zinc-900 uppercase font-bold text-xs">{currentOrder.customer_name}</strong>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Target Deadline</span>
                <strong className="text-red-700 font-mono text-xs">{formatDateID(currentOrder.deadline_date)}</strong>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Bahan & Kerah</span>
                <span className="text-zinc-800 font-medium text-xs">{currentOrder.fabric_type} &bull; {currentOrder.collar_type}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Jumlah Pesanan</span>
                <strong className="font-mono text-zinc-900 font-bold text-xs">{currentOrder.total_qty} PCS</strong>
              </div>
            </div>

            {/* Jalur Pengerjaan */}
            {currentOrder.is_makloon && (
              <div className="bg-purple-50 border border-purple-200 p-2.5 rounded text-xs text-purple-900 flex items-center justify-between">
                <span>Jalur Jahit Makloon Luar:</span>
                <strong>{currentOrder.makloon_vendor_name || "Mitra Luar"}</strong>
              </div>
            )}

            {/* Status Saat Ini */}
            <div className="border border-zinc-200 rounded p-3 bg-zinc-50 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Posisi Pengerjaan Saat Ini</span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-zinc-900">
                  {STAGES.find((s) => s.key === currentOrder.current_status)?.label || currentOrder.current_status}
                </span>
                <span className="text-[10px] font-medium text-zinc-500">
                  Target berikutnya: <strong>{STAGES.find((s) => s.key === currentOrder.current_status)?.nextLabel || "Selesai"}</strong>
                </span>
              </div>
            </div>

            {/* TOMBOL PENYELESAIAN TUGAS POS */}
            <div className="pt-2">
              <button
                type="button"
                disabled={updating}
                onClick={handleFinishCurrentStage}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-md text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {updating
                    ? "Menyimpan Catatan & Menyerahkan..."
                    : `Selesaikan Tugas di Pos ${STAGES.find((s) => s.key === currentOrder.current_status)?.label || ""} & Teruskan`}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono">Memuat pemindai SPK...</div>}>
      <KioskContent />
    </Suspense>
  )
}
