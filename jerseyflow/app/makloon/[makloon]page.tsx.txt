"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { 
  Users2, 
  Plus, 
  Phone, 
  MapPin, 
  Shirt, 
  Calendar, 
  ExternalLink,
  Layers,
  CheckCircle2
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
  customer_name: string
  total_qty: number
  fabric_type: string
  deadline_date: string
  current_status: string
  makloon_partner_id: string | null
}

export default function MakloonPage() {
  const [partners, setPartners] = useState<MakloonPartner[]>([])
  const [orders, setOrders] = useState<AssignedOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Form Tambah Partner
  const [partnerName, setPartnerName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadData = async () => {
    setLoading(true)
    const { data: pData } = await supabase
      .from("makloon_partners")
      .select("*")
      .order("created_at", { ascending: false })

    const { data: oData } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, total_qty, fabric_type, deadline_date, current_status, makloon_partner_id")
      .neq("current_status", "COMPLETED")
      .neq("current_status", "CANCELLED")

    if (pData) setPartners(pData)
    if (oData) setOrders(oData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partnerName || !phone) return

    setSaving(true)
    setMessage("")

    const { error } = await supabase.from("makloon_partners").insert({
      partner_name: partnerName,
      contact_person: contactPerson || null,
      phone: phone,
      address: address || null,
    })

    if (!error) {
      setPartnerName("")
      setContactPerson("")
      setPhone("")
      setAddress("")
      setMessage("Partner makloon berhasil ditambahkan!")
      loadData()
    } else {
      setMessage("Gagal menyimpan partner: " + error.message)
    }
    setSaving(false)
  }

  const handleAssignMakloon = async (orderId: string, partnerId: string | null) => {
    await supabase
      .from("orders")
      .update({
        makloon_partner_id: partnerId || null,
        is_makloon: Boolean(partnerId)
      })
      .eq("id", orderId)

    loadData()
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      <div className="border-b border-zinc-200 pb-3">
        <h1 className="text-base font-bold text-zinc-900 leading-tight">Manajemen Partner Makloon</h1>
        <p className="text-xs text-zinc-600">Alokasikan pesanan ke penjahit borongan luar atau vendor sublim rekanan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Kolom Kiri: Form Input Partner Baru */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3 h-fit">
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-zinc-500" /> Tambah Partner Baru
          </span>

          {message && (
            <div className="p-2.5 bg-zinc-100 border border-zinc-200 rounded text-xs text-zinc-800 font-medium">
              {message}
            </div>
          )}

          <form onSubmit={handleCreatePartner} className="space-y-2.5 text-xs">
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Nama Vendor / Penjahit</label>
              <input
                type="text"
                required
                placeholder="Contoh: Makloon Berkah Mandiri"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Penanggung Jawab (Mandor/PIC)</label>
              <input
                type="text"
                placeholder="Contoh: Pak Agus"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Nomor WhatsApp</label>
              <input
                type="text"
                required
                placeholder="08xxxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Alamat / Lokasi Workshop</label>
              <input
                type="text"
                placeholder="Lokasi workshop mitra"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 mt-1 shadow-2xs"
            >
              {saving ? "Menyimpan..." : "Daftarkan Partner"}
            </button>
          </form>

          {/* List Mitra Terdaftar Ringkas */}
          <div className="pt-3 border-t border-zinc-100 space-y-2">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-tight block">
              Mitra Terdaftar ({partners.length})
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {partners.length === 0 ? (
                <div className="text-[11px] text-zinc-400">Belum ada partner terdaftar.</div>
              ) : (
                partners.map((p) => (
                  <div key={p.id} className="p-2 bg-zinc-50 border border-zinc-200 rounded text-xs space-y-0.5">
                    <div className="font-bold text-zinc-900">{p.partner_name}</div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {p.phone} ({p.contact_person || "PIC"})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Alokasi Order Aktif ke Makloon */}
        <div className="lg:col-span-2 border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-zinc-500" /> Alokasi Order Aktif ke Mitra Luar
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              Total: {orders.length} Order Aktif
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Pemesan / Tim</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3">Deadline</th>
                  <th className="py-2.5 px-3">Status Saat Ini</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Pilih Partner Makloon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                      Tidak ada pesanan aktif.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">{o.order_number}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-800">{o.customer_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-800">{o.total_qty}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-600">{o.deadline_date}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-zinc-100 text-zinc-800 border-zinc-300">
                          {o.current_status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={o.makloon_partner_id || ""}
                          onChange={(e) => handleAssignMakloon(o.id, e.target.value || null)}
                          className="w-full px-2 py-1 text-xs border border-zinc-300 rounded bg-white focus:outline-none"
                        >
                          <option value="">-- Dikerjakan Internal --</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              Makloon: {p.partner_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
