"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Printer, ShieldCheck, UserCheck } from "lucide-react"

interface OrderDetail {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  customer_phone?: string | null
  total_qty: number
  fabric_type: string
  collar_type: string
  priority: string
  deadline_date: string
  package_type?: string | null
  ink_type?: string | null
  order_type?: string | null
  cutting_location?: string | null
  design_location?: string | null
  total_price?: number
  down_payment?: number
  is_paid_off?: boolean
  size_breakdown?: any
  roster_wa_text?: string | null
  roster_screenshot_url?: string | null
  roster_screenshot_url_2?: string | null
  mockup_url?: string | null
  mockup_url_2?: string | null
  mockup_url_3?: string | null
  production_notes?: string | null
  created_at: string
  created_by_name?: string | null
}

const ADULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"]
const KID_SIZES = ["S Anak", "M Anak", "L Anak", "XL Anak"]

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

export default function FormOrderPrintPage() {
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentAdmin, setCurrentAdmin] = useState<string>("Admin Manayra")

  // SAKELAR KONTROL CETAK
  const [showFinancials, setShowFinancials] = useState<boolean>(false)
  const [printSheet2, setPrintSheet2] = useState<boolean>(true)

  useEffect(() => {
    async function loadData() {
      if (!orderId) return
      setLoading(true)

      const { data: oData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (oData) {
        setOrder(oData)
        if (oData.created_by_name) setCurrentAdmin(oData.created_by_name)
      }

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

    loadData()
  }, [orderId])

  const matrixCalculation = useMemo(() => {
    if (!order?.size_breakdown) return null
    const bd = order.size_breakdown
    const adult = bd.adult || {}
    const kid = bd.kid || {}

    let adultPendek = 0, adultPanjang = 0, adultCelana = 0
    ADULT_SIZES.forEach((sz) => {
      adultPendek += Number(adult[sz]?.pendek || 0)
      adultPanjang += Number(adult[sz]?.panjang || 0)
      adultCelana += Number(adult[sz]?.celana || 0)
    })
    const adultBaju = adultPendek + adultPanjang

    let kidPendek = 0, kidPanjang = 0, kidCelana = 0
    KID_SIZES.forEach((sz) => {
      kidPendek += Number(kid[sz]?.pendek || 0)
      kidPanjang += Number(kid[sz]?.panjang || 0)
      kidCelana += Number(kid[sz]?.celana || 0)
    })
    const kidBaju = kidPendek + kidPanjang

    return {
      adult, kid,
      adultPendek, adultPanjang, adultCelana, adultBaju,
      kidPendek, kidPanjang, kidCelana, kidBaju,
      hasAdult: adultBaju > 0 || adultCelana > 0,
      hasKid: kidBaju > 0 || kidCelana > 0,
      grandBaju: adultBaju + kidBaju,
      grandCelana: adultCelana + kidCelana
    }
  }, [order])

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono">Memuat Form Order Konsumen...</div>
  }

  if (!order) {
    return <div className="p-8 text-center text-xs font-mono text-red-600">Pesanan tidak ditemukan.</div>
  }

  const isStelan = order.package_type === "STELAN"
  const isPrintPress = order.order_type === "PRINT_PRESS"

  const mockups = [
    { url: order.mockup_url, label: "Gambar 1" },
    { url: order.mockup_url_2, label: "Gambar 2" },
    { url: order.mockup_url_3, label: "Gambar 3" },
  ].filter((m) => Boolean(m.url))

  const sisaBayar = Number(order.total_price || 0) - Number(order.down_payment || 0)
  const isLunas = order.is_paid_off || sisaBayar <= 0

  const hasScreenshots = Boolean(order.roster_screenshot_url || order.roster_screenshot_url_2)

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important; /* HILANGKAN MARGIN BROWSER TOTAL */
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          /* MATIKAN OVERFLOW TRAP NEXT.JS SECARA ABSOLUT */
          main, main > div, #__next, div[data-nextjs-scroll-focus-boundary], body > div {
            overflow: visible !important;
            height: auto !important;
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          aside, header, nav, .print-hidden-bar {
            display: none !important;
          }
          
          /* ENGINE HALAMAN BARU (MENGUNCI 100% 1 KERTAS A4) */
          .print-sheet {
            width: 210mm !important;
            height: 296mm !important; /* Tinggi A4 Presisi */
            padding: 10mm 12mm !important; /* Margin Buatan Internal */
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
          }
        
          /* KEMBALIKAN GRID 2 KOLOM UNTUK SCREENSHOT SAAT CETAK */
          .spk-ss-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
            align-items: start !important;
          }
}
      `}</style>

      {/* Latar Belakang Abu-Abu untuk Tampilan Layar (Bukan Print) */}
      <div className="bg-zinc-100 min-h-screen font-sans pb-12 print:bg-white print:pb-0 print:min-h-0">
        
        {/* BILAH KONTROL (TIDAK IKUT TERCETAK) */}
        <div className="max-w-[210mm] mx-auto pt-6 px-4 print:hidden">
          <div className="print-hidden-bar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-zinc-300 p-3 rounded shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Form Order Konsumen & ACC Desain</h2>
              <p className="text-xs text-zinc-600">
                {printSheet2 ? "Format Aktif: 2 Lembar Terpisah." : "Format Aktif: 1 Lembar Saja."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-medium text-zinc-800">
                <input
                  type="checkbox"
                  checked={printSheet2}
                  onChange={(e) => setPrintSheet2(e.target.checked)}
                  className="rounded text-zinc-900 focus:ring-zinc-900"
                />
                <span>Cetak Lembar 2 (Lampiran)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-medium text-zinc-800">
                <input
                  type="checkbox"
                  checked={showFinancials}
                  onChange={(e) => setShowFinancials(e.target.checked)}
                  className="rounded text-zinc-900 focus:ring-zinc-900"
                />
                <span>Tampilkan Biaya & Rekening</span>
              </label>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-1.5 rounded text-xs font-semibold hover:bg-zinc-800 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📄 LEMBAR 1: FORM ORDER RESMI & ACC DESAIN                               */}
        {/* ========================================================================= */}
        <div className="print-sheet max-w-[210mm] mx-auto bg-white border border-zinc-300 p-6 md:p-8 mt-6 shadow-sm min-h-[297mm] flex flex-col print:mt-0 print:border-none print:shadow-none">
          
          {/* AREA ATAS LEMBAR 1 */}
          <div className="space-y-1.5">
            {/* 1. Header Bersih */}
            <div className="border-b-2 border-black pb-2 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xl font-black tracking-tight uppercase">FORM ORDER & ACC DESAIN</span>
                  <span className="border border-black bg-zinc-100 font-bold px-1.5 py-0.5 text-[9px] uppercase">
                    {order.priority}
                  </span>
                  <span className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    isPrintPress ? "border-black bg-black text-white" : "border-black bg-zinc-200 text-black"
                  }`}>
                    {isPrintPress ? "TIPE: PRINT + PRESS" : "TIPE: FULL ORDER"}
                  </span>
                </div>
                <h3 className="text-xs font-black text-zinc-900 tracking-wide mt-0.5">MANAYRA PRODUCTION WORKSHOP</h3>
              </div>

              <div className="text-right text-xs">
                <span className="font-mono font-black text-sm block tracking-tight text-zinc-950">{order.order_number}</span>
                <span className="text-[10px] text-zinc-600 font-mono block">Tgl Order: {formatDateID(order.created_at)}</span>
                <span className="text-[10px] text-zinc-600 font-mono block">Est. Selesai: <strong className="text-zinc-900">{formatDateID(order.deadline_date)}</strong></span>
              </div>
            </div>

            {/* 2. Identitas Order, Pemesan & CS */}
            <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2 text-xs">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-zinc-500 block">Nama Order:</span>
                <strong className="text-sm font-black text-zinc-950 uppercase block leading-tight">
                  {order.order_title || "-"}
                </strong>
                <span className="text-[11px] text-zinc-700 block pt-0.5">
                  Nama Pemesan: <strong>{order.customer_name}</strong>
                </span>
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-[9px] uppercase font-bold text-zinc-500 block">Admin / Setting yang Melayani:</span>
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-700" />
                  <strong className="text-xs font-bold text-zinc-900">{currentAdmin}</strong>
                </div>
              </div>
            </div>

            {/* 3. Parameter Spesifikasi */}
            <div className="grid grid-cols-4 gap-2 border-b-2 border-black py-1.5 text-xs">
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Target Selesai</span>
                <strong className="text-sm font-mono text-zinc-950">{formatDateID(order.deadline_date)}</strong>
              </div>
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Bahan Kain / Kerah</span>
                <strong className="text-[11px] block leading-tight">{order.fabric_type}</strong>
                <span className="text-[10px] text-zinc-600">{order.collar_type}</span>
              </div>
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Paket & Layanan</span>
                <span className="inline-block border border-black bg-zinc-100 font-bold px-1.5 py-0.2 rounded text-[8.5px] uppercase">
                  {isStelan ? "STELAN (+CELANA)" : "ATASAN SAJA"}
                </span>
                <span className="text-[8px] text-zinc-600 block mt-0.5 font-mono">
                  Desain: <strong>{order.design_location === "LUAR" ? "File Luar" : "Disini"}</strong> &bull; Potong: <strong>{order.cutting_location === "LUAR" ? "Kain Luar" : "Disini"}</strong>
                </span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Total Jumlah Order</span>
                <strong className="text-base font-mono font-black">{order.total_qty} PCS / STEL</strong>
              </div>
            </div>

            {/* 4. Visual Mockup Desain (Approved / ACC) */}
            <div className="border-b-2 border-black py-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  PANDUAN VISUAL DESAIN (APPROVED / ACC)
                </span>
                <span className="text-[8.5px] font-mono text-zinc-500 italic">
                  * Harap pastikan warna, logo, dan motif sudah sesuai
                </span>
              </div>

              {mockups.length === 0 ? (
                <div className="h-28 border border-dashed border-zinc-400 rounded flex items-center justify-center text-zinc-400 text-xs font-mono">
                  [ Mockup visual sedang dalam tahap finalisasi ]
                </div>
              ) : (
                <div className={`grid gap-2 items-stretch ${
                  mockups.length === 1 ? "grid-cols-1" : mockups.length === 2 ? "grid-cols-2" : "grid-cols-3"
                }`}>
                  {mockups.map((m, idx) => (
                    <div key={idx} className="border border-black rounded p-1 bg-zinc-50 flex flex-col justify-between">
                      <span className="text-[8px] font-bold uppercase tracking-wider block text-zinc-800 mb-0.5 text-center">
                        {m.label}
                      </span>
                      <div className="h-44 flex items-center justify-center bg-white border border-zinc-300 rounded overflow-hidden p-1">
                        <img src={m.url!} alt={m.label} className="h-full w-full object-contain" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Tabel Matriks Ukuran (KIRI: ANAK, KANAN: DEWASA) */}
            <div className="pt-0.5 space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider block text-zinc-800">
                RINCIAN DISTRIBUSI UKURAN
              </span>

              {matrixCalculation ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-stretch">
                    {/* KATEGORI ANAK (SEBELAH KIRI) */}
                    <div className="border border-black rounded overflow-hidden bg-white">
                      <div className="bg-zinc-200 px-2 py-0.5 text-[9px] font-black uppercase border-b border-black flex justify-between">
                        <span>Kategori Anak</span>
                        <span className="font-mono">{matrixCalculation.kidBaju} Baju {isStelan && `• ${matrixCalculation.kidCelana} Celana`}</span>
                      </div>
                      <table className="w-full text-center text-xs border-collapse table-fixed">
                        <colgroup>
                          <col className="w-16" />
                          <col />
                          <col />
                          {isStelan && <col className="w-14" />}
                          <col className="w-20" />
                        </colgroup>
                        <thead>
                          <tr className="bg-zinc-100 border-b border-black text-[9px] font-bold uppercase">
                            <th className="py-1 px-1 border-r border-black">Ukuran</th>
                            <th className="py-1 px-1 border-r border-black">Pendek</th>
                            <th className="py-1 px-1 border-r border-black">Panjang</th>
                            {isStelan && <th className="py-1 px-1 border-r border-black bg-zinc-200">Celana</th>}
                            <th className="py-1 px-1">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {KID_SIZES.map((sz) => {
                            const r = matrixCalculation.kid[sz] || {}
                            const p = Number(r.pendek || 0)
                            const pj = Number(r.panjang || 0)
                            const c = Number(r.celana || 0)
                            const total = p + pj

                            return (
                              <tr key={sz} className="border-b border-black/40 font-mono">
                                <td className="py-0.5 px-1 border-r border-black font-bold font-sans bg-zinc-50 text-[11px]">{sz}</td>
                                <td className="py-0.5 px-1 border-r border-black text-[13px] font-black text-black">{p || "-"}</td>
                                <td className="py-0.5 px-1 border-r border-black text-[13px] font-black text-black">{pj || "-"}</td>
                                {isStelan && <td className="py-0.5 px-1 border-r border-black bg-zinc-100 text-[13px] font-black text-black">{c || "-"}</td>}
                                <td className="py-0.5 px-1 font-black text-[13px] text-black">{total || "-"}</td>
                              </tr>
                            )
                          })}
                          <tr className="border-b border-black/40 font-mono">
                            <td className="py-0.5 px-1 border-r border-black bg-zinc-50 text-[11px] text-transparent">-</td>
                            <td className="py-0.5 px-1 border-r border-black text-transparent">-</td>
                            <td className="py-0.5 px-1 border-r border-black text-transparent">-</td>
                            {isStelan && <td className="py-0.5 px-1 border-r border-black bg-zinc-100 text-transparent">-</td>}
                            <td className="py-0.5 px-1 text-transparent">-</td>
                          </tr>
                          <tr className="border-b border-black/40 font-mono">
                            <td className="py-0.5 px-1 border-r border-black bg-zinc-50 text-[11px] text-transparent">-</td>
                            <td className="py-0.5 px-1 border-r border-black text-transparent">-</td>
                            <td className="py-0.5 px-1 border-r border-black text-transparent">-</td>
                            {isStelan && <td className="py-0.5 px-1 border-r border-black bg-zinc-100 text-transparent">-</td>}
                            <td className="py-0.5 px-1 text-transparent">-</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-zinc-100 border-t border-black font-mono text-xs">
                            <td className="py-1 px-1 border-r border-black font-sans font-bold text-zinc-800 text-[10px]">SUBTOTAL</td>
                            <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px]">{matrixCalculation.kidPendek}</td>
                            <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px]">{matrixCalculation.kidPanjang}</td>
                            {isStelan && <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px] bg-zinc-200">{matrixCalculation.kidCelana}</td>}
                            <td className="py-1 px-1 font-bold text-zinc-900 text-[11px]">{matrixCalculation.kidBaju} Baju</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* KATEGORI DEWASA (SEBELAH KANAN) */}
                    <div className="border border-black rounded overflow-hidden bg-white">
                      <div className="bg-zinc-200 px-2 py-0.5 text-[9px] font-black uppercase border-b border-black flex justify-between">
                        <span>Kategori Dewasa</span>
                        <span className="font-mono">{matrixCalculation.adultBaju} Baju {isStelan && `• ${matrixCalculation.adultCelana} Celana`}</span>
                      </div>
                      <table className="w-full text-center text-xs border-collapse table-fixed">
                        <colgroup>
                          <col className="w-16" />
                          <col />
                          <col />
                          {isStelan && <col className="w-14" />}
                          <col className="w-20" />
                        </colgroup>
                        <thead>
                          <tr className="bg-zinc-100 border-b border-black text-[9px] font-bold uppercase">
                            <th className="py-1 px-1 border-r border-black">Ukuran</th>
                            <th className="py-1 px-1 border-r border-black">Pendek</th>
                            <th className="py-1 px-1 border-r border-black">Panjang</th>
                            {isStelan && <th className="py-1 px-1 border-r border-black bg-zinc-200">Celana</th>}
                            <th className="py-1 px-1">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ADULT_SIZES.map((sz) => {
                            const r = matrixCalculation.adult[sz] || {}
                            const p = Number(r.pendek || 0)
                            const pj = Number(r.panjang || 0)
                            const c = Number(r.celana || 0)
                            const total = p + pj

                            return (
                              <tr key={sz} className="border-b border-black/40 font-mono">
                                <td className="py-0.5 px-1 border-r border-black font-bold font-sans bg-zinc-50 text-xs">{sz}</td>
                                <td className="py-0.5 px-1 border-r border-black text-[13px] font-black text-black">{p || "-"}</td>
                                <td className="py-0.5 px-1 border-r border-black text-[13px] font-black text-black">{pj || "-"}</td>
                                {isStelan && <td className="py-0.5 px-1 border-r border-black bg-zinc-100 text-[13px] font-black text-black">{c || "-"}</td>}
                                <td className="py-0.5 px-1 font-black text-[13px] text-black">{total || "-"}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-zinc-100 border-t border-black font-mono text-xs">
                            <td className="py-1 px-1 border-r border-black font-sans font-bold text-zinc-800 text-[10px]">SUBTOTAL</td>
                            <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px]">{matrixCalculation.adultPendek}</td>
                            <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px]">{matrixCalculation.adultPanjang}</td>
                            {isStelan && <td className="py-1 px-1 border-r border-black font-bold text-black text-[12px] bg-zinc-200">{matrixCalculation.adultCelana}</td>}
                            <td className="py-1 px-1 font-bold text-zinc-900 text-[11px]">{matrixCalculation.adultBaju} Baju</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Grand Total Bersih */}
                  <div className="pt-1.5 flex items-center justify-between text-xs font-mono font-bold">
                    <span className="font-sans uppercase text-[10px] tracking-wider text-black">TOTAL PESANAN KESELURUHAN:</span>
                    <div className="flex items-center gap-3">
                      <span>Anak: <strong className="text-black font-mono">{matrixCalculation.kidBaju} pcs</strong></span>
                      <span className="text-zinc-400">&bull;</span>
                      <span>Dewasa: <strong className="text-black font-mono">{matrixCalculation.adultBaju} pcs</strong></span>
                      {isStelan && (
                        <>
                          <span className="text-zinc-400">&bull;</span>
                          <span>Celana: <strong className="text-black font-mono">{matrixCalculation.grandCelana} pcs</strong></span>
                        </>
                      )}
                      <span className="text-zinc-400">&bull;</span>
                      <span className="text-black font-black text-sm">
                        TOTAL: {matrixCalculation.grandBaju} PCS / STEL
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 6. Rincian Biaya & Rekening (Hanya Jika Dicentang) */}
            {showFinancials && (
              <div className="border border-black rounded p-2 bg-zinc-50 space-y-1 text-xs mt-2">
                <div className="flex justify-between items-center border-b border-zinc-300 pb-0.5">
                  <span className="font-bold uppercase text-[9px]">RINCIAN BIAYA & PEMBAYARAN</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                    isLunas ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}>
                    {isLunas ? "LUNAS" : "BELUM LUNAS"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-zinc-600">
                      <span>Total Tagihan:</span>
                      <strong className="font-mono text-zinc-900">{formatIDR(Number(order.total_price || 0))}</strong>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Uang Muka (DP):</span>
                      <strong className="font-mono text-zinc-900">{formatIDR(Number(order.down_payment || 0))}</strong>
                    </div>
                    <div className="flex justify-between font-bold border-t border-zinc-300 pt-0.5 text-black">
                      <span>Sisa Pelunasan:</span>
                      <span className="font-mono text-red-600">{formatIDR(sisaBayar)}</span>
                    </div>
                  </div>

                  <div className="border-l border-zinc-300 pl-3 space-y-0.5 text-[10px] text-zinc-700">
                    <span className="font-bold block text-zinc-900">Rekening Pembayaran:</span>
                    <p className="font-mono font-bold text-zinc-900">BCA: 123-456-7890 (a.n. Manayra)</p>
                    <span className="text-zinc-500 block">Kirim bukti transfer ke WhatsApp admin.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AREA BAWAH LEMBAR 1 (MT-AUTO MEMASTIKAN MENGUNCI KE DASAR KERTAS) */}
          <div className="pt-2 mt-auto">
            <div className="grid grid-cols-2 gap-6 text-xs text-center pb-2">
              <div className="space-y-6">
                <span className="text-[9.5px] uppercase font-bold text-zinc-700 block">
                  Disetujui Oleh Pemesan (ACC):
                </span>
                <div>
                  <div className="w-40 border-b border-black mx-auto"></div>
                  <span className="text-[9.5px] text-zinc-700 font-medium block mt-0.5">
                    ( {order.customer_name} )
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <span className="text-[9.5px] uppercase font-bold text-zinc-700 block">
                  Diterbitkan Oleh (Admin / Setting):
                </span>
                <div>
                  <div className="w-40 border-b border-black mx-auto"></div>
                  <span className="text-[9.5px] text-zinc-900 font-bold block mt-0.5">
                    {currentAdmin}
                  </span>
                  <span className="text-[8.5px] text-zinc-500 block">Manayra Production</span>
                </div>
              </div>
            </div>

            {/* KLAUSUL PERHATIAN DI POSISI PALING BAWAH */}
            <div className="pt-1.5 text-[8.5px] leading-tight text-black border-t border-black">
              <span className="font-black uppercase block text-[9px] tracking-wide">
                PERHATIAN!
              </span>
              <p className="mt-0.5 font-normal uppercase tracking-tight text-[8px] text-zinc-900 leading-snug">
                MOHON PERIKSA KEMBALI KELENGKAPAN JUMLAH DAN DETAIL PESANAN SAAT PENGAMBILAN BARANG. SEGALA BENTUK KEKURANGAN ATAU KETIDAKSESUAIAN SETELAH BARANG MENINGGALKAN WORKSHOP BERADA DI LUAR TANGGUNG JAWAB KAMI.
              </p>
            </div>

            <div className="text-right text-[7.5px] text-zinc-400 font-mono tracking-wider uppercase pt-1">
              Lembar 1: Form Order & ACC Desain
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📄 LEMBAR 2: LAMPIRAN ROSTER & SCREENSHOT TERPISAH                        */}
        {/* ========================================================================= */}
        {printSheet2 && (
          <div className="print-sheet max-w-[210mm] mx-auto bg-white border border-zinc-300 p-6 md:p-8 mt-6 shadow-sm min-h-[297mm] flex flex-col justify-between print:mt-0 print:border-none print:shadow-none">
            <div className="space-y-3">
              {/* Header Lembar Lampiran */}
              <div className="border-b-2 border-black pb-2 flex justify-between items-center">
                <div>
                  <span className="text-base font-black tracking-tight uppercase">FORM ORDER &bull; LEMBAR LAMPIRAN ROSTER</span>
                  <p className="text-xs font-bold text-zinc-800">
                    ORDER: <span className="font-mono">{order.order_number}</span> &bull; {order.order_title || order.customer_name}
                  </p>
                </div>
                <div className="text-right text-xs font-mono">
                  <span className="font-bold bg-zinc-100 border border-black px-2 py-0.5">
                    TOTAL: {order.total_qty} PCS
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Teks Catatan Mentah WA (Besar & Lega) */}
                {order.roster_wa_text && order.roster_wa_text.trim().length > 0 ? (
                  <div className="border border-black rounded p-2.5 bg-zinc-50 space-y-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider block text-zinc-900 border-b border-black pb-0.5">
                      CATATAN KHUSUS:
                    </span>
                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-zinc-950 p-1">
                      {order.roster_wa_text}
                    </div>
                  </div>
                ) : !hasScreenshots ? (
                  <div className="border border-dashed border-zinc-300 rounded p-6 text-center text-zinc-400 text-xs font-mono">
                    [ Tidak ada catatan teks khusus untuk pesanan ini ]
                  </div>
                ) : null}

                {/* Screenshot Catatan Konsumen (Tampil Besar & Jelas 2 Kolom) */}
                {hasScreenshots && (
                  <div className="border border-black rounded p-2.5 bg-white space-y-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider block text-zinc-900 border-b border-black pb-0.5">
                      LAMPIRAN:
                    </span>
                    
                    <div className="spk-ss-grid-2 grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {order.roster_screenshot_url && (
                        <div className="border border-zinc-300 rounded p-1 bg-zinc-50 flex items-center justify-center max-h-[500px] overflow-hidden">
                          <img 
                            src={order.roster_screenshot_url} 
                            alt="Screenshot 1" 
                            className="max-h-[480px] w-auto object-contain" 
                          />
                        </div>
                      )}
                      {order.roster_screenshot_url_2 && (
                        <div className="border border-zinc-300 rounded p-1 bg-zinc-50 flex items-center justify-center max-h-[500px] overflow-hidden">
                          <img 
                            src={order.roster_screenshot_url_2} 
                            alt="Screenshot 2" 
                            className="max-h-[480px] w-auto object-contain" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tanda Tangan ACC Lampiran di Bawah Lembar 2 */}
            <div className="pt-2 mt-auto">
              <div className="grid grid-cols-2 gap-6 text-xs text-center pb-2">
                <div className="space-y-6">
                  <span className="text-[9.5px] uppercase font-bold text-zinc-700 block">
                    Disetujui Oleh Pemesan (ACC):
                  </span>
                  <div>
                    <div className="w-40 border-b border-black mx-auto"></div>
                    <span className="text-[9.5px] text-zinc-700 font-medium block mt-0.5">
                      ( {order.customer_name} )
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <span className="text-[9.5px] uppercase font-bold text-zinc-700 block">
                    Diterbitkan Oleh (Admin / Setting):
                  </span>
                  <div>
                    <div className="w-40 border-b border-black mx-auto"></div>
                    <span className="text-[9.5px] text-zinc-900 font-bold block mt-0.5">
                      {currentAdmin}
                    </span>
                    <span className="text-[8.5px] text-zinc-500 block">Manayra Production</span>
                  </div>
                </div>
              </div>

              <div className="text-right text-[7.5px] text-zinc-400 font-mono tracking-wider uppercase pt-1">
                Lembar 2: Lampiran Roster
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
