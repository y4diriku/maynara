"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { Plus, Search, Eye, Printer, ChevronRight } from "lucide-react"

function formatDateID(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const loadOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })

    if (data) setOrders(data)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const filtered = orders.filter((o) =>
    o.order_number.toLowerCase().includes(query.toLowerCase()) ||
    o.customer_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <h1 className="text-base font-bold text-zinc-900 leading-tight">Daftar Semua Pesanan</h1>
          <p className="text-xs text-zinc-600">Arsip seluruh pesanan, rincian biaya, dan pencetakan dokumen.</p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Buat Pesanan Baru</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 border border-zinc-200 bg-white p-2.5 rounded shadow-2xs">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Cari order # atau nama pelanggan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="border border-zinc-200 bg-white rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">No Order</th>
                <th className="py-2.5 px-3">Pemesan</th>
                <th className="py-2.5 px-3">Bahan / Qty</th>
                <th className="py-2.5 px-3">Target Selesai</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono">
                    Memuat data pesanan...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    Tidak ada pesanan ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">{o.order_number}</td>
                    <td className="py-2.5 px-3">
                      <strong className="block font-semibold text-zinc-800">{o.customer_name}</strong>
                      <span className="text-[10px] text-zinc-500 font-mono">{o.customer_phone}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="block text-zinc-700">{o.fabric_type}</span>
                      <strong className="font-mono text-zinc-900 text-[11px]">{o.total_qty} pcs</strong>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-700">
                      {formatDateID(o.deadline_date)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                        {o.current_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/orders/${o.id}/spk`}
                          target="_blank"
                          className="p-1 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600"
                          title="Cetak Lembar SPK"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/orders/${o.id}`}
                          className="p-1 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-900"
                          title="Buka Detail Order"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
