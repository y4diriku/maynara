"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  CheckCircle2, 
  Circle, 
  Shirt, 
  Search, 
  ImageIcon, 
  AlertTriangle, 
  CheckCheck,
  TrendingUp,
  Sparkles
} from "lucide-react"

// 5 MILESTONE PUBLIK KONSUMEN (ABSTRAKSI RAHASIA DAPUR WORKSHOP)
interface CustomerMilestone {
  step: number
  title: string
  desc: string
  associatedStages: string[]
}

const CUSTOMER_MILESTONES: CustomerMilestone[] = [
  {
    step: 1,
    title: "1. Verifikasi Order & Desain",
    desc: "Pengecekan spesifikasi ukuran, brief warna, dan persetujuan mockup desain.",
    associatedStages: ["ORDER_INBOX", "DESIGN_QUEUE"]
  },
  {
    step: 2,
    title: "2. Proses Produksi & Perakitan",
    desc: "Pencetakan motif sublimasi kain, pemotongan pola, dan lini penjahitan.",
    associatedStages: ["PRINTING", "CUTTING", "HEAT_PRESS", "PATTERN_CUTTING", "SEWING"]
  },
  {
    step: 3,
    title: "3. Quality Control & Pengemasan",
    desc: "Pemeriksaan standar mutu jahitan, buang sisa benang, dan pengemasan rapi.",
    associatedStages: ["QC_PACKING"]
  },
  {
    step: 4,
    title: "4. Siap Diambil / Dikirim",
    desc: "Pesanan selesai diproduksi dan siap diambil di workshop atau dikirim.",
    associatedStages: ["READY_FOR_DELIVERY"]
  },
  {
    step: 5,
    title: "5. Pesanan Diterima (Selesai)",
    desc: "Seluruh pesanan telah resmi diserahterimakan kepada Anda.",
    associatedStages: ["COMPLETED"]
  }
]

// PEMBOBOTAN PERSENTASE BERDASARKAN 8 POS INTERNAL NYATA
const STAGE_PERCENTAGE_MAP: Record<string, number> = {
  ORDER_INBOX: 10,
  DESIGN_QUEUE: 20,
  PRINTING: 35,
  CUTTING: 45,
  HEAT_PRESS: 60,
  PATTERN_CUTTING: 70,
  SEWING: 85,
  QC_PACKING: 95,
  READY_FOR_DELIVERY: 98,
  COMPLETED: 100,
  CANCELLED: 0
}

function formatDateID(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

export default function PublicTrackingPage() {
  const params = useParams()
  const rawOrderNumber = params?.order_number as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [brandName, setBrandName] = useState("Manayra")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadPublicData() {
      if (!rawOrderNumber) return
      setLoading(true)

      // 1. Ambil Pengaturan Brand Dinamis
      try {
        const { data: sData } = await supabase.from("system_settings").select("key, value")
        if (sData) {
          sData.forEach((s) => {
            if (s.key === "brand_name" && s.value) setBrandName(s.value)
            if (s.key === "brand_logo_url" && s.value) setLogoUrl(s.value)
          })
        }
      } catch {}

      // 2. Ambil data pesanan (HANYA KOLOM PUBLIK)
      const { data: oData } = await supabase
        .from("orders")
        .select("order_number, order_title, customer_name, total_qty, fabric_type, collar_type, current_status, deadline_date, created_at, mockup_url, mockup_url_2, mockup_url_3, size_breakdown")
        .eq("order_number", rawOrderNumber)
        .single()

      if (oData) {
        setOrder(oData)
      }
      setLoading(false)
    }

    loadPublicData()
  }, [rawOrderNumber])

  // Hitung Persentase & Milestone Aktif
  const progressInfo = useMemo(() => {
    if (!order) return { percentage: 0, currentMilestoneStep: 1 }

    const status = order.current_status || "ORDER_INBOX"
    const percentage = STAGE_PERCENTAGE_MAP[status] ?? 10

    // Tentukan nomor milestone aktif (1 s/d 5)
    let currentMilestoneStep = 1
    for (const m of CUSTOMER_MILESTONES) {
      if (m.associatedStages.includes(status)) {
        currentMilestoneStep = m.step
        break
      }
    }

    return { percentage, currentMilestoneStep }
  }, [order])

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
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-lg p-6 text-center space-y-3 shadow-sm">
          <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
            <Search className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">Pesanan Tidak Ditemukan</h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Nomor resi pesanan <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">{rawOrderNumber}</span> tidak terdaftar dalam sistem workshop.
          </p>
        </div>
      </div>
    )
  }

  const isCompleted = order.current_status === "COMPLETED"
  const isCancelled = order.current_status === "CANCELLED"

  const mockups = [
    { url: order.mockup_url, label: "Desain Utama" },
    { url: order.mockup_url_2, label: "Desain Tambahan" },
    { url: order.mockup_url_3, label: "Desain Alternatif" },
  ].filter((m) => Boolean(m.url))

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 py-6 px-4 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-zinc-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-2xs">
            {logoUrl && <img src={logoUrl} alt={brandName} className="h-3.5 w-3.5 rounded-full object-cover" />}
            <span className="uppercase tracking-wider">{brandName}</span>
          </div>
          <h1 className="text-base font-black text-zinc-900">Pelacakan Status Pesanan</h1>
          <p className="text-[11px] text-zinc-500">Pantau proses pengerjaan jersey Anda secara langsung (*realtime*).</p>
        </div>

        {/* ========================================================================= */}
        {/* HERO CARD: PERSENTASE PROGRES AKTIF (MENARIK, BESAR & INFORMATIF)         */}
        {/* ========================================================================= */}
        {!isCancelled && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Progres Pengerjaan
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-3xl font-black font-mono tracking-tight text-zinc-950">
                    {progressInfo.percentage}%
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-sans">
                    {isCompleted ? "Selesai Penuh" : "Sedang Berjalan"}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase inline-flex items-center gap-1 shadow-2xs ${
                  isCompleted 
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300" 
                    : "bg-blue-50 text-blue-900 border border-blue-200 animate-pulse"
                }`}>
                  {isCompleted ? <CheckCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-blue-600" />}
                  <span>{isCompleted ? "Rampung" : `Tahap ${progressInfo.currentMilestoneStep} dari 5`}</span>
                </span>
              </div>
            </div>

            {/* Progress Bar Dinamis Panjang */}
            <div className="space-y-1">
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden p-0.5 border border-zinc-200">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isCompleted 
                      ? "bg-emerald-600" 
                      : "bg-gradient-to-r from-blue-600 to-emerald-500"
                  }`}
                  style={{ width: `${progressInfo.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                <span>0% Desain</span>
                <span>50% Produksi</span>
                <span>100% Selesai</span>
              </div>
            </div>
          </div>
        )}

        {/* Banner Pesanan Selesai */}
        {isCompleted && (
          <div className="bg-emerald-600 text-white p-3.5 rounded-lg shadow-sm flex items-center gap-3 animate-in fade-in">
            <CheckCheck className="h-6 w-6 shrink-0" />
            <div>
              <strong className="block text-xs font-bold uppercase">Pesanan Telah Selesai Penuh!</strong>
              <span className="text-[11px] text-emerald-100">Seluruh tahapan produksi telah rampung dan barang siap diserahterimakan. Terima kasih atas kepercayaan Anda!</span>
            </div>
          </div>
        )}

        {/* Banner Pesanan Dibatalkan */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 text-red-950 p-3.5 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <strong className="block font-bold">Pesanan Dibatalkan</strong>
              <span className="text-[11px] text-red-800">Pesanan ini telah resmi dihentikan dari lini produksi workshop.</span>
            </div>
          </div>
        )}

        {/* Kartu Ringkasan Informasi Order */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-start border-b border-zinc-100 pb-2.5">
            <div>
              <span className="text-[9.5px] text-zinc-500 uppercase font-mono block">No. Order</span>
              <div className="text-sm font-mono font-black text-zinc-950">{order.order_number}</div>
            </div>
            <div className="text-right">
              <span className="text-[9.5px] text-zinc-500 uppercase font-mono block">Target Estimasi Selesai</span>
              <strong className="text-xs font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block">
                {formatDateID(order.deadline_date)}
              </strong>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-black text-zinc-950 uppercase">{order.order_title || order.customer_name}</h2>
            <div className="text-xs text-zinc-600 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Pemesan: <strong className="text-zinc-900">{order.customer_name}</strong></span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-semibold text-zinc-800">
                <Shirt className="h-3.5 w-3.5 text-zinc-500" /> {order.fabric_type}
              </span>
              <span>&bull;</span>
              <span className="font-mono font-bold text-zinc-900">{order.total_qty} PCS</span>
            </div>

            {/* Model Item yang Diproduksi */}
            {Array.isArray(order.size_breakdown?.active_models) && order.size_breakdown.active_models.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-zinc-500 font-medium mr-1">Item:</span>
                {order.size_breakdown.active_models.map((m: string) => (
                  <span key={m} className="px-2 py-0.5 bg-zinc-100 text-zinc-800 text-[9.5px] font-mono font-bold rounded border border-zinc-200">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visual Mockup Desain (Approved) */}
        {mockups.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-2xs space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-zinc-600" /> Pratinjau Desain Jersey
            </span>
            <div className={`grid gap-2 ${mockups.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {mockups.map((m, idx) => (
                <div key={idx} className="border border-zinc-200 rounded-lg p-1.5 bg-zinc-50 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase mb-1">{m.label}</span>
                  <div className="h-44 w-full bg-white rounded border border-zinc-200 flex items-center justify-center overflow-hidden p-1">
                    <img src={m.url} alt={m.label} className="h-full w-full object-contain" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5 Milestone Stepper Pelanggan (Bersih, Rapi & Melindungi Rahasia Dapur) */}
        {!isCancelled && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                Tahapan Pengerjaan Pesanan
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">5 Milestone Pelanggan</span>
            </div>

            <div className="space-y-4">
              {CUSTOMER_MILESTONES.map((milestone, idx) => {
                const isPast = isCompleted || milestone.step < progressInfo.currentMilestoneStep
                const isCurrent = !isCompleted && milestone.step === progressInfo.currentMilestoneStep

                return (
                  <div key={milestone.step} className="flex gap-3 relative">
                    {/* Garis penghubung vertikal */}
                    {idx !== CUSTOMER_MILESTONES.length - 1 && (
                      <div 
                        className={`absolute left-[11px] top-6 bottom-[-16px] w-[2px] transition-colors duration-300 ${
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
                          isCurrent ? "text-zinc-950 font-black" : isPast ? "text-zinc-800 font-semibold" : "text-zinc-400"
                        }`}>
                          {milestone.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[9.5px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                            Sedang Berlangsung
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            Selesai
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 leading-snug ${isCurrent ? "text-zinc-700 font-medium" : "text-zinc-400"}`}>
                        {milestone.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-400 font-mono">
            {brandName} Workshop OS &bull; Status diperbarui otomatis
          </p>
        </div>
      </div>
    </div>
  )
}
