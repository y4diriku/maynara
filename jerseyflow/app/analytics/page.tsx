"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  TrendingUp, 
  Shirt, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Layers, 
  PieChart, 
  RefreshCw,
  Scissors,
  Users2
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  total_qty: number
  fabric_type: string
  collar_type?: string
  current_status: string
  deadline_date: string
  created_at: string
  updated_at?: string
  total_price?: number
  down_payment?: number
  is_makloon?: boolean
  order_type?: string | null
  package_type?: string | null
  size_breakdown?: any
}

type PeriodType = "THIS_MONTH" | "LAST_MONTH" | "CUSTOM" | "ALL_TIME"

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount)
}

function isDateInPeriod(dateStr: string | undefined | null, period: PeriodType, customM: string): boolean {
  if (period === "ALL_TIME") return true
  if (!dateStr) return false

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false

  const now = new Date()
  let targetYear = now.getFullYear()
  let targetMonth = now.getMonth()

  if (period === "LAST_MONTH") {
    targetMonth -= 1
    if (targetMonth < 0) {
      targetMonth = 11
      targetYear -= 1
    }
  } else if (period === "CUSTOM") {
    if (!customM) return true
    const [y, m] = customM.split("-").map(Number)
    targetYear = y
    targetMonth = m - 1
  }

  return d.getFullYear() === targetYear && d.getMonth() === targetMonth
}

function getPeriodLabel(period: PeriodType, customM: string): string {
  const now = new Date()
  if (period === "THIS_MONTH") return now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  if (period === "LAST_MONTH") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return last.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  }
  if (period === "CUSTOM" && customM) {
    const [y, m] = customM.split("-").map(Number)
    const customD = new Date(y, m - 1, 1)
    return customD.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  }
  return "Semua Waktu"
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter Periode
  const [period, setPeriod] = useState<PeriodType>("THIS_MONTH")
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setOrders(data)
      }
    } catch (err) {
      console.error("Gagal memuat data evaluasi:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    async function verifyAndLoad() {
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
      loadData()
    }

    verifyAndLoad()
  }, [router])

  // =========================================================================
  // 1. FILTER PESANAN SESUAI PERIODE
  // =========================================================================
  const periodCompletedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.current_status !== "COMPLETED") return false
      return isDateInPeriod(o.updated_at || o.created_at, period, customMonth)
    })
  }, [orders, period, customMonth])

  const periodAllOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.current_status === "CANCELLED") return false
      return isDateInPeriod(o.created_at, period, customMonth)
    })
  }, [orders, period, customMonth])

  // =========================================================================
  // 2. METRIK 4 KARTU EKSEKUTIF
  // =========================================================================
  const executiveKPI = useMemo(() => {
    const totalOmset = periodCompletedOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0)
    const totalPcs = periodCompletedOrders.reduce((sum, o) => sum + Number(o.total_qty || 0), 0)
    const totalOrdersCompleted = periodCompletedOrders.length

    // Hitung Rasio Ketepatan Waktu (SLA Delivery Health)
    let onTimeCount = 0
    periodCompletedOrders.forEach((o) => {
      if (!o.deadline_date) {
        onTimeCount++
        return
      }
      const finishDate = new Date(o.updated_at || o.created_at)
      const targetDate = new Date(o.deadline_date)
      finishDate.setHours(0, 0, 0, 0)
      targetDate.setHours(0, 0, 0, 0)
      if (finishDate.getTime() <= targetDate.getTime()) {
        onTimeCount++
      }
    })

    const onTimeRate = totalOrdersCompleted > 0 
      ? Math.round((onTimeCount / totalOrdersCompleted) * 100) 
      : 100

    return {
      totalOmset,
      totalPcs,
      totalOrdersCompleted,
      onTimeRate
    }
  }, [periodCompletedOrders])

  // =========================================================================
  // 3. EVALUASI STOK KAIN & BAHAN
  // =========================================================================
  const fabricStats = useMemo(() => {
    const map: Record<string, number> = {}
    let totalPcsPeriod = 0

    periodCompletedOrders.forEach((o) => {
      const fab = o.fabric_type || "Standar"
      const qty = Number(o.total_qty || 0)
      map[fab] = (map[fab] || 0) + qty
      totalPcsPeriod += qty
    })

    return Object.entries(map)
      .map(([fabric, qty]) => ({
        fabric,
        qty,
        pct: totalPcsPeriod > 0 ? Math.round((qty / totalPcsPeriod) * 100) : 0
      }))
      .sort((a, b) => b.qty - a.qty)
  }, [periodCompletedOrders])

  // =========================================================================
  // 4. EVALUASI JALUR KERJA & MODEL BISNIS
  // =========================================================================
  const operationalStats = useMemo(() => {
    let totalPcs = 0
    let internalPcs = 0
    let makloonPcs = 0
    let fullOrderPcs = 0
    let printPressPcs = 0

    periodCompletedOrders.forEach((o) => {
      const qty = Number(o.total_qty || 0)
      totalPcs += qty

      if (o.is_makloon) makloonPcs += qty
      else internalPcs += qty

      if (o.order_type === "PRINT_PRESS") printPressPcs += qty
      else fullOrderPcs += qty
    })

    return {
      internalPct: totalPcs > 0 ? Math.round((internalPcs / totalPcs) * 100) : 0,
      makloonPct: totalPcs > 0 ? Math.round((makloonPcs / totalPcs) * 100) : 0,
      internalPcs,
      makloonPcs,
      fullOrderPct: totalPcs > 0 ? Math.round((fullOrderPcs / totalPcs) * 100) : 0,
      printPressPct: totalPcs > 0 ? Math.round((printPressPcs / totalPcs) * 100) : 0,
      fullOrderPcs,
      printPressPcs,
      totalPcs
    }
  }, [periodCompletedOrders])

  // =========================================================================
  // 5. TREN SEBARAN UKURAN PASAR (DARI SIZE BREAKDOWN)
  // =========================================================================
  const sizeStats = useMemo(() => {
    const map: Record<string, number> = {}
    let totalItems = 0

    periodCompletedOrders.forEach((o) => {
      if (o.size_breakdown && typeof o.size_breakdown === "object") {
        const { adult, kid } = o.size_breakdown
        if (adult && typeof adult === "object") {
          Object.entries(adult).forEach(([sz, v]: [string, any]) => {
            const qty = Number(v?.pendek || 0) + Number(v?.panjang || 0)
            if (qty > 0) {
              map[sz] = (map[sz] || 0) + qty
              totalItems += qty
            }
          })
        }
        if (kid && typeof kid === "object") {
          Object.entries(kid).forEach(([sz, v]: [string, any]) => {
            const qty = Number(v?.pendek || 0) + Number(v?.panjang || 0)
            if (qty > 0) {
              map[sz] = (map[sz] || 0) + qty
              totalItems += qty
            }
          })
        }
      }
    })

    return Object.entries(map)
      .map(([size, count]) => ({
        size,
        count,
        pct: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
  }, [periodCompletedOrders])

  if (loading || !authorized) {
    return (
      <div className="flex h-[60vh] items-center justify-center font-mono text-xs text-zinc-500">
        Memverifikasi wewenang akses eksekutif...
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Filter Periode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Laporan & Evaluasi Eksekutif</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-white shadow-2xs">
              Periode: {getPeriodLabel(period, customMonth)}
            </span>
          </div>
          <p className="text-xs text-zinc-600">Analisis omset bisnis, perencanaan belanja bahan kain, dan evaluasi kapasitas workshop.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector Periode */}
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-xs shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="bg-transparent font-medium text-zinc-800 focus:outline-none cursor-pointer"
            >
              <option value="THIS_MONTH">Bulan Ini</option>
              <option value="LAST_MONTH">Bulan Lalu</option>
              <option value="CUSTOM">Pilih Bulan...</option>
              <option value="ALL_TIME">Semua Waktu</option>
            </select>

            {period === "CUSTOM" && (
              <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="text-xs border-l border-zinc-300 pl-2 ml-1 text-zinc-800 focus:outline-none font-mono"
              />
            )}
          </div>

          <button
            onClick={() => loadData(true)}
            className="p-2 border border-zinc-200 rounded hover:bg-zinc-50 text-zinc-600 transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
          </button>
        </div>
      </div>

      {/* 2. 4 KARTU RINGKASAN EKSEKUTIF */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Omset */}
        <div className="bg-white border border-zinc-200 rounded p-3.5 shadow-2xs space-y-1">
          <span className="text-[10.5px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Total Omset Selesai
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-tight">
            {formatIDR(executiveKPI.totalOmset)}
          </div>
          <span className="text-[10px] text-zinc-500 block">Transaksi pesanan rampung</span>
        </div>

        {/* Volume Produksi */}
        <div className="bg-white border border-zinc-200 rounded p-3.5 shadow-2xs space-y-1">
          <span className="text-[10.5px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Total Pcs Diproduksi
            <Shirt className="h-4 w-4 text-blue-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-tight">
            {executiveKPI.totalPcs.toLocaleString("id-ID")} <span className="text-xs font-bold text-zinc-500">PCS</span>
          </div>
          <span className="text-[10px] text-zinc-500 block">Kapasitas output workshop</span>
        </div>

        {/* Nota Sukses */}
        <div className="bg-white border border-zinc-200 rounded p-3.5 shadow-2xs space-y-1">
          <span className="text-[10.5px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Pesanan Selesai
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-tight">
            {executiveKPI.totalOrdersCompleted} <span className="text-xs font-bold text-zinc-500">Order</span>
          </div>
          <span className="text-[10px] text-zinc-500 block">Nota sukses diserahkan</span>
        </div>

        {/* Tingkat Ketepatan Waktu */}
        <div className="bg-white border border-zinc-200 rounded p-3.5 shadow-2xs space-y-1">
          <span className="text-[10.5px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Ketepatan Waktu (SLA)
            <Clock className="h-4 w-4 text-amber-600" />
          </span>
          <div className="text-xl font-black font-mono text-emerald-700 leading-tight">
            {executiveKPI.onTimeRate}% <span className="text-xs font-bold text-zinc-500">Tepat Waktu</span>
          </div>
          <span className="text-[10px] text-zinc-500 block">Selesai sebelum/sesuai deadline</span>
        </div>
      </div>

      {/* 3. DUA BLOK ANALISIS BISNIS: KAIN & JALUR KERJA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* KOTAK KIRI: KONSUMSI BAHAN KAIN */}
        <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-zinc-600" /> Kebutuhan Stok Bahan Kain
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Untuk Belanja Rol Kain</span>
          </div>

          <div className="space-y-2.5">
            {fabricStats.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs">Belum ada pesanan pada periode ini.</div>
            ) : (
              fabricStats.map((item) => (
                <div key={item.fabric} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-800">{item.fabric}</span>
                    <span className="font-mono text-zinc-900 font-bold">
                      {item.qty} pcs <span className="text-zinc-400 text-[10px]">({item.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-zinc-900 rounded-full transition-all duration-300" 
                      style={{ width: `${item.pct}%` }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KOTAK KANAN: EVALUASI JALUR JAHIT & LAYANAN */}
        <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-1.5">
              <Users2 className="h-4 w-4 text-zinc-600" /> Evaluasi Kapasitas & Model Bisnis
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Efisiensi Workshop</span>
          </div>

          <div className="space-y-4 pt-1">
            {/* 1. Alokasi Beban Jahit */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 font-medium">Alokasi Lini Jahit:</span>
                <span className="font-mono text-xs font-bold text-zinc-900">
                  Internal {operationalStats.internalPct}% &bull; Makloon {operationalStats.makloonPct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300" 
                  style={{ width: `${operationalStats.internalPct}%` }} 
                  title={`Internal: ${operationalStats.internalPcs} pcs`}
                />
                <div 
                  className="h-full bg-purple-600 transition-all duration-300" 
                  style={{ width: `${operationalStats.makloonPct}%` }} 
                  title={`Makloon: ${operationalStats.makloonPcs} pcs`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
                <span>Internal: <strong>{operationalStats.internalPcs} pcs</strong></span>
                <span>Makloon Luar: <strong>{operationalStats.makloonPcs} pcs</strong></span>
              </div>
            </div>

            {/* 2. Tipe Layanan Order */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 font-medium">Model Layanan:</span>
                <span className="font-mono text-xs font-bold text-zinc-900">
                  Full Order {operationalStats.fullOrderPct}% &bull; Print+Press {operationalStats.printPressPct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-zinc-900 transition-all duration-300" 
                  style={{ width: `${operationalStats.fullOrderPct}%` }} 
                  title={`Full Order: ${operationalStats.fullOrderPcs} pcs`}
                />
                <div 
                  className="h-full bg-zinc-400 transition-all duration-300" 
                  style={{ width: `${operationalStats.printPressPct}%` }} 
                  title={`Print+Press: ${operationalStats.printPressPcs} pcs`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-0.5">
                <span>Full Order: <strong>{operationalStats.fullOrderPcs} pcs</strong></span>
                <span>Jasa Print+Press: <strong>{operationalStats.printPressPcs} pcs</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TREN SEBARAN UKURAN PASAR (SIZE BREAKDOWN) */}
      <div className="bg-white border border-zinc-200 rounded p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
          <span className="text-xs font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-1.5">
            <PieChart className="h-4 w-4 text-zinc-600" /> Profil Sebaran Ukuran Terpopuler (Pasar Manayra)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Dihitung dari Matriks Ukuran</span>
        </div>

        {sizeStats.length === 0 ? (
          <div className="py-6 text-center text-zinc-400 text-xs">Belum ada rincian ukuran pada periode ini.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
            {sizeStats.map((item) => (
              <div key={item.size} className="p-2.5 border border-zinc-200 bg-zinc-50/60 rounded space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-900 font-mono">{item.size}</span>
                  <span className="text-[10px] text-zinc-500 font-bold">{item.pct}%</span>
                </div>
                <div className="text-sm font-mono font-black text-zinc-900">
                  {item.count} <span className="text-[9px] font-normal text-zinc-500">pcs</span>
                </div>
                <div className="w-full h-1 bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
