"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { QRCodeSVG } from "qrcode.react"
import { Printer } from "lucide-react"

interface OrderDetail {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  total_qty: number
  fabric_type: string
  collar_type: string
  priority: string
  deadline_date: string
  mockup_url?: string | null
  mockup_url_2?: string | null
  mockup_url_3?: string | null
  production_notes?: string | null
  created_at: string
  is_makloon?: boolean
  makloon_vendor_name?: string | null
}

interface RosterItem {
  id: string
  player_name: string
  back_number: string
  size: string
  sleeve_type: string
  notes: string
}

// Format Tanggal Indonesia: DD-MM-YYYY
function formatDateID(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

// Masking Nomor HP tanpa embel-embel catatan
function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "-"
  const clean = phone.replace(/[^0-9]/g, "")
  if (clean.length <= 6) return phone
  const start = clean.slice(0, 4)
  const end = clean.slice(-4)
  return `${start}-****-${end}`
}

export default function SPKPrintPage() {
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [roster, setRoster] = useState<RosterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAdmin, setCurrentAdmin] = useState<string>("Admin Manayra")

  useEffect(() => {
    async function loadSPK() {
      if (!orderId) return
      setLoading(true)

      const { data: oData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      const { data: rData } = await supabase
        .from("order_roster_items")
        .select("*")
        .eq("order_id", orderId)

      if (oData) setOrder(oData)
      if (rData) setRoster(rData)

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single()
        if (prof?.full_name) {
          setCurrentAdmin(prof.full_name)
        } else if (session.user.email) {
          setCurrentAdmin(session.user.email.split("@")[0])
        }
      }

      setLoading(false)
    }
    loadSPK()
  }, [orderId])

  const sizeSummary = useMemo(() => {
    const summary: { [key: string]: number } = {}
    roster.forEach((item) => {
      const sz = item.size || "L"
      summary[sz] = (summary[sz] || 0) + 1
    })
    return Object.entries(summary).sort((a, b) => b[1] - a[1])
  }, [roster])

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono">Memuat Lembar SPK...</div>
  }

  if (!order) {
    return <div className="p-8 text-center text-xs font-mono text-red-600">Order tidak ditemukan.</div>
  }

  const kioskScanUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/kiosk?order=${order.order_number}`
    : `/kiosk?order=${order.order_number}`

  const mockups = [
    { url: order.mockup_url, label: "Gambar 1 / Desain A" },
    { url: order.mockup_url_2, label: "Gambar 2 / Desain B" },
    { url: order.mockup_url_3, label: "Gambar 3 / Desain C" },
  ].filter((m) => Boolean(m.url))

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 8mm 10mm;
          }
          html, body {
            background: white !important;
            color: black !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            overflow: visible !important;
          }
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="bg-white text-black min-h-screen p-4 md:p-6 font-sans max-w-[215mm] mx-auto print:p-0 print:max-w-none print:m-0">
        <div className="print:hidden mb-4 flex justify-between items-center bg-zinc-100 border border-zinc-300 p-3 rounded">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Lembar Kerja Produksi (SPK Fisik)</h2>
            <p className="text-xs text-zinc-600">Gunakan kertas F4 atau A4. Skala 100% tanpa margin browser.</p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded text-xs font-semibold hover:bg-zinc-800 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Dokumen Sekarang</span>
          </button>
        </div>

        {/* 1. HEADER SPK */}
        <div className="border-b-2 border-black pb-2 flex justify-between items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight uppercase">SURAT PERINTAH KERJA (SPK)</span>
              <span className="border-2 border-black px-2 py-0.5 text-[10px] font-extrabold uppercase">
                {order.priority}
              </span>
              <span className={`border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                order.is_makloon ? "border-black bg-zinc-200 text-black" : "border-black text-black"
              }`}>
                {order.is_makloon ? `JAHIT: MAKLOON (${order.makloon_vendor_name || "MITRA LUAR"})` : "JAHIT: INTERNAL"}
              </span>
            </div>
            <p className="text-xs font-bold text-zinc-800 tracking-wide mt-0.5">MANAYRA PRODUCTION WORKSHOP</p>
            
            {/* INFORMASI PEMESAN & ADMIN DENGAN TITIK DUA RATA SEJAJAR */}
            <div className="mt-2 text-xs">
              <table className="border-collapse text-[11px] leading-tight">
                <tbody>
                  <tr>
                    <td className="w-24 text-zinc-600 font-medium py-0.5">Nama Pemesan</td>
                    <td className="w-3 text-center py-0.5">:</td>
                    <td className="font-bold text-zinc-900 uppercase py-0.5">{order.customer_name}</td>
                  </tr>
                  <tr>
                    <td className="text-zinc-600 font-medium py-0.5">No. HP</td>
                    <td className="text-center py-0.5">:</td>
                    <td className="font-mono font-semibold text-zinc-900 py-0.5">{maskPhoneNumber(order.customer_phone)}</td>
                  </tr>
                  <tr>
                    <td className="text-zinc-600 font-medium py-0.5">Admin / CS</td>
                    <td className="text-center py-0.5">:</td>
                    <td className="text-zinc-800 py-0.5">
                      <strong>{currentAdmin}</strong>
                      <span className="mx-2 text-zinc-400">&bull;</span>
                      <span className="text-zinc-500">Tgl Masuk:</span> <strong className="font-mono">{formatDateID(order.created_at)}</strong>
                      <span className="mx-2 text-zinc-400">&bull;</span>
                      <span className="text-zinc-500">Tgl Cetak:</span> <strong className="font-mono">{formatDateID(new Date().toISOString())}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-center border-2 border-black p-1.5 rounded bg-white shrink-0">
            <QRCodeSVG value={kioskScanUrl} size={84} level="M" />
            <span className="text-[10px] font-mono font-bold mt-1 text-center tracking-tight leading-none">{order.order_number}</span>
            <span className="text-[7px] text-zinc-600 font-bold uppercase mt-0.5">SCAN POS KERJA</span>
          </div>
        </div>

        {/* 2. PARAMETER SPESIFIKASI */}
        <div className="grid grid-cols-4 gap-2 border-b-2 border-black py-2 text-xs">
          <div className="border-r border-black/20 pr-2">
            <span className="text-[9px] text-zinc-600 block uppercase font-bold">Target Deadline</span>
            <strong className="text-sm font-mono text-red-700">{formatDateID(order.deadline_date)}</strong>
          </div>
          <div className="border-r border-black/20 pr-2">
            <span className="text-[9px] text-zinc-600 block uppercase font-bold">Jenis Bahan Kain</span>
            <strong className="text-xs font-bold">{order.fabric_type}</strong>
          </div>
          <div className="border-r border-black/20 pr-2">
            <span className="text-[9px] text-zinc-600 block uppercase font-bold">Model Pola Kerah</span>
            <strong className="text-xs font-bold">{order.collar_type}</strong>
          </div>
          <div>
            <span className="text-[9px] text-zinc-600 block uppercase font-bold">Total Jumlah Pesanan</span>
            <strong className="text-sm font-mono font-black">{order.total_qty} PCS</strong>
          </div>
        </div>

        {/* 3. MOCKUP PANDUAN */}
        <div className="border-b-2 border-black py-2.5 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-wider block text-zinc-800">
            PANDUAN VISUAL DESAIN PRODUKSI
          </span>

          {mockups.length === 0 ? (
            <div className="h-32 border border-dashed border-zinc-400 rounded flex items-center justify-center text-zinc-400 text-xs font-mono">
              [ Belum ada mockup desain yang diunggah untuk pesanan ini ]
            </div>
          ) : (
            <div className={`grid gap-2 items-stretch ${
              mockups.length === 1 
                ? "grid-cols-1" 
                : mockups.length === 2 
                ? "grid-cols-2" 
                : "grid-cols-3"
            }`}>
              {mockups.map((m, idx) => (
                <div key={idx} className="border border-black rounded p-1 bg-zinc-50 flex flex-col justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-wider block text-zinc-800 mb-0.5 text-center">
                    {m.label}
                  </span>
                  <div className="h-52 flex items-center justify-center bg-white border border-zinc-300 rounded overflow-hidden p-1">
                    <img src={m.url!} alt={m.label} className="h-full w-full object-contain" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. CATATAN TEKNIS & INSTRUKSI */}
        <div className="border-b-2 border-black py-2">
          <div className="border border-black p-2 rounded bg-zinc-50">
            <span className="font-extrabold uppercase text-[9px] block text-zinc-900 border-b border-black pb-0.5">
              CATATAN TEKNIS & INSTRUKSI PENGERJAAN
            </span>
            <div className="mt-1 text-[11px] leading-relaxed text-zinc-900 font-sans whitespace-pre-wrap">
              {order.production_notes || "Cocokkan nomor dada/punggung, logo sponsor, dan variasi warna lengan sesuai gambar mockup sebelum kain dirakit di mesin jahit."}
            </div>
          </div>
        </div>

        {/* 5. TABEL ROSTER PEMAIN (REKAP UKURAN DITEMPATKAN DI KANAN MENONJOL) */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider">
              DAFTAR RINCIAN PESANAN ({roster.length} PCS)
            </h3>

            {/* REKAP UKURAN DI SEBELAH KANAN: JELAS & MUDAH DILIHAT */}
            <div className="flex items-center gap-1.5 border border-black bg-zinc-100 px-2 py-1 rounded shadow-2xs">
              <span className="font-black text-[9px] uppercase tracking-wider text-black">
                REKAP UKURAN:
              </span>
              <div className="flex items-center gap-1 font-mono text-[9px]">
                {sizeSummary.map(([sz, count]) => (
                  <span key={sz} className="border border-black bg-white px-1.5 py-0.2 font-black text-black">
                    {sz}:{count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-zinc-200 border-b border-black text-[9px] uppercase font-bold text-center">
                <th className="border border-black py-1 px-1 w-8">No</th>
                <th className="border border-black py-1 px-2 text-left">Nama Punggung</th>
                <th className="border border-black py-1 px-2 w-16">No Punggung</th>
                <th className="border border-black py-1 px-2 w-16">Ukuran</th>
                <th className="border border-black py-1 px-2 w-20">Lengan</th>
                <th className="border border-black py-1 px-2 text-left">Keterangan / Posisi</th>
                <th className="border border-black py-1 px-1 w-12 text-center" title="Beri tanda centang setelah diverifikasi">
                  QC &radic;
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r, i) => (
                <tr key={r.id} className="border-b border-black text-center font-mono">
                  <td className="border border-black py-0.5 px-1 text-[10px]">{i + 1}</td>
                  <td className="border border-black py-0.5 px-2 text-left font-sans font-bold uppercase text-[11px]">{r.player_name}</td>
                  <td className="border border-black py-0.5 px-2 font-black text-[12px]">{r.back_number}</td>
                  <td className="border border-black py-0.5 px-2 font-black bg-zinc-100 text-[11px]">{r.size}</td>
                  <td className="border border-black py-0.5 px-2 font-sans text-[10px]">
                    {r.sleeve_type === "LONG" ? "PANJANG" : "PENDEK"}
                  </td>
                  <td className="border border-black py-0.5 px-2 text-left font-sans text-[10px]">{r.notes || "-"}</td>
                  <td className="border border-black py-0.5 px-1">
                    <div className="w-3.5 h-3.5 border border-black mx-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[8px] text-zinc-500 font-mono mt-0.5 text-right italic">
            * Kolom [QC &radic;] wajib dicentang manual oleh PIC saat selesai tahap penjahitan.
          </div>
        </div>

        {/* 6. KOTAK PENANGGUNG JAWAB POS KERJA & PARAF */}
        <div className="mt-3 pt-2 border-t-2 border-black grid grid-cols-5 gap-2 text-[9px] text-center">
          <div className="border border-black p-1.5 rounded flex flex-col justify-between">
            <div className="font-extrabold uppercase leading-tight">1. Print Sublim</div>
            <div className="my-1 border-b border-dashed border-zinc-400">
              <span className="text-[7.5px] text-zinc-400 block text-left">Nama PIC:</span>
              <div className="h-3"></div>
            </div>
            <div className="text-[8px] text-zinc-600 font-medium">Paraf / Tgl</div>
          </div>

          <div className="border border-black p-1.5 rounded flex flex-col justify-between">
            <div className="font-extrabold uppercase leading-tight">2. Print Sublim</div>
            <div className="my-1 border-b border-dashed border-zinc-400">
              <span className="text-[7.5px] text-zinc-400 block text-left">Nama PIC:</span>
              <div className="h-3"></div>
            </div>
            <div className="text-[8px] text-zinc-600 font-medium">Paraf / Tgl</div>
          </div>

          <div className="border border-black p-1.5 rounded flex flex-col justify-between">
            <div className="font-extrabold uppercase leading-tight">3. Potong & Press</div>
            <div className="my-1 border-b border-dashed border-zinc-400">
              <span className="text-[7.5px] text-zinc-400 block text-left">Nama PIC:</span>
              <div className="h-3"></div>
            </div>
            <div className="text-[8px] text-zinc-600 font-medium">Paraf / Tgl</div>
          </div>

          <div className="border border-black p-1.5 rounded flex flex-col justify-between">
            <div className="font-extrabold uppercase leading-tight">
              {order.is_makloon ? "4. Jahit (Makloon)" : "4. Jahit & Obras"}
            </div>
            <div className="my-1 border-b border-dashed border-zinc-400">
              <span className="text-[7.5px] text-zinc-400 block text-left">Nama PIC / Mitra:</span>
              <div className="h-3"></div>
            </div>
            <div className="text-[8px] text-zinc-600 font-medium">Paraf / Tgl</div>
          </div>

          <div className="border border-black p-1.5 rounded flex flex-col justify-between">
            <div className="font-extrabold uppercase leading-tight">5. QC & Packing</div>
            <div className="my-1 border-b border-dashed border-zinc-400">
              <span className="text-[7.5px] text-zinc-400 block text-left">Nama PIC:</span>
              <div className="h-3"></div>
            </div>
            <div className="text-[8px] text-zinc-600 font-medium">Paraf / Tgl</div>
          </div>
        </div>
      </div>
    </>
  )
}
