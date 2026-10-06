"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Shirt, 
  Calendar, 
  PackageCheck, 
  Sparkles,
  Search
} from "lucide-react"

const STAGES = [
  { key: "DESIGN_QUEUE", label: "Antrean & Approval Desain", desc: "Setting pola layout & mockup jersey." },
  { key: "PRINTING", label: "Cetak & Press Sublim", desc: "Transfer gambar ke serat kain sublimasi." },
  { key: "CUTTING", label: "Potong Pola", desc: "Pemotongan kain sesuai pola ukuran." },
  { key: "SEWING", label: "Lini Penjahitan", desc: "Perakitan kerah, badan, dan manset lengan." },
  { key: "QC_PACKING", label: "Quality Control & Packing", desc: "Pengecekan kelengkapan nomor & pengemasan." },
  { key: "READY_FOR_DELIVERY", label: "Siap Diambil / Dikirim", desc: "Pesanan selesai dan siap serah terima." },
]

export default function PublicTrackingPage() {
  const params = useParams()
  const rawOrderNumber = params?.order_number as string

  const [order, setOrder] = useState<any>(null)
  const [roster, setRoster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPublicData() {
      if (!rawOrderNumber) return
      setLoading(true)

      const { data: oData } = await supabase
        .from("orders")
        .select("order_number, customer_name, total_qty, fabric_type, collar_type, current_status, deadline_date, created_at")
        .eq("order_number", rawOrderNumber)
        .single()

      if (oData) {
        setOrder(oData)
        // Ambil data roster (nama, nomor, size saja)
        const { data: oFull } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", rawOrderNumber)
          .single()

        if (oFull) {
          const { data: rData } = await supabase
            .from("order_roster_items")
            .select("player_name, back_number, size, sleeve_type")
            .eq("order_id", oFull.id)
          if (rData) setRoster(rData)
        }
      }
      setLoading(false)
    }

    loadPublicData()
  }, [rawOrderNumber])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-zinc-600 font-mono">Memuat status pesanan...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded p-6 text-center space-y-3 shadow-2xs">
          <div className="h-10 w-10 bg-zinc-100 rounded flex items-center justify-center mx-auto text-zinc-400">
            <Search className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">Pesanan Tidak Ditemukan</h2>
          <p className="text-xs text-zinc-600">
            Nomor resi pesanan <span className="font-mono font-semibold text-zinc-800">{rawOrderNumber}</span> tidak terdaftar dalam sistem.
          </p>
        </div>
      </div>
    )
  }

  const currentStageIndex = STAGES.findIndex((s) => s.key === order.current_status)

  return (
    <div className="min-h-screen bg-zinc-100/60 text-zinc-900 py-6 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-2.5 py-1 rounded text-xs font-bold tracking-tight">
            <span>MANAYRA</span>
          </div>
          <h1 className="text-sm font-bold text-zinc-800">Pelacakan Status Produksi</h1>
        </div>

        {/* Ringkasan Kartu Order */}
        <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-start border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[10px] text-zinc-600 uppercase font-mono">No. Pesanan</span>
              <div className="text-sm font-mono font-bold text-zinc-900">{order.order_number}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-600 uppercase font-mono block">Estimasi Selesai</span>
              <span className="text-xs font-mono font-bold text-zinc-900">{order.deadline_date}</span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-zinc-900">{order.customer_name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span className="flex items-center gap-1">
                <Shirt className="h-3 w-3 text-zinc-500" /> {order.fabric_type}
              </span>
              <span>&bull;</span>
              <span>{order.collar_type}</span>
              <span>&bull;</span>
              <strong className="font-mono text-zinc-900">{order.total_qty} PCS</strong>
            </div>
          </div>
        </div>

        {/* Visual Progress Stepper */}
        <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Perjalanan Tahapan Pengerjaan
          </h3>

          <div className="space-y-4">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex
              const isFuture = idx > currentStageIndex

              return (
                <div key={stage.key} className="flex gap-3 relative">
                  {/* Garis penghubung vertikal */}
                  {idx !== STAGES.length - 1 && (
                    <div 
                      className={`absolute left-[11px] top-6 bottom-[-16px] w-[2px] ${
                        isPast ? "bg-emerald-500" : "bg-zinc-200"
                      }`} 
                    />
                  )}

                  {/* Icon Status */}
                  <div className="shrink-0 mt-0.5 z-10 bg-white">
                    {isPast ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : isCurrent ? (
                      <div className="h-5 w-5 rounded-full border-2 border-zinc-900 flex items-center justify-center bg-zinc-900 text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                      </div>
                    ) : (
                      <Circle className="h-5 w-5 text-zinc-300" />
                    )}
                  </div>

                  {/* Konten Tahapan */}
                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold leading-tight ${
                        isCurrent ? "text-zinc-900" : isPast ? "text-zinc-800" : "text-zinc-600"
                      }`}>
                        {stage.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold bg-zinc-900 text-white px-2 py-0.5 rounded-full animate-pulse">
                          Sedang Dikerjakan
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isCurrent ? "text-zinc-600" : "text-zinc-600"}`}>
                      {stage.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rincian Roster Jersey */}
        {roster.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Roster & Ukuran Terdaftar ({roster.length} Jersey)
            </h3>
            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 text-xs">
              {roster.map((r, i) => (
                <div key={i} className="py-1.5 flex justify-between items-center text-[11px]">
                  <span>{i + 1}. <strong className="uppercase">{r.player_name}</strong> {r.back_number !== "-" ? `(#${r.back_number})` : ""}</span>
                  <span className="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    {r.size} &bull; {r.sleeve_type === "LONG" ? "PJG" : "PDK"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-600">
            Sistem Pemantauan Produksi &bull; Diperbarui secara otomatis
          </p>
        </div>
      </div>
    </div>
  )
}
