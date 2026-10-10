"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw, 
  Printer, 
  ExternalLink,
  CheckCircle2,
  Archive,
  AlertTriangle,
  X,
  Banknote,
  Calendar,
  Lock
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  customer_phone?: string | null
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

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount)
}

const STAGES = [
  { key: "DESIGN_QUEUE", label: "Antrean Desain", code: "01", accent: "bg-blue-600" },
  { key: "PRINTING", label: "Print Sublim", code: "02", accent: "bg-indigo-600" },
  { key: "CUTTING", label: "Potong Kain", code: "03", accent: "bg-amber-600" },
  { key: "HEAT_PRESS", label: "Press Kain", code: "04", accent: "bg-rose-600" },
  { key: "PATTERN_CUTTING", label: "Potong Pola", code: "05", accent: "bg-teal-600" },
  { key: "SEWING", label: "Lini Jahit", code: "06", accent: "bg-emerald-600" },
  { key: "QC_PACKING", label: "QC & Packing", code: "07", accent: "bg-violet-600" },
  { key: "READY_FOR_DELIVERY", label: "Siap Ambil", code: "08", accent: "bg-zinc-900" },
]

export default function KanbanDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterQuery, setFilterQuery] = useState("")

  const [archiveModalOrder, setArchiveModalOrder] = useState<Order | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userRole, setUserRole] = useState<string>("")

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
    } catch {}
  }, [])

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
    async function fetchUserRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()
        if (prof?.role) setUserRole(prof.role.toUpperCase())
      }
    }
    fetchUserRole()
    fetchOrders()

    const channel = supabase
      .channel("orders_realtime_board_8stages")
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

  const handleExecuteArchive = async (markAsPaid: boolean) => {
    if (!archiveModalOrder) return
    setIsSubmitting(true)

    const orderId = archiveModalOrder.id
    const totalPrice = Number(archiveModalOrder.total_price || 0)

    setOrders((prev) => {
      const updated = prev.filter((o) => o.id !== orderId)
      try {
        localStorage.setItem("manayra_cached_orders", JSON.stringify(updated))
      } catch {}
      return updated
    })

    try {
      const updatePayload: Record<string, any> = {
        current_status: "COMPLETED"
      }

      if (markAsPaid) {
        updatePayload.is_paid_off = true
        updatePayload.down_payment = totalPrice
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId)

      if (updateError) throw updateError

      await supabase.from("production_logs").insert({
        order_id: orderId,
        stage: "COMPLETED",
        notes: markAsPaid
          ? "Pelunasan diterima saat penyerahan barang. Pesanan diarsipkan."
          : "Barang diserahkan ke pemesan & pesanan diarsipkan."
      })

      setArchiveModalOrder(null)
    } catch (err) {
      console.error("Gagal menyelesaikan order:", err)
      alert("Terjadi kendala saat menyimpan. Memuat ulang data...")
      fetchOrders()
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateSLA = (deadlineDateStr: string) => {
    const now = new Date()
    const target = new Date(deadlineDateStr)
    const diffTime = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: `Telat ${Math.abs(diffDays)} hari`, status: "kritis" }
    } else if (diffDays === 0) {
      return { label: "Hari ini", status: "kritis" }
    } else if (diffDays === 1) {
      return { label: "1 hari lagi", status: "kritis" }
    } else if (diffDays <= 2) {
      return { label: `${diffDays} hari lagi`, status: "kritis" }
    } else if (diffDays <= 4) {
      return { label: `${diffDays} hari lagi`, status: "mepet" }
    }
    return { label: `${diffDays} hari lagi`, status: "aman" }
  }

  const filteredOrders = useMemo(() => {
    const q = filterQuery.toLowerCase().trim()
    if (!q) return orders
    return orders.filter((o) =>
      o.order_number.toLowerCase().includes(q) ||
      (o.order_title && o.order_title.toLowerCase().includes(q)) ||
      o.customer_name.toLowerCase().includes(q)
    )
  }, [orders, filterQuery])

  return (
    <div className="space-y-3 max-w-full">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-zinc-200 bg-white p-2.5 rounded shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Cari nama order, no order..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="px-2.5 py-1 border border-zinc-300 rounded text-xs w-60 sm:w-64 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            className="p-1 border border-zinc-200 rounded hover:bg-zinc-50 text-zinc-600 transition-colors"
            title="Refresh Data Terbaru"
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
          </button>
          <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 hover:border-zinc-300 rounded hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition-colors"
            title="Buka Daftar Seluruh Order & Arsip"
          >
            <Archive className="h-3.5 w-3.5 text-zinc-500" />
            <span>Daftar Pesanan & Arsip</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">
            Total WIP: <strong className="text-zinc-900 font-mono">{orders.length}</strong> Order
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

      {/* Container 8 Kolom Kanban */}
      <div className="flex gap-2 overflow-x-auto pb-3 items-start min-h-[calc(100vh-185px)]">
        {STAGES.map((col, idx) => {
          const columnOrders = filteredOrders.filter((o) => o.current_status === col.key)
          const totalPcsInColumn = columnOrders.reduce((acc, curr) => acc + Number(curr.total_qty || 0), 0)

          return (
            <div
              key={col.key}
              className="border border-zinc-200/90 bg-zinc-100/60 rounded flex flex-col h-full max-h-[84vh] overflow-hidden min-w-[195px] xl:min-w-[175px] 2xl:min-w-0 w-[210px] xl:w-auto xl:flex-1 shrink-0 xl:shrink"
            >
              {/* Header Kolom */}
              <div className="bg-white border-b border-zinc-200 px-2 py-1.5 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-[9px] font-black text-zinc-400">
                    {col.code}
                  </span>
                  <div className="truncate">
                    <h3 className="text-[11px] font-bold text-zinc-900 truncate leading-tight">
                      {col.label}
                    </h3>
                    <span className="text-[9px] text-zinc-500 font-mono block leading-none">
                      {totalPcsInColumn} pcs
                    </span>
                  </div>
                </div>

                <div className={`px-1.5 py-0.2 rounded-full text-white font-mono text-[10px] font-black tracking-tight shrink-0 shadow-2xs ${
                  columnOrders.length > 0 ? col.accent : "bg-zinc-300 text-zinc-600"
                }`}>
                  {columnOrders.length}
                </div>
              </div>

              {/* Daftar Kartu Ultra-Compact */}
              <div className="p-1 space-y-1.5 overflow-y-auto flex-1">
                {loading && orders.length === 0 ? (
                  <div className="space-y-1.5 animate-pulse">
                    {[1, 2].map((s) => (
                      <div key={s} className="bg-white border border-zinc-200 rounded p-2 space-y-1.5">
                        <div className="h-2.5 bg-zinc-200 rounded w-2/3" />
                        <div className="h-3 bg-zinc-100 rounded w-full" />
                        <div className="h-4 bg-zinc-200/70 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : columnOrders.length === 0 ? (
                  <div className="py-6 text-center text-zinc-400 text-[9.5px] border border-dashed border-zinc-200/80 rounded bg-white/40">
                    Kosong
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const sla = calculateSLA(order.deadline_date)
                    const isFirstStage = idx === 0
                    const isLastStage = idx === STAGES.length - 1
                    const sisaPiutang = Number(order.total_price || 0) - Number(order.down_payment || 0)
                    const isLunas = order.is_paid_off || sisaPiutang <= 0

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-zinc-200 rounded p-2 shadow-2xs space-y-1 hover:border-zinc-400 transition-colors"
                      >
                        {/* 1. Baris No Order & Total Qty (Sejajar & Rapat) */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <span className="text-[11px] font-mono font-black text-zinc-950 tracking-tight truncate">
                            {order.order_number}
                          </span>
                          <span className="font-mono text-[9px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-200/80 px-1 py-0.2 rounded shrink-0">
                            {order.total_qty} pcs
                          </span>
                        </div>

                        {/* 2. NAMA ORDER: UPPERCASE, BOLD, ERGONOMIS (Nama Pemesan Ditiadakan) */}
                        <p 
                          className="text-[11px] font-bold uppercase tracking-tight text-zinc-800 truncate leading-snug" 
                          title={order.order_title || order.customer_name}
                        >
                          {order.order_title || order.customer_name}
                        </p>

                        {/* 3. Baris Tanggal & Deadline */}
                        <div className="flex items-center justify-between text-[9px] leading-tight pt-0.5">
                          <span className="font-mono text-zinc-500 flex items-center gap-0.5 truncate">
                            <Calendar className="h-2.5 w-2.5 text-zinc-400 shrink-0" />
                            <span>{formatDateID(order.deadline_date)}</span>
                          </span>

                          {isLastStage ? (
                            isLunas ? (
                              <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 shrink-0">
                                LUNAS
                              </span>
                            ) : (
                              <span className="text-[8.5px] font-bold text-red-700 bg-red-50 px-1 py-0.2 rounded border border-red-200 shrink-0">
                                -Rp {sisaPiutang > 1000 ? Math.round(sisaPiutang / 1000) + "k" : sisaPiutang}
                              </span>
                            )
                          ) : (
                            <span
                              className={
                                "font-mono font-bold px-1 py-0.2 rounded text-[8.5px] border shrink-0 " +
                                (sla.status === "kritis"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : sla.status === "mepet"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200")
                              }
                            >
                              {sla.label}
                            </span>
                          )}
                        </div>

                        {/* 4. Footer Aksi Toolbar */}
                        <div className="pt-1 border-t border-zinc-100 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={isFirstStage}
                            onClick={() => updateStage(order.id, order.current_status, "prev")}
                            className="h-5 w-5 flex items-center justify-center border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-500 disabled:opacity-20 shrink-0 transition-colors"
                            title="Pos sebelumnya"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>

                          <Link
                            href={`/orders/${order.id}`}
                            className="h-5 w-5 flex items-center justify-center border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors shrink-0"
                            title="Buka Detail Order"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>

                          <Link
                            href={`/orders/${order.id}/spk`}
                            target="_blank"
                            className="h-5 w-5 flex items-center justify-center border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 transition-colors shrink-0"
                            title="Cetak Lembar SPK"
                          >
                            <Printer className="h-2.5 w-2.5" />
                          </Link>

                          {isLastStage ? (
                            <button
                              type="button"
                              onClick={() => setArchiveModalOrder(order)}
                              className="flex-1 h-5 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition-colors shadow-2xs"
                              title="Selesaikan & serahkan pesanan"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                              <span>Selesai</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateStage(order.id, order.current_status, "next")}
                              className="flex-1 h-5 flex items-center justify-center gap-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-[9px] font-bold transition-colors shadow-2xs"
                              title="Lanjut ke pos berikutnya"
                            >
                              <span>Lanjut</span>
                              <ChevronRight className="h-2.5 w-2.5" />
                            </button>
                          )}
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

      {/* Modal Dialog Konfirmasi */}
      {archiveModalOrder && (() => {
        const modalSisa = Number(archiveModalOrder.total_price || 0) - Number(archiveModalOrder.down_payment || 0)
        const modalIsLunas = archiveModalOrder.is_paid_off || modalSisa <= 0

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-zinc-200 rounded-lg shadow-xl max-w-sm w-full p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-zinc-900">Serah Terima & Arsip</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveModalOrder(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between font-mono font-bold text-zinc-900">
                  <span>{archiveModalOrder.order_number}</span>
                  <span className="text-zinc-600 text-[11px] font-sans font-semibold">{archiveModalOrder.total_qty} pcs</span>
                </div>
                <p className="text-zinc-950 font-bold uppercase truncate">{archiveModalOrder.order_title || archiveModalOrder.customer_name}</p>
                <p className="text-[11px] text-zinc-500">{archiveModalOrder.fabric_type}</p>
              </div>

              <div className="space-y-1.5 border border-zinc-200 rounded p-2.5 text-xs">
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-zinc-800 font-semibold">{formatIDR(Number(archiveModalOrder.total_price || 0))}</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>Sudah Dibayar (DP):</span>
                  <span className="font-mono text-zinc-800 font-semibold">{formatIDR(Number(archiveModalOrder.down_payment || 0))}</span>
                </div>

                <div className="border-t border-zinc-200 pt-1.5 flex justify-between items-center font-bold">
                  <span>Sisa Wajib Bayar:</span>
                  <span className={`font-mono text-xs ${modalIsLunas ? "text-emerald-600" : "text-red-600"}`}>
                    {modalIsLunas ? "Rp 0 (LUNAS)" : formatIDR(modalSisa)}
                  </span>
                </div>
              </div>

              {modalIsLunas ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-800 text-[11px] flex items-start gap-1.5 leading-tight">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                  <span>Pesanan ini <strong>sudah lunas</strong>. Barang siap diserahkan kepada pemesan.</span>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800 text-[11px] flex items-start gap-1.5 leading-tight">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 mt-0.5" />
                  <span>
                    <strong>Perhatian:</strong> Tagihan belum lunas. Wajib menerima pelunasan sebesar <strong>{formatIDR(modalSisa)}</strong> sebelum barang diserahkan.
                  </span>
                </div>
              )}

              <div className="pt-1 flex flex-col gap-1.5">
                {modalIsLunas ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleExecuteArchive(false)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? "Menyimpan..." : "Konfirmasi Serah Terima"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleExecuteArchive(true)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? "Memproses..." : "Terima Pelunasan & Serahkan"}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setArchiveModalOrder(null)}
                  className="w-full py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded text-xs font-medium transition-colors"
                >
                  Batal / Tahan Barang
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
