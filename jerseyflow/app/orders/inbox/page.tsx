"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  ArrowLeft, 
  RefreshCw, 
  Send, 
  UserCheck, 
  Layers, 
  Calendar, 
  ExternalLink,
  Printer,
  Sparkles
} from "lucide-react"

interface OrderInboxItem {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  total_qty: number
  fabric_type: string
  collar_type: string
  deadline_date: string
  created_at: string
  link_drive_aset?: string | null
  catatan_desain?: string | null
  assigned_designer_id?: string | null
  assigned_designer_name?: string | null
}

interface DesignerProfile {
  id: string
  full_name: string
  role: string
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

export default function OrderInboxPage() {
  const [orders, setOrders] = useState<OrderInboxItem[]>([])
  const [designers, setDesigners] = useState<DesignerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // State pilihan desainer per order: { [orderId]: designerId }
  const [selectedDesigners, setSelectedDesigners] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadInboxData = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    setLoading(true)

    try {
      // 1. Ambil order berstatus ORDER_INBOX
      const { data: oData, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("current_status", "ORDER_INBOX")
        .order("created_at", { ascending: false })

      if (!oErr && oData) {
        setOrders(oData)
      }

      // 2. Ambil daftar staf yang bisa jadi desainer (ADMIN, OWNER, DESIGNER, OPERATOR_DESIGN)
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        
      if (!pErr && pData) {
        // Filter staf yang relevan memegang desain / admin
        const validDesigners = pData.filter((p: any) => {
          const r = (p.role || "").toUpperCase()
          return r === "DESIGNER" || r === "OPERATOR_DESIGN" || r === "ADMIN" || r === "OWNER"
        })
        setDesigners(validDesigners)
      }
    } catch (err) {
      console.error("Gagal memuat data inbox:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadInboxData()

    const channel = supabase
      .channel("orders_inbox_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadInboxData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleDesignerSelect = (orderId: string, designerId: string) => {
    setSelectedDesigners((prev) => ({ ...prev, [orderId]: designerId }))
  }

  // Kirim order dari Inbox ke Kanban Pos 01 (DESIGN_QUEUE)
  const handleDispatchToDesign = async (order: OrderInboxItem) => {
    const assignedId = selectedDesigners[order.id]
    if (!assignedId) {
      alert("Silakan pilih Operator / Desainer yang akan mengerjakan order ini terlebih dahulu.")
      return
    }

    const designerObj = designers.find((d) => d.id === assignedId)
    const designerName = designerObj ? designerObj.full_name : "Tim Desain"

    const confirmSend = window.confirm(
      `Kirim pesanan "${order.order_number} - ${order.order_title || order.customer_name}" ke antrean desain dan tugaskan ke ${designerName}?`
    )
    if (!confirmSend) return

    setProcessingId(order.id)

    try {
      // Update status menjadi DESIGN_QUEUE dan kunci nama desainer
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          current_status: "DESIGN_QUEUE",
          assigned_designer_id: assignedId,
          assigned_designer_name: designerName,
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id)

      if (updateErr) throw updateErr

      // Catat log audit trail
      await supabase.from("production_logs").insert({
        order_id: order.id,
        stage: "DESIGN_QUEUE",
        notes: `Pesanan divalidasi dari Inbox dan ditugaskan ke Desainer: ${designerName}. Masuk Pos 01 (Desain).`
      })

      // Hapus dari state lokal inbox seketika
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      alert(`Berhasil! Pesanan dikirim ke Papan Kanban Pos 01 untuk ${designerName}.`)
    } catch (err: any) {
      alert("Gagal mengirim pesanan ke produksi: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Order Masuk & Validasi Awal (Inbox)</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Menunggu Penugasan ({orders.length})
            </span>
          </div>
          <p className="text-xs text-zinc-600">Daftar pesanan baru dari CS. Periksa kelengkapan aset dan tetapkan desainer sebelum dikirim ke Kanban.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadInboxData(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-600 hover:bg-zinc-50 transition-colors shadow-2xs"
            title="Muat Ulang Data"
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Daftar Pesanan</span>
          </Link>
        </div>
      </div>

      {/* Tabel Inbox */}
      <div className="border border-zinc-200 bg-white rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">No Order</th>
                <th className="py-2.5 px-3">Nama Order / Pemesan</th>
                <th className="py-2.5 px-3">Spesifikasi & Qty</th>
                <th className="py-2.5 px-3">Aset & Catatan Desain</th>
                <th className="py-2.5 px-3">Tugaskan ke Desainer</th>
                <th className="py-2.5 px-3 text-right">Aksi Kirim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 font-mono">
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-2 text-zinc-900" />
                    Memuat antrean order masuk...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    Tidak ada antrean di Order Masuk (Inbox). Semua pesanan sudah diproses ke produksi.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const currentSelectedDesigner = selectedDesigners[o.id] || ""
                  const isProcessing = processingId === o.id

                  return (
                    <tr key={o.id} className="hover:bg-zinc-50/70 transition-colors">
                      {/* No Order */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-zinc-900 block">{o.order_number}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">Masuk: {formatDateID(o.created_at)}</span>
                      </td>

                      {/* Nama Order & Pemesan */}
                      <td className="py-3 px-3">
                        <strong className="block font-black text-zinc-950 text-[11.5px] leading-tight uppercase">
                          {o.order_title || o.customer_name}
                        </strong>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          Pemesan: {o.customer_name}
                        </span>
                      </td>

                      {/* Spesifikasi & Qty */}
                      <td className="py-3 px-3">
                        <span className="block text-zinc-700">{o.fabric_type}</span>
                        <strong className="font-mono text-zinc-900 text-[11px]">{o.total_qty} pcs</strong>
                      </td>

                      {/* Aset & Catatan */}
                      <td className="py-3 px-3 max-w-xs">
                        {o.link_drive_aset ? (
                          <a
                            href={o.link_drive_aset}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-semibold hover:underline mb-1 truncate max-w-full"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">Buka Link Aset / Drive</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-amber-700 block mb-0.5">⚠️ Link Aset belum diisi</span>
                        )}
                        <p className="text-[10px] text-zinc-600 truncate max-w-[180px]" title={o.catatan_desain || "-"}>
                          Brief: {o.catatan_desain || "-"}
                        </p>
                      </td>

                      {/* Dropdown Pilih Desainer */}
                      <td className="py-3 px-3">
                        <select
                          value={currentSelectedDesigner}
                          onChange={(e) => handleDesignerSelect(o.id, e.target.value)}
                          className="w-full px-2 py-1.5 border border-zinc-300 rounded text-xs bg-white focus:outline-none font-semibold text-zinc-800 shadow-2xs"
                        >
                          <option value="">-- Pilih Desainer / PIC --</option>
                          {designers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name} ({d.role})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Aksi Kirim ke Kanban */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/orders/${o.id}`}
                            className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-900 transition-colors"
                            title="Lihat Detail Order"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            disabled={isProcessing || !currentSelectedDesigner}
                            onClick={() => handleDispatchToDesign(o)}
                            className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-30 shadow-2xs cursor-pointer"
                            title="Kirim ke Papan Kanban Pos 01 (Desain)"
                          >
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            <span>{isProcessing ? "Mengirim..." : "Kirim ke Desain"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
