"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  Users2, 
  Plus, 
  Phone, 
  MapPin, 
  Shirt, 
  ExternalLink,
  Layers,
  CheckCircle2,
  Search,
  RefreshCw,
  Scissors,
  Package,
  AlertCircle,
  X
} from "lucide-react"

interface MakloonPartner {
  id: string
  partner_name: string
  contact_person: string | null
  phone: string
  address: string | null
  created_at: string
}

interface AssignedOrder {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  total_qty: number
  fabric_type: string
  deadline_date: string
  current_status: string
  is_makloon?: boolean
  makloon_vendor_name?: string | null
  makloon_partner_id?: string | null
  created_at?: string
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

function getStatusBadge(status: string) {
  switch (status) {
    case "DESIGN_QUEUE": return { label: "01. Desain", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "PRINTING": return { label: "02. Print Sublim", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
    case "CUTTING": return { label: "03. Potong Kain", className: "bg-amber-50 text-amber-700 border-amber-200" }
    case "HEAT_PRESS": return { label: "04. Press Kain", className: "bg-rose-50 text-rose-700 border-rose-200" }
    case "PATTERN_CUTTING": return { label: "05. Potong Pola", className: "bg-teal-50 text-teal-700 border-teal-200" }
    case "SEWING": return { label: "06. Lini Jahit", className: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" }
    case "QC_PACKING": return { label: "07. QC & Pack", className: "bg-violet-50 text-violet-700 border-violet-200" }
    case "READY_FOR_DELIVERY": return { label: "08. Siap Ambil", className: "bg-zinc-900 text-white border-zinc-900 font-bold" }
    default: return { label: status.replace(/_/g, " "), className: "bg-zinc-100 text-zinc-700 border-zinc-200" }
  }
}

export default function MakloonPage() {
  const [partners, setPartners] = useState<MakloonPartner[]>([])
  const [orders, setOrders] = useState<AssignedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 3 Tab Fungsional Bersih: MAKLOON (Default) | INTERNAL | PARTNERS
  const [activeFilterTab, setActiveFilterTab] = useState<"MAKLOON" | "INTERNAL" | "PARTNERS">("MAKLOON")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string | null>(null)

  // Modal Tambah Partner State
  const [showAddModal, setShowAddModal] = useState(false)
  const [partnerName, setPartnerName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    setLoading(true)

    try {
      const { data: pData } = await supabase
        .from("makloon_partners")
        .select("*")
        .order("created_at", { ascending: false })

      const { data: oData } = await supabase
        .from("orders")
        .select("id, order_number, order_title, customer_name, total_qty, fabric_type, deadline_date, current_status, is_makloon, makloon_vendor_name, makloon_partner_id, created_at")
        .neq("current_status", "COMPLETED")
        .neq("current_status", "CANCELLED")
        .order("created_at", { ascending: false })

      if (pData) setPartners(pData)
      if (oData) setOrders(oData)
    } catch (err: any) {
      console.error("Gagal memuat data makloon:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel("makloon_page_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "makloon_partners" }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerName.trim() || !phone.trim()) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.from("makloon_partners").insert({
        partner_name: partnerName.trim(),
        contact_person: contactPerson.trim() || null,
        phone: phone.trim(),
        address: address.trim() || null,
      })

      if (error) throw error

      setPartnerName("")
      setContactPerson("")
      setPhone("")
      setAddress("")
      setShowAddModal(false)
      setMessage({ type: "success", text: "Partner makloon berhasil didaftarkan!" })
      loadData()
    } catch (err: any) {
      setMessage({ type: "error", text: "Gagal menyimpan partner: " + err.message })
    } finally {
      setSaving(false)
    }
  }

  const getAssignedPartnerId = (o: AssignedOrder): string => {
    if (o.makloon_partner_id) return o.makloon_partner_id

    if (o.is_makloon && o.makloon_vendor_name) {
      const matched = partners.find(
        (p) => p.partner_name.trim().toLowerCase() === o.makloon_vendor_name?.trim().toLowerCase()
      )
      if (matched) return matched.id
    }
    return ""
  }

  // Alokasi Makloon Terlindungi Konfirmasi (Fail-Safe Action Confirmation)
  const handleAssignMakloon = async (order: AssignedOrder, newPartnerId: string | null) => {
    const currentAssignedId = getAssignedPartnerId(order)
    const currentPartner = partners.find((p) => p.id === currentAssignedId)
    const newPartner = partners.find((p) => p.id === newPartnerId)

    // Jika tidak ada perubahan pilihan
    if ((!currentAssignedId && !newPartnerId) || currentAssignedId === newPartnerId) {
      return
    }

    // Susun pesan konfirmasi tegas sesuai konteks perubahan
    let confirmMsg = ""
    if (!newPartnerId) {
      // Mengubah dari makloon ke internal
      const fromName = currentPartner ? currentPartner.partner_name : order.makloon_vendor_name || "Mitra Luar"
      confirmMsg = `Tarik pesanan "${order.order_number} - ${order.order_title || order.customer_name}" kembali dari ${fromName} untuk dikerjakan oleh tim jahit INTERNAL workshop?`
    } else if (!currentAssignedId) {
      // Mendelegasikan dari internal ke makloon
      confirmMsg = `Delegasikan pesanan "${order.order_number} - ${order.order_title || order.customer_name}" ke mitra makloon ${newPartner?.partner_name}?`
    } else {
      // Mengalihkan antar mitra
      const fromName = currentPartner ? currentPartner.partner_name : "Mitra Sebelumnya"
      confirmMsg = `Alihkan pendelegasian pesanan "${order.order_number} - ${order.order_title || order.customer_name}" dari ${fromName} ke mitra ${newPartner?.partner_name}?`
    }

    // Jika operator menolak / tidak sengaja tersenggol scroll mouse
    if (!window.confirm(confirmMsg)) {
      loadData()
      return
    }

    const isExternal = Boolean(newPartnerId && newPartner)

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          makloon_partner_id: isExternal ? newPartnerId : null,
          makloon_vendor_name: isExternal ? newPartner!.partner_name : null,
          is_makloon: isExternal,
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id)

      if (error) throw error

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                makloon_partner_id: isExternal ? newPartnerId : null,
                makloon_vendor_name: isExternal ? newPartner!.partner_name : null,
                is_makloon: isExternal
              }
            : o
        )
      )

      setMessage({
        type: "success",
        text: isExternal
          ? `Pesanan ${order.order_number} berhasil didelegasikan ke ${newPartner?.partner_name}.`
          : `Pesanan ${order.order_number} ditarik kembali ke lini jahit internal workshop.`
      })
    } catch (err: any) {
      alert("Gagal mengubah alokasi makloon: " + err.message)
    }
  }

  // Ringkasan Eksekutif KPI & Beban Mitra
  const makloonKPI = useMemo(() => {
    const makloonOrders = orders.filter((o) => {
      return Boolean(o.is_makloon || o.makloon_partner_id || o.makloon_vendor_name)
    })

    const totalMakloonOrders = makloonOrders.length
    const totalMakloonPcs = makloonOrders.reduce((sum, o) => sum + Number(o.total_qty || 0), 0)
    const totalInternalOrders = orders.length - totalMakloonOrders
    const totalInternalPcs = orders.reduce((sum, o) => sum + Number(o.total_qty || 0), 0) - totalMakloonPcs

    const partnerLoadMap: Record<string, { orderCount: number; pcsCount: number }> = {}
    partners.forEach((p) => {
      partnerLoadMap[p.id] = { orderCount: 0, pcsCount: 0 }
    })

    makloonOrders.forEach((o) => {
      const pId = getAssignedPartnerId(o)
      if (pId && partnerLoadMap[pId]) {
        partnerLoadMap[pId].orderCount += 1
        partnerLoadMap[pId].pcsCount += Number(o.total_qty || 0)
      }
    })

    return {
      totalMakloonOrders,
      totalMakloonPcs,
      totalInternalOrders,
      totalInternalPcs,
      partnerLoadMap
    }
  }, [orders, partners])

  // Filter Pesanan: Berdasarkan Tab Makloon Luar vs Internal Workshop
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const assignedId = getAssignedPartnerId(o)
      const isOutsourced = Boolean(assignedId || o.is_makloon)

      if (activeFilterTab === "MAKLOON" && !isOutsourced) return false
      if (activeFilterTab === "INTERNAL" && isOutsourced) return false

      if (selectedPartnerFilter && assignedId !== selectedPartnerFilter) {
        return false
      }

      const q = searchQuery.toLowerCase().trim()
      if (!q) return true

      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.order_title && o.order_title.toLowerCase().includes(q)) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.makloon_vendor_name && o.makloon_vendor_name.toLowerCase().includes(q))
      )
    }).sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      return timeB - timeA
    })
  }, [orders, activeFilterTab, selectedPartnerFilter, searchQuery])

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* 1. Header Halaman & Tombol Aksi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Distribusi Jahit & Manajemen Makloon</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300">
              {makloonKPI.totalMakloonOrders} SPK di Mitra Luar
            </span>
          </div>
          <p className="text-xs text-zinc-600">Pantau beban jahit borongan luar, kelola kontak vendor makloon, dan alokasikan SPK aktif.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Mitra Baru</span>
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-600 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-zinc-900" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Pesan Alert Notifikasi */}
      {message && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center justify-between gap-2 ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <div className="flex items-center gap-1.5">
            {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. KARTU RINGKASAN EKSEKUTIF (KPI MAKLOON) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* SPK Makloon Berjalan */}
        <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider flex items-center justify-between">
            SPK Makloon Luar
            <Scissors className="h-4 w-4 text-purple-600" />
          </span>
          <div className="text-xl font-black font-mono text-purple-950 leading-none">
            {makloonKPI.totalMakloonOrders} <span className="text-xs font-bold text-zinc-500">Order</span>
          </div>
          <span className="text-[9.5px] text-purple-800 font-medium block">Sedang dikerjakan mitra luar</span>
        </div>

        {/* Volume Pcs di Luar */}
        <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Kain di Luar Workshop
            <Shirt className="h-4 w-4 text-blue-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-none">
            {makloonKPI.totalMakloonPcs.toLocaleString("id-ID")} <span className="text-xs font-bold text-zinc-500">PCS</span>
          </div>
          <span className="text-[9.5px] text-zinc-500 block">Total volume pakaian di mitra</span>
        </div>

        {/* SPK Internal Workshop */}
        <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Jahit Internal Workshop
            <Package className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-none">
            {makloonKPI.totalInternalOrders} <span className="text-xs font-bold text-zinc-500">Order</span>
          </div>
          <span className="text-[9.5px] text-zinc-500 block">Dikerjakan tim jahit dalam</span>
        </div>

        {/* Mitra Terdaftar */}
        <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center justify-between">
            Mitra Rekanan Aktif
            <Users2 className="h-4 w-4 text-teal-600" />
          </span>
          <div className="text-xl font-black font-mono text-zinc-950 leading-none">
            {partners.length} <span className="text-xs font-bold text-zinc-500">Vendor</span>
          </div>
          <span className="text-[9.5px] text-zinc-500 block">Penjahit borongan terverifikasi</span>
        </div>
      </div>

      {/* 3. WADAH UTAMA TABEL DISTRIBUSI & DIREKTORI MITRA */}
      <div className="border border-zinc-200 bg-white rounded-lg p-4 shadow-2xs space-y-3.5">
        
        {/* NAVIGASI 3 TAB BERSIH: MAKLOON LUAR (DEFAULT) -> INTERNAL WORKSHOP -> MITRA & BEBAN KERJA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => { setActiveFilterTab("MAKLOON"); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilterTab === "MAKLOON" && !selectedPartnerFilter
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
              }`}
            >
              Makloon Luar
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeFilterTab === "MAKLOON" && !selectedPartnerFilter ? "bg-purple-900 text-white" : "bg-purple-200 text-purple-950 font-bold"}`}>
                {makloonKPI.totalMakloonOrders}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveFilterTab("INTERNAL"); setSelectedPartnerFilter(null); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilterTab === "INTERNAL"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              Internal Workshop
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeFilterTab === "INTERNAL" ? "bg-emerald-900 text-white" : "bg-emerald-200 text-emerald-950 font-bold"}`}>
                {makloonKPI.totalInternalOrders}
              </span>
            </button>

            <span className="text-zinc-300 mx-1 hidden sm:inline">|</span>

            {/* TAB DIREKTORI: MITRA & BEBAN KERJA */}
            <button
              type="button"
              onClick={() => { setActiveFilterTab("PARTNERS"); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeFilterTab === "PARTNERS"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <Users2 className="h-3.5 w-3.5" />
              <span>Mitra & Beban Kerja</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${activeFilterTab === "PARTNERS" ? "bg-blue-900 text-white" : "bg-blue-200 text-blue-950 font-bold"}`}>
                {partners.length}
              </span>
            </button>
          </div>

          {/* Kotak Pencarian */}
          {activeFilterTab !== "PARTNERS" && (
            <div className="flex items-center gap-1.5 border border-zinc-300 rounded px-2.5 py-1.5 text-xs w-full sm:w-60 bg-zinc-50/50 shadow-inner">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari order, pemesan, mitra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* KONTEN TAB: MITRA & BEBAN KERJA */}
        {activeFilterTab === "PARTNERS" ? (
          <div className="space-y-3 pt-1">
            <div className="border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-900 flex items-center gap-1.5">
                <Users2 className="h-4 w-4 text-zinc-700" /> Direktori Mitra Rekanan & Beban SPK
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Pantau nomor kontak WhatsApp, alamat workshop, dan jumlah pakaian yang sedang dikerjakan masing-masing penjahit.</p>
            </div>

            {partners.length === 0 ? (
              <div className="text-xs text-zinc-400 py-10 text-center border border-dashed border-zinc-200 rounded-lg">
                Belum ada mitra makloon terdaftar. Klik tombol &ldquo;Tambah Mitra Baru&rdquo; di kanan atas.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                {partners.map((p) => {
                  const load = makloonKPI.partnerLoadMap[p.id] || { orderCount: 0, pcsCount: 0 }
                  const hasLoad = load.orderCount > 0

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/60 hover:bg-white hover:border-zinc-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <strong className="text-zinc-950 font-bold text-xs truncate block" title={p.partner_name}>
                            {p.partner_name}
                          </strong>
                          {hasLoad ? (
                            <span className="font-mono text-[9px] font-black bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.2 rounded shrink-0">
                              {load.orderCount} SPK &bull; {load.pcsCount} pcs
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] text-zinc-400 shrink-0">Kosong</span>
                          )}
                        </div>

                        <div className="text-[11px] text-zinc-600 flex items-center justify-between pt-0.5">
                          <span className="text-zinc-500 truncate">PIC: {p.contact_person || "-"}</span>
                          <a
                            href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 hover:underline shrink-0"
                            title="Kirim Pesan WhatsApp"
                          >
                            <Phone className="h-3 w-3 text-emerald-600" />
                            <span>{p.phone}</span>
                          </a>
                        </div>

                        {p.address && (
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1 truncate pt-1 border-t border-zinc-200/60">
                            <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span className="truncate">{p.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Tombol Pintasan Melihat Order Milik Mitra Ini */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPartnerFilter(p.id);
                          setActiveFilterTab("MAKLOON");
                        }}
                        className="w-full mt-2 py-1.5 px-2 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-[11px] font-semibold rounded transition-colors text-center cursor-pointer shadow-2xs"
                      >
                        Lihat SPK Mitra Ini ({load.orderCount}) &rarr;
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* KONTEN TAB OPERASIONAL: TABEL DISTRIBUSI JAHIT (MAKLOON LUAR / INTERNAL WORKSHOP) */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-zinc-600" />
                  {activeFilterTab === "MAKLOON" ? "Daftar Pesanan Makloon Luar" : "Daftar Pesanan Jahit Internal"}
                </span>
                {selectedPartnerFilter && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-600 text-white shadow-2xs inline-flex items-center gap-1">
                    <span>Mitra: {partners.find(p => p.id === selectedPartnerFilter)?.partner_name}</span>
                    <button type="button" onClick={() => setSelectedPartnerFilter(null)} className="hover:text-red-200 cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                {activeFilterTab === "MAKLOON" 
                  ? "Pesanan yang sedang dirakit oleh penjahit luar rekanan workshop."
                  : "Pesanan yang sedang dikerjakan oleh tim penjahit dalam workshop."}
              </p>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-lg">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">No. Order</th>
                    <th className="py-3 px-4">Nama Order & Pemesan</th>
                    <th className="py-3 px-4 text-center">Qty / Bahan</th>
                    <th className="py-3 px-4">Target Selesai</th>
                    <th className="py-3 px-4">Pos Saat Ini</th>
                    <th className="py-3 px-4 min-w-[210px]">Alokasi Penjahit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400 font-mono">
                        <RefreshCw className="h-4 w-4 animate-spin inline mr-2 text-zinc-900" />
                        Memuat data pesanan...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-zinc-400 text-xs font-sans">
                        Tidak ada pesanan pada tab {activeFilterTab === "MAKLOON" ? "Makloon Luar" : "Internal Workshop"}.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const assignedPartnerId = getAssignedPartnerId(o)
                      const isOutsourced = Boolean(assignedPartnerId || o.is_makloon)
                      const statusBadge = getStatusBadge(o.current_status)

                      return (
                        <tr 
                          key={o.id} 
                          className={`transition-colors ${
                            isOutsourced ? "bg-purple-50/40 hover:bg-purple-50/70" : "hover:bg-zinc-50/70"
                          }`}
                        >
                          {/* No. Order Clickable Menuju Detail */}
                          <td className="py-3 px-4 font-mono">
                            <Link
                              href={`/orders/${o.id}`}
                              className="font-black text-zinc-950 hover:text-blue-600 hover:underline inline-flex items-center gap-1.5"
                              title="Buka Detail Pesanan Lengkap"
                            >
                              <span>{o.order_number}</span>
                              <ExternalLink className="h-3 w-3 text-zinc-400" />
                            </Link>
                          </td>

                          {/* Nama Order & Pemesan */}
                          <td className="py-3 px-4">
                            <Link
                              href={`/orders/${o.id}`}
                              className="block font-black text-zinc-950 uppercase text-xs leading-tight hover:text-blue-600 truncate max-w-[260px]"
                              title={o.order_title || o.customer_name}
                            >
                              {o.order_title || o.customer_name}
                            </Link>
                            <span className="text-[10.5px] text-zinc-500 block truncate max-w-[260px] mt-0.5">
                              Pemesan: <strong>{o.customer_name}</strong>
                            </span>
                          </td>

                          {/* Qty & Bahan Kain */}
                          <td className="py-3 px-4 text-center">
                            <strong className="font-mono text-zinc-950 text-xs block">{o.total_qty} pcs</strong>
                            <span className="text-[10px] text-zinc-500 block truncate max-w-[140px]">{o.fabric_type}</span>
                          </td>

                          {/* Deadline Date */}
                          <td className="py-3 px-4 font-mono text-[11px] text-red-700 font-bold">
                            {formatDateID(o.deadline_date)}
                          </td>

                          {/* Posisi Kanban Saat Ini */}
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border leading-none ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </td>

                          {/* Dropdown Alokasi dengan Perlindungan Konfirmasi Dialog */}
                          <td className="py-3 px-4">
                            <select
                              value={assignedPartnerId}
                              onChange={(e) => handleAssignMakloon(o, e.target.value || null)}
                              className={`w-full px-2.5 py-1.5 text-xs border rounded font-semibold focus:outline-none transition-colors shadow-2xs cursor-pointer ${
                                isOutsourced
                                  ? "bg-purple-50 border-purple-300 text-purple-950 font-bold"
                                  : "bg-white border-zinc-300 text-zinc-700"
                              }`}
                            >
                              <option value="">-- Dikerjakan Internal --</option>
                              {partners.map((p) => (
                                <option key={p.id} value={p.id}>
                                  Makloon: {p.partner_name}
                                </option>
                              ))}
                              {o.is_makloon && o.makloon_vendor_name && !partners.some(p => p.partner_name.trim().toLowerCase() === o.makloon_vendor_name?.trim().toLowerCase()) && (
                                <option value={o.makloon_vendor_name}>
                                  Makloon: {o.makloon_vendor_name} (Manual)
                                </option>
                              )}
                            </select>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL POPUP DIALOG: DAFTARKAN PARTNER BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-sm">
                <Plus className="h-4 w-4 text-purple-700" />
                <span>Daftarkan Partner Makloon Baru</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Daftarkan penjahit borongan luar atau vendor rekanan workshop untuk memudahkan pendelegasian jahitan.
            </p>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Nama Vendor / Penjahit</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makloon Berkah Mandiri"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Penanggung Jawab (Mandor / PIC)</label>
                <input
                  type="text"
                  placeholder="Contoh: Pak Agus"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Nomor WhatsApp Aktif</label>
                <input
                  type="text"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Alamat / Lokasi Workshop</label>
                <input
                  type="text"
                  placeholder="Lokasi workshop rekanan..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-zinc-300 rounded text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
                >
                  {saving ? "Menyimpan..." : "Simpan Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
