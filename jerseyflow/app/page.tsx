"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  ChevronRight, 
  ChevronLeft, 
  Shirt, 
  RefreshCw, 
  Printer, 
  Scissors, 
  PackageCheck,
  ExternalLink,
  Palette,
  Calendar
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  total_qty: number
  fabric_type: string
  collar_type: string
  current_status: string
  priority: string
  deadline_date: string
  created_at: string
  down_payment: number
  total_price: number
  is_paid_off: boolean
  mockup_url?: string | null
  is_makloon?: boolean
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

const STAGES = [
  { key: "DESIGN_QUEUE", label: "Antrean Desain", code: "01", accent: "bg-blue-600" },
  { key: "PRINTING", label: "Print Sublim", code: "02", accent: "bg-indigo-600" },
  { key: "CUTTING", label: "Potong & Press", code: "03", accent: "bg-amber-600" },
  { key: "SEWING", label: "Lini Jahit", code: "04", accent: "bg-emerald-600" },
  { key: "QC_PACKING", label: "QC & Packing", code: "05", accent: "bg-violet-600" },
  { key: "READY_FOR_DELIVERY", label: "Siap Ambil", code: "06", accent: "bg-zinc-900" },
]

export default function KanbanDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterQuery, setFilterQuery] = useState("")

  // 1. INSTANT CACHE HYDRATION: Muat data dari memori browser seketika (0 ms)
  useEffect(() => {
    try {
      const cached = localStorage.getItem("manayra_cached_orders")
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed)
          setLoading(false)
        }
      }
    } catch {
      // Fallback jika localStorage tidak tersedia
    }
  }, [])

  // 2. BACKGROUND FETCH: Sinkronisasi data ke Supabase tanpa memblokir layar
  const fetchOrders = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .neq("current_status", "COMPLETED")
        .neq("current_status", "CANCELLED")
        .order("deadline_date", { ascending: true })

      if (!error && data) {
        setOrders(data)
        try {
          localStorage.setItem("manayra_cached_orders", JSON.stringify(data))
        } catch {}
      }
    } catch (err) {
      console.error("Gagal sinkron data:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel("orders_realtime_board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const updateStage = async (orderId: string, currentStage: string, direction: "next" | "prev") => {
    const currentIndex = STAGES.findIndex((s) => s.key === currentStage)
    if (currentIndex === -1) return

    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1
    if (targetIndex < 0 || targetIndex >= STAGES.length) return

    const targetStage = STAGES[targetIndex].key

    // Optimistic UI Update: Langsung ubah di layar tanpa jeda
    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, current_status: targetStage } : o))
      try {
        localStorage.setItem("manayra_cached_orders", JSON.stringify(updated))
      } catch {}
      return updated
    })

    await supabase
      .from("orders")
      .update({ current_status: targetStage })
      .eq("id", orderId)

    await supabase.from("production_logs").insert({
      order_id: orderId,
      stage: targetStage,
      notes: "Dipindahkan ke " + STAGES[targetIndex].label
    })
  }

  const calculateSLA = (deadlineDateStr: string) => {
    const now = new Date()
    const target = new Date(deadlineDateStr)
    const diffTime = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: `Telat ${Math.abs(diffDays)} Hari`, status: "kritis" }
    } else if (diffDays === 0) {
      return { label: "Hari ini", status: "kritis" }
    } else if (diffDays <= 2) {
      return { label: `${diffDays} Hari lagi`, status: "kritis" }
    } else if (diffDays <= 4) {
      return { label: `${diffDays} Hari lagi`, status: "mepet" }
    }
    return { label: `${diffDays} Hari lagi`, status: "aman" }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) =>
      o.order_number.toLowerCase().includes(filterQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(filterQuery.toLowerCase())
    )
  }, [orders, filterQuery])

  return (
    <div className="space-y-3 max-w-full">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-zinc-200 bg-white p-2.5 rounded shadow-2xs">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari order # atau nama tim..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="px-2.5 py-1 border border-zinc-300 rounded text-xs w-60 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            className="p-1 border border-zinc-200 rounded hover:bg-zinc-50 text-zinc-600 transition-colors"
            title="Refresh Data Terbaru"
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">
            Total: <strong className="text-zinc-900 font-mono">{orders.length}</strong> Order
          </span>
          <div className="h-3 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> &le; 48 Jam
            </span>
            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 3-4 Hari
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aman
            </span>
          </div>
        </div>
      </div>

      {/* Grid 6 Kolom Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2 min-h-[calc(100vh-190px)] items-start">
        {STAGES.map((col, idx) => {
          const columnOrders = filteredOrders.filter((o) => o.current_status === col.key)
          const totalPcsInColumn = columnOrders.reduce((acc, curr) => acc + Number(curr.total_qty || 0), 0)

          return (
            <div
              key={col.key}
              className="border border-zinc-200/90 bg-zinc-100/60 rounded flex flex-col h-full max-h-[84vh] overflow-hidden"
            >
              {/* Header Kolom */}
              <div className="bg-white border-b border-zinc-200 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[9px] font-extrabold text-zinc-400">
                    {col.code}
                  </span>
                  <div className="truncate">
                    <h3 className="text-xs font-bold text-zinc-900 truncate leading-tight">
                      {col.label}
                    </h3>
                    <span className="text-[9px] text-zinc-500 font-mono block leading-none">
                      {totalPcsInColumn} pcs
                    </span>
                  </div>
                </div>

                <div className={`px-2 py-0.2 rounded-full text-white font-mono text-[11px] font-black tracking-tight shrink-0 shadow-2xs ${
                  columnOrders.length > 0 ? col.accent : "bg-zinc-300 text-zinc-600"
                }`}>
                  {columnOrders.length}
                </div>
              </div>

              {/* Daftar Kartu / Skeleton Loader */}
              <div className="p-1.5 space-y-2 overflow-y-auto flex-1">
                {loading && orders.length === 0 ? (
                  /* SKELETON PLACEHOLDER SAAT PERTAMA KALI KUNJUNGAN */
                  <div className="space-y-2 animate-pulse">
                    {[1, 2].map((s) => (
                      <div key={s} className="bg-white border border-zinc-200 rounded p-2.5 space-y-2">
                        <div className="h-3 bg-zinc-200 rounded w-2/3" />
                        <div className="h-2.5 bg-zinc-100 rounded w-1/2" />
                        <div className="h-6 bg-zinc-100 rounded w-full" />
                        <div className="h-5 bg-zinc-200/70 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : columnOrders.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 text-[10px] border border-dashed border-zinc-200/80 rounded bg-white/40">
                    Kosong
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const sla = calculateSLA(order.deadline_date)
                    const isFirstStage = idx === 0
                    const isLastStage = idx === STAGES.length - 1
                    const sisaPiutang = Number(order.total_price) - Number(order.down_payment)

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-zinc-200 rounded p-2.5 shadow-2xs space-y-2 hover:border-zinc-400 transition-colors"
                      >
                        {/* 1. Header Card 2 Baris */}
                        <div className="space-y-1 border-b border-zinc-100 pb-1.5">
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-mono font-black text-zinc-900 tracking-tight truncate">
                              {order.order_number}
                            </div>
                            <Link
                              href={`/orders/${order.id}/spk`}
                              target="_blank"
                              title="Cetak Lembar SPK"
                              className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Link>
                          </div>

                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="font-mono text-zinc-500 flex items-center gap-0.5 truncate">
                              <Calendar className="h-3 w-3 shrink-0 text-zinc-400" />
                              <span>{formatDateID(order.deadline_date)}</span>
                            </span>
                            <span
                              className={
                                "font-mono font-bold px-1.5 py-0.2 rounded text-[9px] shrink-0 border " +
                                (sla.status === "kritis"
                                  ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                                  : sla.status === "mepet"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200")
                              }
                            >
                              {sla.label}
                            </span>
                          </div>
                        </div>

                        {/* 2. Customer & Spesifikasi */}
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold text-zinc-900 truncate leading-tight" title={order.customer_name}>
                            {order.customer_name}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <Shirt className="h-3 w-3 shrink-0 text-zinc-400" />
                            <span className="truncate max-w-[90px]">{order.fabric_type}</span>
                            <span>&bull;</span>
                            <span className="font-mono font-bold text-zinc-900 shrink-0">{order.total_qty} pcs</span>
                          </div>
                        </div>

                        {/* 3. Kotak Aksi Tahapan */}
                        {col.key === "DESIGN_QUEUE" && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded p-1.5 space-y-1">
                            <Link
                              href={`/orders/${order.id}`}
                              className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline font-bold"
                            >
                              <Palette className="h-3 w-3 shrink-0" />
                              <span className="truncate">Mulai Desain</span>
                            </Link>
                            <div className="text-[9px] flex items-center justify-between text-zinc-500 border-t border-zinc-200/60 pt-0.5">
                              <span>Status:</span>
                              <strong className={order.mockup_url ? "text-emerald-700" : "text-amber-700"}>
                                {order.mockup_url ? "Siap Cetak" : "Menunggu File"}
                              </strong>
                            </div>
                          </div>
                        )}

                        {col.key === "PRINTING" && (
                            <div className="bg-zinc-50 border border-zinc-200 rounded p-1.5 space-y-1">
                              <div className="text-[10px] flex items-center justify-between text-zinc-600">
                                <span>Proses:</span>
                                <strong className="font-semibold text-zinc-800">Print & Press</strong>
                              </div>
                              <div className="text-[9px] flex items-center justify-between text-zinc-500 border-t border-zinc-200/60 pt-0.5">
                                <span>Media:</span>
                                <span className="font-mono text-indigo-700 font-medium">Kertas Sublimasi</span>
                              </div>
                            </div>
                          )}

                        {col.key === "CUTTING" && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded p-1.5 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-800 font-medium">
                              <Scissors className="h-3 w-3 shrink-0 text-amber-600" />
                              <span className="truncate">{order.fabric_type}</span>
                            </div>
                            <div className="text-[9px] flex items-center justify-between text-zinc-500 border-t border-zinc-200/60 pt-0.5">
                              <span>Proses:</span>
                              <span className="font-mono text-zinc-700">Potong Pola</span>
                            </div>
                          </div>
                        )}

                        {col.key === "SEWING" && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded p-1.5 space-y-1">
                            <div className="text-[10px] text-zinc-800 font-medium truncate" title={order.collar_type}>
                              {order.collar_type}
                            </div>
                            <div className="text-[9px] flex items-center justify-between border-t border-zinc-200/60 pt-0.5">
                              <span className="text-zinc-500">Lini:</span>
                              <strong className={order.is_makloon ? "text-purple-700 font-bold" : "text-blue-700 font-bold"}>
                                {order.is_makloon ? "Makloon" : "Internal"}
                              </strong>
                            </div>
                          </div>
                        )}

                        {col.key === "QC_PACKING" && (
                          <div className="bg-zinc-50 border border-zinc-200 rounded p-1.5 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-800 font-medium">
                              <PackageCheck className="h-3 w-3 shrink-0 text-emerald-600" />
                              <span>Pemeriksaan Akhir</span>
                            </div>
                            <div className="text-[9px] flex items-center justify-between border-t border-zinc-200/60 pt-0.5">
                              <span className="text-zinc-500">Bayar:</span>
                              {order.is_paid_off ? (
                                <strong className="text-emerald-700 font-bold">LUNAS</strong>
                              ) : (
                                <span className="font-mono text-amber-800 font-bold">
                                  Rp {sisaPiutang > 1000 ? Math.round(sisaPiutang/1000) + 'k' : sisaPiutang}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {col.key === "READY_FOR_DELIVERY" && (
                          <div className="bg-emerald-50/60 border border-emerald-200 rounded p-1.5 space-y-1">
                            <div className="text-[10px] font-mono text-zinc-800 truncate">
                              {order.customer_phone}
                            </div>
                            <div className="text-[9px] flex items-center justify-between text-emerald-800 border-t border-emerald-200/60 pt-0.5 font-bold">
                              <span>Status:</span>
                              <span>Siap Diambil</span>
                            </div>
                          </div>
                        )}

                        {/* 4. Footer Navigasi */}
                        <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={isFirstStage}
                            onClick={() => updateStage(order.id, order.current_status, "prev")}
                            className="h-6 w-6 flex items-center justify-center border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-500 disabled:opacity-20 shrink-0"
                            title="Kembali ke pos sebelumnya"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>

                          <Link
                            href={`/orders/${order.id}`}
                            className="h-6 w-6 flex items-center justify-center border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors shrink-0"
                            title="Buka Detail Order"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>

                          <button
                            type="button"
                            disabled={isLastStage}
                            onClick={() => updateStage(order.id, order.current_status, "next")}
                            className="flex-1 h-6 flex items-center justify-center gap-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-[9.5px] font-bold transition-colors disabled:opacity-20 shadow-2xs"
                            title="Lanjut ke pos berikutnya"
                          >
                            <span>Lanjut</span>
                            <ChevronRight className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
