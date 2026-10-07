"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { ArrowLeft, Save, Plus, Trash2, Users2, Shirt, User, DollarSign, Layers } from "lucide-react"

interface RosterItem {
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

export default function NewOrderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [catatanDesain, setCatatanDesain] = useState("")
  const [linkDriveAset, setLinkDriveAset] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [fabricType, setFabricType] = useState(FABRIC_OPTIONS[0])
  const [collarType, setCollarType] = useState(COLLAR_OPTIONS[0])
  const [deadlineDate, setDeadlineDate] = useState("")
  const [priority, setPriority] = useState("NORMAL")

  // Parameter Biaya & Jumlah Pcs Default Bersih (0)
  const [totalQtyInput, setTotalQtyInput] = useState<number>(0)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [totalPrice, setTotalPrice] = useState<number>(0)
  const [downPayment, setDownPayment] = useState<number>(0)
  const [productionNotes, setProductionNotes] = useState("")

  // Pilihan Makloon & Partner
  const [isMakloon, setIsMakloon] = useState(false)
  const [makloonVendorName, setMakloonVendorName] = useState("")
  const [partnerList, setPartnerList] = useState<PartnerItem[]>([])

  const [roster, setRoster] = useState<RosterItem[]>([])

  useEffect(() => {
    async function fetchPartners() {
      const { data } = await supabase.from("makloon_partners").select("*").order("created_at", { ascending: false })
      if (data && data.length > 0) {
        setPartnerList(data.map((p: any) => ({
          id: p.id,
          name: p.name || p.partner_name || p.vendor_name || "Tanpa Nama"
        })))
      }
    }
    fetchPartners()
  }, [])

  // Auto kalkulasi biaya & sinkronisasi baris secara realtime
  const recalculateTotal = (qty: number, price: number, disc: number) => {
    const subtotal = qty * price
    const finalTotal = subtotal - disc > 0 ? subtotal - disc : 0
    setTotalPrice(finalTotal)
  }

  const handleQtyChange = (newQty: number) => {
    setTotalQtyInput(newQty)
    recalculateTotal(newQty, unitPrice, discountAmount)

    if (newQty >= 0 && newQty <= 150) {
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

  const handleUnitPriceChange = (price: number) => {
    setUnitPrice(price)
    recalculateTotal(totalQtyInput, price, discountAmount)
  }

  const handleDiscountChange = (disc: number) => {
    setDiscountAmount(disc)
    recalculateTotal(totalQtyInput, unitPrice, disc)
  }

  const handleAddRow = () => {
    const updated = [
      ...roster,
      { player_name: "", back_number: "", size: "L", sleeve_type: "SHORT" as const, notes: "" }
    ]
    setRoster(updated)
    setTotalQtyInput(updated.length)
    if (unitPrice > 0) setTotalPrice(updated.length * unitPrice)
  }

  const handleRemoveRow = (idx: number) => {
    if (roster.length <= 1) return
    const updated = roster.filter((_, i) => i !== idx)
    setRoster(updated)
    setTotalQtyInput(updated.length)
    if (unitPrice > 0) setTotalPrice(updated.length * unitPrice)
  }

  const handleRosterChange = (idx: number, field: keyof RosterItem, val: string) => {
    const updated = [...roster]
    updated[idx] = { ...updated[idx], [field]: val }
    setRoster(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")

    try {
      const now = new Date()
      const datePart = now.toISOString().slice(2, 10).replace(/-/g, "")
      const randomPart = Math.floor(1000 + Math.random() * 9000)
      const orderNumber = `JR-${datePart}-${randomPart}`

      const totalQty = roster.length
      const isPaid = downPayment >= totalPrice

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_name: customerName,
          customer_phone: customerPhone,
          fabric_type: fabricType,
          collar_type: collarType,
          deadline_date: deadlineDate,
          priority: priority,
          catatan_desain: catatanDesain.trim(),
        link_drive_aset: linkDriveAset.trim(),
        total_qty: totalQty,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: isPaid,
          current_status: "DESIGN_QUEUE",
          production_notes: productionNotes,
          is_makloon: isMakloon,
          makloon_vendor_name: isMakloon ? makloonVendorName.trim() : null
        })
        .select()
        .single()

      if (orderError) throw orderError

      const rosterPayload = roster.map((r) => ({
        order_id: orderData.id,
        player_name: r.player_name.trim() || "-",
        back_number: r.back_number.trim() || "-",
        size: r.size,
        sleeve_type: r.sleeve_type,
        notes: r.notes.trim() || null,
      }))

      const { error: rosterError } = await supabase
        .from("order_roster_items")
        .insert(rosterPayload)

      if (rosterError) throw rosterError

      await supabase.from("production_logs").insert({
        order_id: orderData.id,
        stage: "DESIGN_QUEUE",
        notes: "Pesanan baru dibuat dan masuk antrean desain."
      })

      router.push(`/orders/${orderData.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat pesanan")
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
        <Link
          href="/orders"
          className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-zinc-900 leading-tight">Buat Pesanan Baru</h1>
          <p className="text-xs text-zinc-600">Input data pemesan, spesifikasi jersey, jalur pengerjaan, dan rincian pesanan.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* PARAMETER UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kolom 1: Pemesan */}
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-500" /> Informasi Pemesan
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nama Pemesan / Instansi</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Tim Futsal / PT Sejahtera"
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
                  placeholder="08123456789"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Prioritas Pengerjaan</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white font-medium"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Tinggi (Mepet)</option>
                  <option value="URGENT">Urgent (Express)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kolom 2: Bahan & Model */}
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
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
                <label className="block text-zinc-600 font-medium mb-1">Target Selesai (Deadline)</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Kolom 3: Volume & Biaya (Format Ribuan & Diskon) */}
          <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Volume & Biaya
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-semibold mb-0.5">Jml Order (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={totalQtyInput || ""}
                    onChange={(e) => handleQtyChange(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1 border-2 border-zinc-900 rounded font-mono font-bold text-zinc-900 bg-zinc-50 text-center text-xs"
                    title="Ubah angka ini untuk otomatis menyesuaikan jumlah baris di bawah"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Harga / Pcs (Rp)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatRibuan(unitPrice)}
                    onChange={(e) => handleUnitPriceChange(parseRibuan(e.target.value))}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Diskon / Potongan (Rp)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatRibuan(discountAmount)}
                    onChange={(e) => handleDiscountChange(parseRibuan(e.target.value))}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs text-red-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5">Total Tagihan (Rp)</label>
                  <input
                    type="text"
                    value={formatRibuan(totalPrice)}
                    onChange={(e) => setTotalPrice(parseRibuan(e.target.value))}
                    className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs font-bold bg-zinc-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-0.5">Uang Muka / DP (Rp)</label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatRibuan(downPayment)}
                  onChange={(e) => setDownPayment(parseRibuan(e.target.value))}
                  className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-xs font-semibold text-emerald-700"
                />
              </div>

              <div className="pt-1.5 border-t flex justify-between items-center text-xs">
                <span className="text-zinc-600 font-medium">Sisa Piutang:</span>
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

                {partnerList.length > 0 ? (
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
          <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight">
            Catatan Teknis & Instruksi Produksi
          </span>
          <textarea
            rows={3}
            value={productionNotes}
            onChange={(e) => setProductionNotes(e.target.value)}
            placeholder="Instruksi tambahan untuk penjahit atau pemotong kain..."
            className="w-full p-2.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none text-zinc-800 leading-relaxed placeholder:text-zinc-400"
          />
        </div>

        {/* TABEL RINCIAN UKURAN & NAMA (UMUM & FLEKSIBEL) */}
        <div className="border border-zinc-200 bg-white rounded overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5 uppercase tracking-tight">
                <Layers className="h-3.5 w-3.5 text-zinc-600" /> Daftar Rincian Pesanan ({roster.length} Pcs)
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Jumlah baris otomatis tersinkron dengan jumlah pcs di atas.
              </span>
            </div>
            
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[11px] font-medium px-2.5 py-1.5 rounded transition-colors shadow-2xs"
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
                        <option value="LONG">Panjang</option>
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

                    {/* Brief Desain & Link Aset (Opsional untuk Bagian Setting) */}
            <div className="border border-purple-200 bg-purple-50/40 p-3 rounded-lg space-y-3">
              <span className="text-[11px] font-bold text-purple-950 uppercase tracking-tight block">
                Instruksi Operator Desain & Setting (Opsional)
              </span>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Catatan Brief Desain
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Gradasi biru-hitam, motif petir halus di pundak, kerah V-neck rib hitam list emas..."
                  value={catatanDesain}
                  onChange={(e) => setCatatanDesain(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-purple-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Link Aset Logo / Folder Desain
                </label>
                <input
                  type="text"
                  placeholder="Contoh: https://drive.google.com/... atau \\SERVER\Desain\Garuda_FC"
                  value={linkDriveAset}
                  onChange={(e) => setLinkDriveAset(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-mono focus:ring-1 focus:ring-purple-900 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  Bisa berupa link Google Drive atau alamat path folder lokal di jaringan workshop.
                </span>
              </div>
            </div>

<div className="flex justify-end gap-3 pt-2">
          <Link
            href="/orders"
            className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {submitting ? "Menyimpan Pesanan..." : "Simpan Pesanan"}
          </button>
        </div>
      </form>
    </div>
  )
}
