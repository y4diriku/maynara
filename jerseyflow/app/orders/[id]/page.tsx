"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { compressImage } from "@/lib/imageCompressor"
import Link from "next/link"
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Shirt, 
  User, 
  DollarSign, 
  Layers, 
  Printer, 
  UploadCloud, 
  ImageIcon, 
  FileText, 
  X, 
  PieChart, 
  Users2 
} from "lucide-react"

interface RosterItem {
  id?: string
  player_name: string
  back_number: string
  size: string
  sleeve_type: "SHORT" | "LONG"
  notes: string
}

interface PartnerItem {
  id: string
  name: string
}

const FABRIC_OPTIONS = [
  "Dryfit Milano",
  "Dryfit Jarum",
  "Dryfit Bintik",
  "Dryfit Benzema",
  "Serena Super",
  "Polyester Standard"
]

const COLLAR_OPTIONS = [
  "O-Neck Standar",
  "V-Neck Standar",
  "V-Neck Variasi / Rib",
  "Kerah Polo Kancing",
  "Kerah Mandarin / Sanghai"
]

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "Anak (S-XL)"]

function formatRibuan(num: number): string {
  if (!num || isNaN(num)) return ""
  return num.toLocaleString("id-ID")
}

function parseRibuan(str: string): number {
  const clean = str.replace(/[^0-9]/g, "")
  return clean ? parseInt(clean, 10) : 0
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const [orderNumber, setOrderNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [fabricType, setFabricType] = useState("")
  const [collarType, setCollarType] = useState("")
  const [deadlineDate, setDeadlineDate] = useState("")
  const [priority, setPriority] = useState("NORMAL")

  // Volume & Biaya
  const [totalPrice, setTotalPrice] = useState(0)
  const [downPayment, setDownPayment] = useState(0)
  const [currentStatus, setCurrentStatus] = useState("")
  const [productionNotes, setProductionNotes] = useState("")

  // Pilihan Pelaksana Jahit & Partner Makloon
  const [isMakloon, setIsMakloon] = useState(false)
  const [makloonVendorName, setMakloonVendorName] = useState("")
  const [partnerList, setPartnerList] = useState<PartnerItem[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)

  const [mockupUrl1, setMockupUrl1] = useState<string | null>(null)
  const [mockupUrl2, setMockupUrl2] = useState<string | null>(null)
  const [mockupUrl3, setMockupUrl3] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)

  const [roster, setRoster] = useState<RosterItem[]>([])

  useEffect(() => {
    async function loadData() {
      if (!orderId) return
      setLoading(true)

      const { data: oData, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (oErr || !oData) {
        setMsg("Pesanan tidak ditemukan.")
        setLoading(false)
        return
      }

      setOrderNumber(oData.order_number)
      setCustomerName(oData.customer_name)
      setCustomerPhone(oData.customer_phone)
      setFabricType(oData.fabric_type)
      setCollarType(oData.collar_type)
      setDeadlineDate(oData.deadline_date)
      setPriority(oData.priority || "NORMAL")
      setTotalPrice(Number(oData.total_price) || 0)
      setDownPayment(Number(oData.down_payment) || 0)
      setCurrentStatus(oData.current_status)
      setProductionNotes(oData.production_notes || "")
      setIsMakloon(Boolean(oData.is_makloon))
      setMakloonVendorName(oData.makloon_vendor_name || "")
      setMockupUrl1(oData.mockup_url || null)
      setMockupUrl2(oData.mockup_url_2 || null)
      setMockupUrl3(oData.mockup_url_3 || null)

      setLoadingPartners(true)
      const { data: pData } = await supabase
        .from("makloon_partners")
        .select("*")
        .order("created_at", { ascending: false })

      if (pData && pData.length > 0) {
        setPartnerList(pData.map((p: any) => ({
          id: p.id,
          name: p.name || p.partner_name || p.vendor_name || "Tanpa Nama"
        })))
      }
      setLoadingPartners(false)

      const { data: rData } = await supabase
        .from("order_roster_items")
        .select("*")
        .eq("order_id", orderId)

      if (rData) {
        setRoster(rData.map((r: any) => ({
          id: r.id,
          player_name: r.player_name,
          back_number: r.back_number,
          size: r.size,
          sleeve_type: r.sleeve_type,
          notes: r.notes || "",
        })))
      }

      setLoading(false)
    }

    loadData()
  }, [orderId])

  const sizeSummary = useMemo(() => {
    const summary: { [key: string]: number } = {}
    roster.forEach((item) => {
      const sz = item.size || "L"
      summary[sz] = (summary[sz] || 0) + 1
    })
    return Object.entries(summary).sort((a, b) => b[1] - a[1])
  }, [roster])

  // Menyesuaikan total baris dari input jumlah pcs di atas
  const handleQtyChange = (newQty: number) => {
    if (newQty > 0 && newQty <= 100) {
      if (newQty > roster.length) {
        const extraRows = Array.from({ length: newQty - roster.length }, () => ({
          player_name: "",
          back_number: "",
          size: "L",
          sleeve_type: "SHORT" as const,
          notes: ""
        }))
        setRoster([...roster, ...extraRows])
      } else if (newQty < roster.length) {
        setRoster(roster.slice(0, newQty))
      }
    }
  }

  const handleUploadMockup = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) => {
    const file = e.target.files?.[0]
    if (!file || !orderId) return

    setUploadingSlot(slot)
    setMsg("")

    try {
      const compressedBlob = await compressImage(file, 1600, 0.8)
      const fileName = `mockup-${orderId}-slot${slot}.webp`

      const { error: uploadError } = await supabase.storage
        .from("order-mockups")
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from("order-mockups")
        .getPublicUrl(fileName)

      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      const columnKey = slot === 1 ? "mockup_url" : slot === 2 ? "mockup_url_2" : "mockup_url_3"

      await supabase.from("orders").update({ [columnKey]: freshUrl }).eq("id", orderId)

      if (slot === 1) setMockupUrl1(freshUrl)
      else if (slot === 2) setMockupUrl2(freshUrl)
      else setMockupUrl3(freshUrl)

      setMsg(`Gambar ${slot} berhasil diunggah!`)
    } catch (err: any) {
      setMsg("Gagal unggah: " + err.message)
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleDeleteMockup = async (slot: 1 | 2 | 3) => {
    const columnKey = slot === 1 ? "mockup_url" : slot === 2 ? "mockup_url_2" : "mockup_url_3"
    await supabase.from("orders").update({ [columnKey]: null }).eq("id", orderId)
    if (slot === 1) setMockupUrl1(null)
    else if (slot === 2) setMockupUrl2(null)
    else setMockupUrl3(null)
  }

  const handleAddRow = () => {
    setRoster([
      ...roster,
      { player_name: "", back_number: "", size: "L", sleeve_type: "SHORT", notes: "" }
    ])
  }

  const handleRemoveRow = (idx: number) => {
    if (roster.length <= 1) return
    setRoster(roster.filter((_, i) => i !== idx))
  }

  const handleRosterChange = (idx: number, field: keyof RosterItem, val: string) => {
    const updated = [...roster]
    updated[idx] = { ...updated[idx], [field]: val }
    setRoster(updated)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg("")

    try {
      const totalQty = roster.length
      const isPaid = downPayment >= totalPrice

      const { error: oErr } = await supabase
        .from("orders")
        .update({
          customer_name: customerName,
          customer_phone: customerPhone,
          fabric_type: fabricType,
          collar_type: collarType,
          deadline_date: deadlineDate,
          priority: priority,
          total_qty: totalQty,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: isPaid,
          production_notes: productionNotes,
          is_makloon: isMakloon,
          makloon_vendor_name: isMakloon ? makloonVendorName.trim() : null
        })
        .eq("id", orderId)

      if (oErr) throw oErr

      await supabase.from("order_roster_items").delete().eq("order_id", orderId)

      const rosterPayload = roster.map((r) => ({
        order_id: orderId,
        player_name: r.player_name.trim() || "-",
        back_number: r.back_number.trim() || "-",
        size: r.size,
        sleeve_type: r.sleeve_type,
        notes: r.notes.trim() || null,
      }))

      const { error: rErr } = await supabase.from("order_roster_items").insert(rosterPayload)
      if (rErr) throw rErr

      setMsg("Data pesanan, jalur jahit, catatan, dan rincian ukuran berhasil disimpan!")
    } catch (err: any) {
      setMsg("Gagal menyimpan: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono">Memuat detail pesanan...</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-900 leading-tight">Edit Pesanan</h1>
              <span className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded font-bold text-zinc-800 border border-zinc-300">
                {orderNumber}
              </span>
            </div>
            <p className="text-xs text-zinc-600">Kelola spesifikasi, galeri mockup desain, jalur pengerjaan jahit, dan rincian pesanan.</p>
          </div>
        </div>

        <Link
          href={`/orders/${orderId}/spk`}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 text-xs font-semibold shadow-2xs transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Cetak SPK</span>
        </Link>
      </div>

      {msg && (
        <div className={`p-3 rounded text-xs font-medium border ${
          msg.includes("berhasil") 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg}
        </div>
      )}

      {/* 3 SLOT MOCKUP GRID */}
      <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
        <div>
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-zinc-600" /> Galeri Mockup Desain (Maksimal 3 Gambar)
          </span>
          <p className="text-[11px] text-zinc-500">
            Gambar otomatis menyesuaikan layout SPK: 1 kotak jika 1 gambar, 2 kotak jika 2 gambar, atau 3 kotak simetris.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Slot 1 */}
          <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 1 (Utama)</span>
              {mockupUrl1 && (
                <button type="button" onClick={() => handleDeleteMockup(1)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar 1">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl1 ? (
              <div className="h-40 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white">
                <img src={mockupUrl1} alt="Gambar 1" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-40 border border-dashed border-zinc-300 rounded flex flex-col items-center justify-center text-zinc-400 text-[11px]">
                <span>Slot Kosong</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-[11px] font-medium transition-colors">
              <UploadCloud className="h-3 w-3" />
              <span>{uploadingSlot === 1 ? "Mengunggah..." : mockupUrl1 ? "Ganti Gambar" : "Unggah Gambar 1"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 1)} disabled={uploadingSlot === 1} className="hidden" />
            </label>
          </div>

          {/* Slot 2 */}
          <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 2 (Opsional)</span>
              {mockupUrl2 && (
                <button type="button" onClick={() => handleDeleteMockup(2)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar 2">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl2 ? (
              <div className="h-40 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white">
                <img src={mockupUrl2} alt="Gambar 2" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-40 border border-dashed border-zinc-300 rounded flex flex-col items-center justify-center text-zinc-400 text-[11px]">
                <span>Slot Kosong</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-[11px] font-medium transition-colors">
              <UploadCloud className="h-3 w-3" />
              <span>{uploadingSlot === 2 ? "Mengunggah..." : mockupUrl2 ? "Ganti Gambar" : "Unggah Gambar 2"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 2)} disabled={uploadingSlot === 2} className="hidden" />
            </label>
          </div>

          {/* Slot 3 */}
          <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 3 (Opsional)</span>
              {mockupUrl3 && (
                <button type="button" onClick={() => handleDeleteMockup(3)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar 3">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl3 ? (
              <div className="h-40 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white">
                <img src={mockupUrl3} alt="Gambar 3" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-40 border border-dashed border-zinc-300 rounded flex flex-col items-center justify-center text-zinc-400 text-[11px]">
                <span>Slot Kosong</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-[11px] font-medium transition-colors">
              <UploadCloud className="h-3 w-3" />
              <span>{uploadingSlot === 3 ? "Mengunggah..." : mockupUrl3 ? "Ganti Gambar" : "Unggah Gambar 3"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 3)} disabled={uploadingSlot === 3} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* SPESIFIKASI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-500" /> Informasi Pemesan
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nama Pemesan / Tim</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nomor WhatsApp</label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Status Pipeline</label>
                <input
                  type="text"
                  disabled
                  value={currentStatus.replace(/_/g, " ")}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded bg-zinc-100 text-zinc-600 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5 text-zinc-500" /> Bahan & Model
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Jenis Bahan Kain</label>
                <select
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white"
                >
                  {FABRIC_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Model Pola Kerah</label>
                <select
                  value={collarType}
                  onChange={(e) => setCollarType(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white"
                >
                  {COLLAR_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Prioritas Pengerjaan</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Tinggi (Mepet)</option>
                  <option value="URGENT">Urgent (Express)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kolom 3: Volume Pcs & Biaya Terpadu (Format Ribuan) */}
          <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Volume & Biaya
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-semibold mb-0.5">Total Pcs</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={roster.length || ""}
                    onChange={(e) => handleQtyChange(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 border-2 border-zinc-900 rounded font-mono font-bold bg-zinc-50 text-center text-xs"
                    title="Ubah angka ini untuk otomatis menyesuaikan jumlah baris di bawah"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Target Deadline</label>
                  <input
                    type="date"
                    required
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Total Tagihan (Rp)</label>
                  <input
                    type="text"
                    value={formatRibuan(totalPrice)}
                    onChange={(e) => setTotalPrice(parseRibuan(e.target.value))}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Uang Masuk / DP (Rp)</label>
                  <input
                    type="text"
                    value={formatRibuan(downPayment)}
                    onChange={(e) => setDownPayment(parseRibuan(e.target.value))}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs text-emerald-700 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-1.5 border-t flex justify-between items-center text-xs">
                <span className="text-zinc-600 font-medium">Sisa Tagihan:</span>
                <span className="font-bold font-mono text-sm text-red-600">
                  Rp {(totalPrice - downPayment > 0 ? totalPrice - downPayment : 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* JALUR PENGERJAAN JAHIT */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5 text-zinc-600" /> Jalur Pengerjaan Jahit
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <label className="block text-zinc-700 font-semibold">Tipe Pelaksana</label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sewing_route"
                    checked={!isMakloon}
                    onChange={() => setIsMakloon(false)}
                    className="text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="font-medium text-zinc-800">Jahit Internal Workshop</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sewing_route"
                    checked={isMakloon}
                    onChange={() => setIsMakloon(true)}
                    className="text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="font-medium text-purple-800 font-semibold">Mitra Makloon Luar</span>
                </label>
              </div>
            </div>

            {isMakloon && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-purple-900 font-semibold">Pilih Mitra Makloon</label>
                  <Link href="/makloon" target="_blank" className="text-[10px] text-purple-700 hover:underline">
                    + Kelola Partner
                  </Link>
                </div>

                {loadingPartners ? (
                  <div className="text-zinc-400 font-mono text-[11px] py-1.5">Memuat daftar partner...</div>
                ) : partnerList.length > 0 ? (
                  <select
                    value={makloonVendorName}
                    onChange={(e) => setMakloonVendorName(e.target.value)}
                    required={isMakloon}
                    className="w-full px-2.5 py-1.5 border border-purple-300 rounded text-xs focus:ring-1 focus:ring-purple-600 focus:outline-none bg-purple-50/50 font-medium text-zinc-900"
                  >
                    <option value="">-- Pilih Partner Makloon Terdaftar --</option>
                    {partnerList.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Belum ada data partner di menu Makloon, ketik nama di sini..."
                      value={makloonVendorName}
                      onChange={(e) => setMakloonVendorName(e.target.value)}
                      required={isMakloon}
                      className="w-full px-2.5 py-1.5 border border-purple-300 rounded text-xs focus:ring-1 focus:ring-purple-600 focus:outline-none bg-purple-50/50 text-zinc-900"
                    />
                    <span className="text-[10px] text-amber-700 block">
                      Tip: Daftarkan partner di menu <strong>Partner Makloon</strong> agar tersimpan rapi sebagai dropdown.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CATATAN TEKNIS */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-2">
          <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-zinc-500" /> Catatan Teknis & Instruksi Produksi
          </span>
          <textarea
            rows={3}
            value={productionNotes}
            onChange={(e) => setProductionNotes(e.target.value)}
            placeholder="Contoh: Badan depan gradasi merah-hitam, motif celana garis samping emas. Kerah model rib V-Neck."
            className="w-full p-2.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none text-zinc-800 leading-relaxed placeholder:text-zinc-400"
          />
        </div>

        {/* TABEL RINCIAN UKURAN & NAMA */}
        <div className="border border-zinc-200 bg-white rounded overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5 uppercase tracking-tight">
                <Layers className="h-3.5 w-3.5 text-zinc-600" /> Daftar Rincian Pesanan ({roster.length} Pcs)
              </span>
              
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <PieChart className="h-3 w-3" /> Sebaran:
                </span>
                {sizeSummary.map(([sz, count]) => (
                  <span key={sz} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-200/80 text-zinc-800 border border-zinc-300">
                    <span>{sz}:</span>
                    <span className="text-zinc-950">{count} pcs</span>
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[11px] font-medium px-2.5 py-1.5 rounded transition-colors shadow-2xs self-start sm:self-auto"
            >
              <Plus className="h-3 w-3" /> Tambah Baris Manual
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3 w-10 text-center">No</th>
                  <th className="py-2 px-3 min-w-[160px]">Nama Punggung</th>
                  <th className="py-2 px-3 w-28">No Punggung</th>
                  <th className="py-2 px-3 w-28">Ukuran</th>
                  <th className="py-2 px-3 w-32">Lengan</th>
                  <th className="py-2 px-3 min-w-[140px]">Catatan Khusus</th>
                  <th className="py-2 px-2 w-10 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {roster.map((row, index) => (
                  <tr key={index} className="hover:bg-zinc-50/50">
                    <td className="py-1.5 px-3 text-center text-zinc-600 font-mono text-[11px]">{index + 1}</td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        placeholder="Nama pemain / inisial"
                        value={row.player_name}
                        onChange={(e) => handleRosterChange(index, "player_name", e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none uppercase"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        placeholder="00"
                        value={row.back_number}
                        onChange={(e) => handleRosterChange(index, "back_number", e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-xs font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none text-center"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <select
                        value={row.size}
                        onChange={(e) => handleRosterChange(index, "size", e.target.value)}
                        className="w-full px-1.5 py-1 border border-zinc-200 rounded text-xs bg-white focus:outline-none font-semibold"
                      >
                        {SIZE_OPTIONS.map((sz) => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-3">
                      <select
                        value={row.sleeve_type}
                        onChange={(e) => handleRosterChange(index, "sleeve_type", e.target.value as any)}
                        className="w-full px-1.5 py-1 border border-zinc-200 rounded text-xs bg-white focus:outline-none"
                      >
                        <option value="SHORT">Pendek</option>
                        <option value="LONG">Panjang (+Manset)</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        placeholder="Opsional (cth: Kiper / Polos)"
                        value={row.notes}
                        onChange={(e) => handleRosterChange(index, "notes", e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-xs focus:outline-none text-zinc-600"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        disabled={roster.length <= 1}
                        className="text-zinc-400 hover:text-red-600 disabled:opacity-30 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/orders"
            className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            Kembali
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Menyimpan Perubahan..." : "Simpan Pembaruan Data"}
          </button>
        </div>
      </form>
    </div>
  )
}
