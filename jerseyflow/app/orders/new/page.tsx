"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  User, 
  Shirt, 
  DollarSign, 
  Layers,
  Sparkles
} from "lucide-react"
import Link from "next/link"

interface RosterItem {
  id: string
  player_name: string
  back_number: string
  size: string
  sleeve_type: "SHORT" | "LONG"
  notes: string
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

export default function NewOrderPage() {
  const router = useRouter()
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [teamName, setTeamName] = useState("")
  const [fabricType, setFabricType] = useState(FABRIC_OPTIONS[0])
  const [collarType, setCollarType] = useState(COLLAR_OPTIONS[0])
  const [deadlineDate, setDeadlineDate] = useState("")
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL")
  const [pricePerPcs, setPricePerPcs] = useState(120000)
  const [downPayment, setDownPayment] = useState(0)

  const [targetBatchQty, setTargetBatchQty] = useState(12)
  const [roster, setRoster] = useState<RosterItem[]>([
    { id: "1", player_name: "", back_number: "", size: "L", sleeve_type: "SHORT", notes: "" }
  ])

  useEffect(() => {
    async function checkPermission() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()
        
        const role = (data?.role || "ADMIN").toUpperCase()
        if (role === "OPERATOR" || role === "OPERATOR_PRINT" || role === "SEWING_SUPERVISOR" || role === "QC") {
          router.replace("/kiosk")
          return
        }
      }
      setCheckingRole(false)
    }
    checkPermission()
  }, [router])

  const totalQty = roster.length
  const totalPrice = totalQty * pricePerPcs

  const handleGenerateBatchRows = () => {
    const count = Number(targetBatchQty)
    if (isNaN(count) || count <= 0) return

    const newRows: RosterItem[] = []
    for (let i = 1; i <= count; i++) {
      newRows.push({
        id: String(i),
        player_name: "",
        back_number: "",
        size: "L",
        sleeve_type: "SHORT",
        notes: "",
      })
    }
    setRoster(newRows)
  }

  const handleAddRow = () => {
    const nextId = (roster.length + 1).toString()
    setRoster([...roster, {
      id: nextId,
      player_name: "",
      back_number: "",
      size: "L",
      sleeve_type: "SHORT",
      notes: ""
    }])
  }

  const handleRemoveRow = (index: number) => {
    if (roster.length <= 1) return
    setRoster(roster.filter((_, idx) => idx !== index))
  }

  const handleRosterChange = (index: number, field: keyof RosterItem, value: string) => {
    const updated = [...roster]
    updated[index] = { ...updated[index], [field]: value }
    setRoster(updated)
  }

  const generateOrderNumber = () => {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const randomCode = Math.floor(1000 + Math.random() * 9000)
    return "JR-" + yy + mm + dd + "-" + randomCode
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!customerName || !customerPhone || !deadlineDate) {
      setErrorMsg("Mohon lengkapi nama pemesan, no WhatsApp, dan tanggal deadline.")
      return
    }

    setLoading(true)
    const orderNumber = generateOrderNumber()

    try {
      const fullCustomer = teamName ? customerName + " (" + teamName + ")" : customerName

      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_name: fullCustomer,
          customer_phone: customerPhone,
          total_qty: totalQty,
          fabric_type: fabricType,
          collar_type: collarType,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: downPayment >= totalPrice,
          current_status: "DESIGN_QUEUE",
          priority: priority,
          deadline_date: deadlineDate,
        })
        .select()
        .single()

      if (orderErr) throw new Error("Gagal menyimpan order: " + orderErr.message)

      const rosterRows = roster.map((item) => ({
        order_id: orderData.id,
        player_name: item.player_name.trim() || "-",
        back_number: item.back_number.trim() || "-",
        size: item.size,
        sleeve_type: item.sleeve_type,
        notes: item.notes.trim() || null,
      }))

      const { error: rosterErr } = await supabase.from("order_roster_items").insert(rosterRows)
      if (rosterErr) throw new Error("Gagal menyimpan item roster: " + rosterErr.message)

      await supabase.from("production_logs").insert({
        order_id: orderData.id,
        stage: "DESIGN_QUEUE",
        notes: "Order baru dibuat. Menunggu proses approval mockup desain."
      })

      // Langsung arahkan ke halaman detail order untuk upload mockup / cetak
      router.push(`/orders/${orderData.id}`)
      router.refresh()

    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan koneksi.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingRole) return null

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Buat Pesanan Baru</h1>
            <p className="text-xs text-zinc-600">Input spesifikasi jersey, nominal pembayaran, dan generate baris roster otomatis.</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-500" /> Informasi Pemesan
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nama Pemesan / Kontak</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">WhatsApp Pemesan</label>
                <input
                  type="text"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nama Tim / Klub</label>
                <input
                  type="text"
                  placeholder="Contoh: Garuda FC Bandung"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5 text-zinc-500" /> Spesifikasi Bahan
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
                <label className="block text-zinc-600 font-medium mb-1">Tingkat Urgensi / Prioritas</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Tinggi (Mepet)</option>
                  <option value="URGENT">Urgent (Express)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Deadline & Keuangan
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Target Tanggal Selesai (Deadline)</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">Harga / Pcs (Rp)</label>
                  <input
                    type="number"
                    value={pricePerPcs}
                    onChange={(e) => setPricePerPcs(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">Uang Muka / DP (Rp)</label>
                  <input
                    type="number"
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 border-t flex justify-between items-center text-xs">
                <span className="text-zinc-600">Total Biaya ({totalQty} pcs):</span>
                <span className="font-bold font-mono text-sm text-zinc-900">
                  Rp {totalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white rounded overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-zinc-600" /> Rincian Roster Jersey ({totalQty} Pcs Terdaftar)
            </span>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-zinc-300 px-2 py-1 rounded shadow-2xs">
                <span className="text-[11px] text-zinc-500">Jumlah:</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={targetBatchQty}
                  onChange={(e) => setTargetBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center text-xs font-mono font-bold border-0 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500">Pcs</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateBatchRows}
                className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium px-2.5 py-1.5 rounded transition-colors shadow-2xs"
                title="Buat baris roster kosong sesuai jumlah di atas"
              >
                <Sparkles className="h-3 w-3" />
                <span>Buat Baris Cepat</span>
              </button>
              <div className="h-4 w-px bg-zinc-300" />
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[11px] font-medium px-2 py-1.5 rounded transition-colors"
                title="Tambah 1 baris"
              >
                <Plus className="h-3 w-3" />
                <span>+1 Baris</span>
              </button>
            </div>
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
                    <td className="py-1.5 px-3 text-center text-zinc-600 font-mono text-[11px]">
                      {index + 1}
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        placeholder="Nama pemain"
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
                        className="w-full px-1.5 py-1 border border-zinc-200 rounded text-xs bg-white focus:outline-none"
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
                        placeholder="Opsional (cth: GK Kuning)"
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
                        className="text-zinc-500 hover:text-red-600 disabled:opacity-30 p-1"
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
            href="/"
            className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {loading ? "Menyimpan Order..." : "Simpan Pesanan & Lengkapi Mockup"}
          </button>
        </div>
      </form>
    </div>
  )
}
