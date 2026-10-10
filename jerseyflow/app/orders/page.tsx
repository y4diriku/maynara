"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  Search, Eye, Printer, ArrowLeft, RefreshCw, 
  Layers, CheckCircle2, Package, TrendingUp, AlertCircle, 
  Clock, Calendar, Filter, ChevronDown, ChevronUp, Wallet, Coins
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  customer_phone?: string | null
  total_qty: number
  fabric_type: string
  collar_type?: string
  current_status: string
  priority?: string
  deadline_date: string
  created_at: string
  updated_at?: string
  down_payment?: number
  total_price?: number
  is_paid_off?: boolean
  order_type?: string | null
}

type FilterTab = "COMPLETED" | "WIP" | "UNPAID" | "ALL"
type PeriodType = "THIS_MONTH" | "LAST_MONTH" | "CUSTOM" | "ALL_TIME"
type OrderTypeFilter = "ALL" | "FULL_ORDER" | "PRINT_PRESS"

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

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return { label: "Selesai & Diserahkan", className: "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold" }
    case "CANCELLED":
      return { label: "Dibatalkan", className: "bg-red-50 text-red-700 border-red-200" }
    case "DESIGN_QUEUE": return { label: "01. Desain", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "PRINTING": return { label: "02. Print Sublim", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
    case "CUTTING": return { label: "03. Potong Kain", className: "bg-amber-50 text-amber-700 border-amber-200" }
    case "HEAT_PRESS": return { label: "04. Press Kain", className: "bg-rose-50 text-rose-700 border-rose-200" }
    case "PATTERN_CUTTING": return { label: "05. Potong Pola", className: "bg-teal-50 text-teal-700 border-teal-200" }
    case "SEWING": return { label: "06. Lini Jahit", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "QC_PACKING": return { label: "07. QC & Pack", className: "bg-violet-50 text-violet-700 border-violet-200" }
    case "READY_FOR_DELIVERY": return { label: "08. Siap Ambil", className: "bg-zinc-900 text-white border-zinc-900 font-bold" }
    default: return { label: status.replace(/_/g, " "), className: "bg-zinc-100 text-zinc-700 border-zinc-200" }
  }
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

export default function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  
  // TABS & FILTERS
  const [activeTab, setActiveTab] = useState<FilterTab>("COMPLETED")
  const [period, setPeriod] = useState<PeriodType>("THIS_MONTH")
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>("ALL")
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "EXPRESS_ALL" | "URGENT" | "HIGH" | "NORMAL">("ALL")

  // EXPANDABLE REPORTS
  const [showExtraReports, setShowExtraReports] = useState(false)

  // RBAC
  const [userRole, setUserRole] = useState<string>("")
  const [isRoleChecked, setIsRoleChecked] = useState(false)

  const canViewFinancials = useMemo(() => {
    const roleUpper = userRole.toUpperCase()
    return roleUpper === "OWNER" || roleUpper === "ACCOUNTING"
  }, [userRole])

  const checkUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()
        if (profile?.role) setUserRole(profile.role)
      }
    } catch (err) {} finally { setIsRoleChecked(true) }
  }

  const loadOrders = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false })
      if (!error && data) setOrders(data)
    } catch (err) {} finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    checkUserRole()
    loadOrders()
    const channel = supabase.channel("orders_recap").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // =========================================================================
  // CALCULATE KPI (AKURASI KEUANGAN & PRODUKSI)
  // =========================================================================
  const stats = useMemo(() => {
    const completedOrders = orders.filter((o) => o.current_status === "COMPLETED")
    const wipOrders = orders.filter((o) => o.current_status !== "COMPLETED" && o.current_status !== "CANCELLED")

    // Tanggal selesai pakai updated_at, WIP pakai created_at
    const completedInPeriod = completedOrders.filter(o => isDateInPeriod(o.updated_at, period, customMonth))
    const wipInPeriod = wipOrders.filter(o => isDateInPeriod(o.created_at, period, customMonth))

    // 1. KPI UTAMA
    const totalPesananSelesai = completedInPeriod.length
    const totalPcsSelesai = completedInPeriod.reduce((sum, o) => sum + Number(o.total_qty || 0), 0)
    const nilaiPesananSelesai = completedInPeriod.reduce((sum, o) => sum + Number(o.total_price || 0), 0)
    
    // Piutang Global (Semua waktu, dari order yang sedang dikerjakan)
    const totalPiutangGlobal = wipOrders.reduce((sum, o) => {
      const sisa = Number(o.total_price || 0) - Number(o.down_payment || 0)
      return sisa > 0 && !o.is_paid_off ? sum + sisa : sum
    }, 0)

    // 2. LAPORAN KEUANGAN TAMBAHAN (Owner Only) - Disederhanakan
    const uangMasukWIP = wipInPeriod.reduce((sum, o) => sum + Number(o.down_payment || 0), 0)
    const uangMasukSelesai = completedInPeriod.reduce((sum, o) => sum + Number(o.down_payment || 0), 0)
    const totalUangMasukPeriode = uangMasukWIP + uangMasukSelesai

    const nilaiPesananWIP = wipOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0)

    // Indikator Tab
    const countCompleted = completedOrders.length
    const countWip = wipOrders.length
    const countUnpaid = wipOrders.filter(o => (Number(o.total_price || 0) - Number(o.down_payment || 0)) > 0 && !o.is_paid_off).length

    return {
      totalPesananSelesai, totalPcsSelesai, nilaiPesananSelesai, totalPiutangGlobal,
      totalUangMasukPeriode, nilaiPesananWIP,
      countCompleted, countWip, countUnpaid, totalInDb: orders.length,
      orderMasukBulanIni: wipInPeriod.length + completedInPeriod.length
    }
  }, [orders, period, customMonth])

  // =========================================================================
  // FILTER TAB & PENCARIAN
  // =========================================================================
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tipe Order Filter
      if (orderTypeFilter !== "ALL") {
        if (orderTypeFilter === "FULL_ORDER" && o.order_type === "PRINT_PRESS") return false
        if (orderTypeFilter === "PRINT_PRESS" && o.order_type !== "PRINT_PRESS") return false
      }

      // Filter Prioritas Layanan
      if (priorityFilter === "NORMAL" && o.priority !== "NORMAL") return false
      if (priorityFilter === "EXPRESS_ALL" && o.priority !== "HIGH" && o.priority !== "URGENT") return false
      if (priorityFilter === "URGENT" && o.priority !== "URGENT") return false
      if (priorityFilter === "HIGH" && o.priority !== "HIGH") return false

      const sisaTagihan = Number(o.total_price || 0) - Number(o.down_payment || 0)

      // Tab Filter + Date Constraint
      if (activeTab === "COMPLETED") {
        if (o.current_status !== "COMPLETED") return false
        if (!isDateInPeriod(o.updated_at, period, customMonth)) return false
      } else if (activeTab === "WIP") {
        if (o.current_status === "COMPLETED" || o.current_status === "CANCELLED") return false
        if (period !== "ALL_TIME" && !isDateInPeriod(o.created_at, period, customMonth)) return false
      } else if (activeTab === "UNPAID") {
        // Tab Belum Lunas difokuskan pada order aktif
        if (o.current_status === "COMPLETED" || o.current_status === "CANCELLED" || sisaTagihan <= 0 || o.is_paid_off) return false
      } else {
        if (!isDateInPeriod(o.created_at, period, customMonth)) return false
      }

      // Search Query (No Order, Nama Order, Nama Pemesan)
      const q = query.toLowerCase().trim()
      if (!q) return true
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.order_title && o.order_title.toLowerCase().includes(q)) ||
        o.customer_name.toLowerCase().includes(q)
      )
    })
  }, [orders, activeTab, period, customMonth, query, orderTypeFilter, priorityFilter])

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Daftar Pesanan & Arsip Produksi</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-white shadow-2xs">
              Periode: {getPeriodLabel(period, customMonth)}
            </span>
            {isRoleChecked && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                canViewFinancials ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }`}>
                {canViewFinancials ? "Akses Owner" : "Akses Operasional"}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600">Buku besar rekapitulasi data pesanan, pencarian riwayat, dan pemantauan kinerja.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadOrders(true)} className="p-2 border border-zinc-200 rounded text-zinc-600 hover:bg-zinc-50 shadow-2xs">
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
          </button>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors shadow-2xs">
            <ArrowLeft className="h-3.5 w-3.5" /><span>Papan Kanban</span>
          </Link>
        </div>
      </div>

      {/* 2. KARTU KPI UTAMA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Pesanan Selesai</span>
            <span className="text-xl font-mono font-black text-emerald-700 leading-none">{stats.totalPesananSelesai}</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Produksi Selesai</span>
            <span className="text-xl font-mono font-black text-zinc-900 leading-none">
              {stats.totalPcsSelesai.toLocaleString("id-ID")} <span className="text-[10px] font-bold text-zinc-500">PCS</span>
            </span>
          </div>
        </div>

        {canViewFinancials ? (
          <>
            <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-teal-700" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Nilai Pesanan Selesai</span>
                <span className="text-base font-mono font-black text-teal-800 leading-none">{formatIDR(stats.nilaiPesananSelesai)}</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Total Uang Masuk</span>
                <span className="text-base font-mono font-black text-emerald-700 leading-none">{formatIDR(stats.totalUangMasukPeriode)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Order Masuk Baru</span>
                <span className="text-xl font-mono font-black text-purple-700 leading-none">{stats.orderMasukBulanIni}</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded p-3 shadow-2xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Sedang Produksi (WIP)</span>
                <span className="text-xl font-mono font-black text-amber-700 leading-none">{stats.countWip}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2B. LAPORAN KEUANGAN TAMBAHAN (Disederhanakan & Relevan) */}
      {canViewFinancials && (
        <div className="bg-white border border-zinc-200 rounded shadow-2xs overflow-hidden">
          <button 
            onClick={() => setShowExtraReports(!showExtraReports)}
            className="w-full px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-between transition-colors border-b border-zinc-200"
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-zinc-600" />
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide">Rincian Laporan Keuangan Tambahan</span>
            </div>
            {showExtraReports ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </button>
          
          {showExtraReports && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
              <div className="space-y-1 border-b md:border-b-0 md:border-r border-zinc-100 pb-3 md:pb-0 md:pr-4">
                <span className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1.5"><Coins className="h-3 w-3" /> Uang Masuk (Periode Ini)</span>
                <span className="text-sm font-mono font-black text-emerald-700 block">{formatIDR(stats.totalUangMasukPeriode)}</span>
                <p className="text-[9px] text-zinc-400 leading-tight">Total uang muka (DP) dan pelunasan yang tercatat pada periode terpilih.</p>
              </div>
              <div className="space-y-1 border-b md:border-b-0 md:border-r border-zinc-100 pb-3 md:pb-0 md:pr-4">
                <span className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> Piutang Berjalan (WIP)</span>
                <span className="text-sm font-mono font-black text-amber-700 block">{formatIDR(stats.totalPiutangGlobal)}</span>
                <p className="text-[9px] text-zinc-400 leading-tight">Sisa tagihan yang masih tertahan pada order di lantai produksi (Kanban).</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1.5"><Layers className="h-3 w-3" /> Potensi Omset Aktif (WIP)</span>
                <span className="text-sm font-mono font-black text-zinc-900 block">{formatIDR(stats.nilaiPesananWIP)}</span>
                <p className="text-[9px] text-zinc-400 leading-tight">Nilai total kotor dari seluruh pesanan yang sedang digarap saat ini.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. BAR NAVIGASI & FILTER RAPI (2 BARIS TERPISAH) */}
      <div className="flex flex-col gap-2.5 bg-white p-3 border border-zinc-200 rounded shadow-2xs">
        {/* Baris Atas: Tabs (Horizontal Scrollable on Mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button onClick={() => setActiveTab("COMPLETED")} className={`shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "COMPLETED" ? "bg-zinc-900 text-white shadow-2xs" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            Selesai & Arsip <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeTab === "COMPLETED" ? "bg-zinc-700" : "bg-zinc-300 text-zinc-800"}`}>{stats.countCompleted}</span>
          </button>
          <button onClick={() => setActiveTab("WIP")} className={`shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "WIP" ? "bg-amber-500 text-white shadow-2xs" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            Sedang Produksi (WIP) <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeTab === "WIP" ? "bg-amber-600" : "bg-zinc-300 text-zinc-800"}`}>{stats.countWip}</span>
          </button>
          <button onClick={() => setActiveTab("UNPAID")} className={`shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "UNPAID" ? "bg-red-600 text-white shadow-2xs" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            Belum Lunas <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeTab === "UNPAID" ? "bg-red-700" : "bg-zinc-300 text-zinc-800"}`}>{stats.countUnpaid}</span>
          </button>
          <button onClick={() => setActiveTab("ALL")} className={`shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "ALL" ? "bg-blue-600 text-white shadow-2xs" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            Semua Data <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeTab === "ALL" ? "bg-blue-700" : "bg-zinc-300 text-zinc-800"}`}>{stats.totalInDb}</span>
          </button>
        </div>

        {/* Baris Bawah: Dropdowns & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1.5 border-t border-zinc-100">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs">
              <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value as OrderTypeFilter)} className="bg-transparent font-medium text-zinc-800 focus:outline-none cursor-pointer">
                <option value="ALL">Semua Tipe Order</option>
                <option value="FULL_ORDER">Full Order</option>
                <option value="PRINT_PRESS">Print + Press Saja</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs">
              <span className="text-[11px]">⚡🔥</span>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)} className="bg-transparent font-medium text-zinc-800 focus:outline-none cursor-pointer">
                <option value="ALL">Semua Prioritas</option>
                <option value="EXPRESS_ALL">⚡🔥 Semua Prioritas Kilat</option>
                <option value="URGENT">🔥 Super Urgent Saja</option>
                <option value="HIGH">⚡ Express / Kilat Saja</option>
                <option value="NORMAL">🟢 Reguler Saja</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodType)} className="bg-transparent font-medium text-zinc-800 focus:outline-none cursor-pointer">
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="LAST_MONTH">Bulan Lalu</option>
                <option value="CUSTOM">Pilih Bulan...</option>
                <option value="ALL_TIME">Semua Waktu</option>
              </select>
              {period === "CUSTOM" && (
                <input type="month" value={customMonth} onChange={(e) => setCustomMonth(e.target.value)} className="text-xs border-l border-zinc-300 pl-2 ml-1 text-zinc-800 focus:outline-none font-mono bg-transparent" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border border-zinc-300 bg-white px-2.5 py-1.5 rounded shadow-inner w-full lg:w-72 shrink-0">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input type="text" placeholder="Cari no order, nama order, pemesan..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full text-xs font-medium focus:outline-none" />
          </div>
        </div>
      </div>

      {/* 4. TABEL PESANAN PROFESIONAL (KOLOM PEMBAYARAN CERDAS) */}
      <div className="border border-zinc-200 bg-white rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">No. Order</th>
                <th className="py-3 px-4">Pelanggan & Pesanan</th>
                <th className="py-3 px-4">Spesifikasi</th>
                <th className="py-3 px-4">
                  {activeTab === "COMPLETED" ? "Tgl Produksi Selesai" : "Target Selesai / Deadline"}
                </th>
                <th className="py-3 px-4">Status & Penyerahan</th>
                {canViewFinancials && <th className="py-3 px-4 text-right">Rincian Pembayaran</th>}
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr><td colSpan={canViewFinancials ? 7 : 6} className="py-12 text-center text-zinc-500 font-mono"><RefreshCw className="h-4 w-4 animate-spin inline mr-2" />Memuat data pesanan...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={canViewFinancials ? 7 : 6} className="py-12 text-center text-zinc-400">Tidak ada pesanan yang sesuai dengan filter.</td></tr>
              ) : (
                filteredOrders.map((o) => {
                  const badge = getStatusBadge(o.current_status)
                  const isCompleted = o.current_status === "COMPLETED"
                  const valOrder = Number(o.total_price || 0)
                  const valPaid = Number(o.down_payment || 0)
                  const sisa = valOrder - valPaid
                  const isLunas = o.is_paid_off || sisa <= 0

                  return (
                    <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
                      {/* Kolom 1: No Order & Badge Prioritas */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/orders/${o.id}`} className="font-mono font-black text-zinc-900 hover:text-blue-600 hover:underline">
                            {o.order_number}
                          </Link>
                          {o.priority === "URGENT" && (
                            <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.2 rounded font-sans tracking-tight shrink-0 animate-pulse">
                              🔥 URGENT
                            </span>
                          )}
                          {o.priority === "HIGH" && (
                            <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded font-sans tracking-tight shrink-0">
                              ⚡ KILAT
                            </span>
                          )}
                        </div>
                        <span className="block text-[9px] text-zinc-400 font-mono mt-0.5">Dibuat: {formatDateID(o.created_at)}</span>
                      </td>

                      {/* Kolom 2: Pelanggan & Judul */}
                      <td className="py-3 px-4">
                        <strong className="block font-black text-zinc-900 text-[11px] uppercase tracking-tight max-w-[200px] truncate" title={o.order_title || o.customer_name}>
                          {o.order_title || o.customer_name}
                        </strong>
                        <span className="text-[10px] text-zinc-500 block max-w-[200px] truncate">
                          {o.customer_name}
                        </span>
                      </td>

                      {/* Kolom 3: Spesifikasi */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase border ${o.order_type === "PRINT_PRESS" ? "bg-black text-white border-black" : "bg-zinc-100 text-zinc-800 border-zinc-300"}`}>
                            {o.order_type === "PRINT_PRESS" ? "Print+Press" : "Full Order"}
                          </span>
                          <strong className="font-mono text-[11px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {o.total_qty} pcs
                          </strong>
                        </div>
                        <span className="block text-[10px] text-zinc-600 truncate max-w-[150px]" title={o.fabric_type}>{o.fabric_type}</span>
                      </td>

                      {/* Kolom 4: Tanggal Dinamis */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-800">
                        {activeTab === "COMPLETED" ? (
                          <>
                            <span className="block font-bold">{formatDateID(o.updated_at || o.created_at)}</span>
                            <span className="text-[9px] text-zinc-400">Tgl Selesai</span>
                          </>
                        ) : (
                          <>
                            <span className="block font-bold">{formatDateID(o.deadline_date)}</span>
                            <span className="text-[9px] text-zinc-400">Target</span>
                          </>
                        )}
                      </td>

                      {/* Kolom 5: Status Produksi */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border leading-none ${badge.className}`}>
                          {badge.label}
                        </span>
                        {isCompleted && (
                          <span className="block text-[9px] text-zinc-500 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Diserahkan
                          </span>
                        )}
                      </td>

                      {/* Kolom 6: Rincian Keuangan Cerdas (Hanya Owner) */}
                      {canViewFinancials && (
                        <td className="py-3 px-4 text-right">
                          {isLunas ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                                LUNAS
                              </span>
                              <span className="text-[11px] font-mono font-black text-zinc-900">
                                {formatIDR(valOrder)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col text-[10.5px] font-mono leading-tight space-y-0.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">Nilai:</span>
                                <span className="font-bold text-zinc-900">{formatIDR(valOrder)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">Masuk:</span>
                                <span className="font-bold text-emerald-700">{formatIDR(valPaid)}</span>
                              </div>
                              <div className="flex justify-between gap-4 border-t border-zinc-200 pt-0.5 mt-0.5">
                                <span className="font-sans font-bold text-[9px] uppercase text-zinc-700">Sisa:</span>
                                <span className="font-bold text-red-600 bg-red-50 px-1 rounded text-[10px]">{formatIDR(sisa)}</span>
                              </div>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Kolom 7: Aksi */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/orders/${o.id}/spk`} target="_blank" className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors" title="Cetak SPK Produksi">
                            <Printer className="h-3.5 w-3.5" />
                          </Link>
                          <Link href={`/orders/${o.id}`} className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-900 transition-colors" title="Buka Detail Order">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
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
