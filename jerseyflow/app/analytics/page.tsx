"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  TrendingUp, 
  DollarSign, 
  Shirt, 
  AlertTriangle, 
  PieChart, 
  Layers 
} from "lucide-react"

export default function AnalyticsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [rosterItems, setRosterItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verifyAndLoad() {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()

      const userRole = (profile?.role || "ADMIN").toUpperCase()
      if (userRole !== "OWNER") {
        router.replace("/")
        return
      }

      setAuthorized(true)

      const { data: oData } = await supabase.from("orders").select("*")
      const { data: rData } = await supabase.from("order_roster_items").select("size, sleeve_type")

      if (oData) setOrders(oData)
      if (rData) setRosterItems(rData)
      setLoading(false)
    }

    verifyAndLoad()
  }, [router])

  if (loading || !authorized) {
    return (
      <div className="flex h-[60vh] items-center justify-center font-mono text-xs text-zinc-500">
        Memverifikasi wewenang akses laporan...
      </div>
    )
  }

  const totalOmzet = orders.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0)
  const totalDP = orders.reduce((acc, curr) => acc + Number(curr.down_payment || 0), 0)
  const sisaPiutang = totalOmzet - totalDP
  const totalPcs = orders.reduce((acc, curr) => acc + Number(curr.total_qty || 0), 0)

  const activeOrders = orders.filter(o => o.current_status !== 'COMPLETED' && o.current_status !== 'CANCELLED')
  const makloonOrders = activeOrders.filter(o => o.is_makloon)
  const internalOrders = activeOrders.filter(o => !o.is_makloon)

  const now = new Date().getTime()
  const criticalOrders = activeOrders.filter(o => {
    const deadline = new Date(o.deadline_date).getTime()
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))
    return diffDays <= 2
  })

  const sizeBreakdown: { [key: string]: number } = {}
  rosterItems.forEach(item => {
    sizeBreakdown[item.size] = (sizeBreakdown[item.size] || 0) + 1
  })

  const fabricBreakdown: { [key: string]: number } = {}
  orders.forEach(item => {
    fabricBreakdown[item.fabric_type] = (fabricBreakdown[item.fabric_type] || 0) + Number(item.total_qty || 0)
  })

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      <div className="border-b border-zinc-200 pb-3">
        <h1 className="text-base font-bold text-zinc-900 leading-tight">Laporan & Evaluasi Workshop</h1>
        <p className="text-xs text-zinc-600">Ringkasan performa finansial, volume produksi, dan evaluasi material konveksi.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase text-zinc-500 flex items-center justify-between">
            Total Nilai Transaksi
            <DollarSign className="h-3.5 w-3.5 text-zinc-400" />
          </span>
          <div className="text-lg font-bold font-mono text-zinc-900">
            Rp {totalOmzet.toLocaleString("id-ID")}
          </div>
          <span className="text-[10px] text-zinc-500 block">Dari total {orders.length} order tercatat</span>
        </div>

        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase text-zinc-500 flex items-center justify-between">
            Kas Masuk (DP & Pelunasan)
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          </span>
          <div className="text-lg font-bold font-mono text-emerald-600">
            Rp {totalDP.toLocaleString("id-ID")}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Piutang Tertagih: {totalOmzet > 0 ? Math.round((totalDP / totalOmzet) * 100) : 0}%
          </span>
        </div>

        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase text-zinc-500 flex items-center justify-between">
            Total Potong Jersey (Pcs)
            <Shirt className="h-3.5 w-3.5 text-zinc-400" />
          </span>
          <div className="text-lg font-bold font-mono text-zinc-900">
            {totalPcs.toLocaleString("id-ID")} <span className="text-xs font-normal text-zinc-500">Pcs</span>
          </div>
          <span className="text-[10px] text-zinc-500 block">Akumulasi volume kain terpakai</span>
        </div>

        <div className="border border-red-200 bg-red-50/40 p-3.5 rounded shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase text-red-800 flex items-center justify-between">
            Perlu Perhatian (Deadline &le; 48 Jam)
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          </span>
          <div className="text-lg font-bold font-mono text-red-700">
            {criticalOrders.length} <span className="text-xs font-normal text-red-600">Order Mepet</span>
          </div>
          <span className="text-[10px] text-red-600 block">Segera tindak lanjuti di antrean</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-tight text-zinc-800 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-zinc-500" /> Alokasi Beban Jahit
          </span>
          
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded flex justify-between items-center">
              <div>
                <span className="font-bold text-zinc-900">Workshop Internal</span>
                <div className="text-[11px] text-zinc-500">Kapasitas mesin & tim jahit utama</div>
              </div>
              <span className="text-sm font-mono font-bold text-zinc-900">
                {internalOrders.length} Order
              </span>
            </div>

            <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded flex justify-between items-center">
              <div>
                <span className="font-bold text-zinc-900">Mitra Makloon Luar</span>
                <div className="text-[11px] text-zinc-500">Dialokasikan ke penjahit rekanan</div>
              </div>
              <span className="text-sm font-mono font-bold text-zinc-900">
                {makloonOrders.length} Order
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex justify-between text-xs">
            <span className="text-zinc-600">Sisa Piutang Belum Lunas:</span>
            <strong className="font-mono text-red-600">
              Rp {sisaPiutang > 0 ? sisaPiutang.toLocaleString("id-ID") : 0}
            </strong>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-tight text-zinc-800 flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5 text-zinc-500" /> Sebaran Ukuran Terpopuler
          </span>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.keys(sizeBreakdown).length === 0 ? (
              <div className="text-xs text-zinc-400 py-4 text-center">Belum ada data roster.</div>
            ) : (
              Object.entries(sizeBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([sz, qty]) => (
                  <div key={sz} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 last:border-0">
                    <span className="font-mono font-semibold text-zinc-800">Size {sz}</span>
                    <span className="font-mono text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">
                      {qty} pcs
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-tight text-zinc-800 flex items-center gap-1.5">
            <Shirt className="h-3.5 w-3.5 text-zinc-500" /> Konsumsi Jenis Bahan Kain
          </span>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.keys(fabricBreakdown).length === 0 ? (
              <div className="text-xs text-zinc-400 py-4 text-center">Belum ada order.</div>
            ) : (
              Object.entries(fabricBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([fabric, qty]) => (
                  <div key={fabric} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 last:border-0">
                    <span className="text-zinc-800">{fabric}</span>
                    <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">
                      {qty} pcs
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
