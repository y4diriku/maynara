"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { QRCodeSVG } from "qrcode.react"
import { Printer } from "lucide-react"

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
  is_makloon?: boolean
  makloon_vendor_name?: string | null
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

export default function SPKPrintPage() {
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
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
    loadSPK()
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

  const isStelan = order.package_type === "STELAN"
  const isPrintPress = order.order_type === "PRINT_PRESS"

  const hasScreenshots = Boolean(order.roster_screenshot_url || order.roster_screenshot_url_2)
  const hasSheet2 = Boolean(
    (order.roster_wa_text && order.roster_wa_text.trim().length > 0) ||
    hasScreenshots
  )

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
          }
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .page-break-container {
            page-break-before: always !important;
            break-before: page !important;
          }
          .spk-footer-grid {
            display: grid !important;
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
          }
          .spk-ss-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>

      <div className="bg-white text-black min-h-screen p-4 md:p-6 font-sans max-w-[215mm] mx-auto print:p-0 print:max-w-none print:m-0 space-y-6">
        {/* Tombol Cetak Browser */}
        <div className="print:hidden flex justify-between items-center bg-zinc-100 border border-zinc-300 p-3 rounded">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Lembar Kerja Produksi (SPK Fisik)</h2>
            <p className="text-xs text-zinc-600">
              {hasSheet2 ? "Format: 2 Lembar Khusus (Pola & Roster)." : "Format: 1 Lembar Saja."} Gunakan kertas A4/F4 Skala 100%.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded text-xs font-semibold hover:bg-zinc-800 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Dokumen Sekarang</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 📄 LEMBAR 1: PRODUKSI & POLA (KIRI: ANAK, KANAN: DEWASA)                  */}
        {/* ========================================================================= */}
        <div className="border border-zinc-200 print:border-none p-4 print:p-0 rounded bg-white flex flex-col justify-between min-h-[268mm] print:min-h-[270mm]">
          <div className="space-y-2">
            {/* Header SPK */}
            <div className="border-b-2 border-black pb-2 flex justify-between items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg font-black tracking-tight uppercase">SURAT PERINTAH KERJA (SPK)</span>
                  <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase">
                    {order.priority}
                  </span>
                  <span className={`border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    isPrintPress ? "border-black bg-black text-white" : "border-black bg-zinc-200 text-black"
                  }`}>
                    {isPrintPress ? "TIPE: PRINT + PRESS" : "TIPE: FULL ORDER"}
                  </span>
                  <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase">
                    {order.is_makloon ? `JAHIT: MAKLOON (${order.makloon_vendor_name || "LUAR"})` : "JAHIT: INTERNAL"}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-800 tracking-wide mt-0.5">MANAYRA PRODUCTION WORKSHOP</p>
                
                <div className="mt-1.5 text-xs">
                  <table className="border-collapse text-[11px] leading-tight">
                    <tbody>
                      <tr>
                        <td className="w-24 text-zinc-600 font-medium py-0.5">Nama Order</td>
                        <td className="w-3 text-center py-0.5">:</td>
                        <td className="font-black text-zinc-950 uppercase py-0.5 text-xs">
                          {order.order_title || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-zinc-600 font-medium py-0.5">Nama Pemesan</td>
                        <td className="text-center py-0.5">:</td>
                        <td className="font-bold text-zinc-900 uppercase py-0.5">{order.customer_name}</td>
                      </tr>
                      <tr>
                        <td className="text-zinc-600 font-medium py-0.5">Admin / Setting</td>
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

              <div className="flex flex-col items-center border border-black p-1.5 rounded bg-white shrink-0">
                <QRCodeSVG value={kioskScanUrl} size={76} level="M" />
                <span className="text-[10px] font-mono font-bold mt-1 text-center tracking-tight leading-none">{order.order_number}</span>
                <span className="text-[7px] text-zinc-600 font-bold uppercase mt-0.5">SCAN POS KERJA</span>
              </div>
            </div>

            {/* Parameter Spesifikasi */}
            <div className="grid grid-cols-4 gap-2 border-b-2 border-black py-1.5 text-xs">
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Target Deadline</span>
                <strong className="text-sm font-mono text-red-700">{formatDateID(order.deadline_date)}</strong>
              </div>
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Bahan Kain / Kerah</span>
                <strong className="text-[11px] block leading-tight">{order.fabric_type}</strong>
                <span className="text-[10px] text-zinc-600">{order.collar_type}</span>
              </div>
              <div className="border-r border-black/20 pr-2">
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Paket, Tinta & Lokasi</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="border border-black bg-zinc-100 font-bold px-1.5 py-0.2 rounded text-[8.5px] uppercase">
                    {isStelan ? "STELAN (+CELANA)" : "ATASAN SAJA"}
                  </span>
                  <span className="border border-black bg-white font-bold px-1.5 py-0.2 rounded text-[8.5px] uppercase">
                    {order.ink_type === "CINA" ? "TINTA CINA" : "TINTA ORI"}
                  </span>
                </div>
                <span className="text-[8px] text-zinc-600 block mt-0.5 font-mono">
                  Desain: <strong>{order.design_location === "LUAR" ? "File Luar" : "Disini"}</strong> &bull; Potong: <strong>{order.cutting_location === "LUAR" ? "Kain Luar" : "Disini"}</strong>
                </span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-600 block uppercase font-bold">Total Jumlah Order</span>
                <strong className="text-base font-mono font-black">{order.total_qty} PCS / STEL</strong>
              </div>
            </div>

            {/* Mockup Desain */}
            <div className="border-b-2 border-black py-2 space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider block text-zinc-800">
                PANDUAN VISUAL DESAIN PRODUKSI
              </span>

              {mockups.length === 0 ? (
                <div className="h-44 border border-dashed border-zinc-400 rounded flex items-center justify-center text-zinc-400 text-xs font-mono">
                  [ Belum ada mockup desain yang diunggah ]
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
                      <div className="h-64 flex items-center justify-center bg-white border border-zinc-300 rounded overflow-hidden p-1">
                        <img src={m.url!} alt={m.label} className="h-full w-full object-contain" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TABEL MATRIKS UKURAN: KIRI ANAK, KANAN DEWASA (SINKRON PRESISI) */}
            <div className="border-b-2 border-black py-1.5 space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider block text-zinc-800">
                MATRIKS UKURAN & REKAPITULASI POLA PRODUKSI
              </span>

              {matrixCalculation ? (
                <div className="space-y-1.5">
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
                  <div className="py-1.5 border-t border-b border-black flex items-center justify-between text-xs font-mono font-bold">
                    <span className="font-sans uppercase text-[10px] tracking-wider text-black">GRAND TOTAL REKAPITULASI:</span>
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

            {/* Catatan Teknis */}
            <div className="border-b border-black py-1">
              <span className="font-bold uppercase text-[8.5px] block text-zinc-900 tracking-wider">
                CATATAN TEKNIS & INSTRUKSI PENGERJAAN:
              </span>
              <div className="mt-0.5 text-[10.5px] leading-relaxed text-zinc-900 font-sans whitespace-pre-wrap">
                {order.production_notes || "Cocokkan nomor dada/punggung, logo sponsor, dan variasi warna lengan sesuai gambar mockup sebelum kain dirakit di mesin jahit."}
              </div>
            </div>

            {/* Kotak Paraf Operator */}
            <div className="pt-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-black">
                  LEMBAR KENDALI & PARAF OPERATOR
                </span>
                <span className="text-[7.5px] font-mono text-zinc-500">
                  * Wajib diparaf PIC setelah menyelesaikan proses di tiap pos
                </span>
              </div>

              <div className="spk-footer-grid grid grid-cols-4 sm:grid-cols-8 gap-1 text-[8px] text-center">
                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">1. Desain</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">2. Print Sublim</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">3. Potong Kain</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">4. Press Kain</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">5. Potong Pola</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">
                    {order.is_makloon ? "6. Jahit Makloon" : "6. Lini Jahit"}
                  </div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">{order.is_makloon ? "Mitra:" : "PIC:"}</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">7. QC & Pack</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">PIC:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>

                <div className="border border-black p-1 rounded flex flex-col justify-between min-h-[50px]">
                  <div className="font-bold uppercase leading-tight text-[8px]">8. Serah Terima</div>
                  <div className="my-0.5 border-b border-dashed border-zinc-400">
                    <span className="text-[6.5px] text-zinc-500 block text-left">Admin:</span>
                    <div className="h-1.5"></div>
                  </div>
                  <div className="text-[7px] text-zinc-600 font-medium">Paraf/Tgl</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right text-[8px] text-zinc-400 font-mono tracking-wider uppercase pt-2">
            Lembar 1: Produksi & Pola
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📄 LEMBAR 2: ROSTER & PERSONALISASI                                       */}
        {/* ========================================================================= */}
        {hasSheet2 && (
          <div className="page-break-container border border-zinc-200 print:border-none p-4 print:p-0 rounded bg-white flex flex-col justify-between min-h-[268mm] print:min-h-[270mm] pt-6 print:pt-0">
            <div className="space-y-3">
              <div className="border-b-2 border-black pb-2 flex justify-between items-center">
                <div>
                  <span className="text-base font-black tracking-tight uppercase">SPK: ROSTER & PERSONALISASI</span>
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
                {order.roster_wa_text && order.roster_wa_text.trim().length > 0 && (
                  <div className="border border-black rounded p-2.5 bg-zinc-50 space-y-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider block text-zinc-900 border-b border-black pb-0.5">
                      CATATAN KHUSUS
                    </span>
                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-zinc-950 p-1">
                      {order.roster_wa_text}
                    </div>
                  </div>
                )}

                {hasScreenshots && (
                  <div className="border border-black rounded p-2.5 bg-white space-y-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider block text-zinc-900 border-b border-black pb-0.5">
                      LAMPIRAN SCREENSHOT
                    </span>
                    
                    <div className="spk-ss-grid-2 grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {order.roster_screenshot_url && (
                        <div className="border border-zinc-300 rounded p-1 bg-zinc-50 flex items-center justify-center max-h-[460px] overflow-hidden">
                          <img 
                            src={order.roster_screenshot_url} 
                            alt="Screenshot 1" 
                            className="max-h-[440px] w-auto object-contain" 
                          />
                        </div>
                      )}
                      {order.roster_screenshot_url_2 && (
                        <div className="border border-zinc-300 rounded p-1 bg-zinc-50 flex items-center justify-center max-h-[460px] overflow-hidden">
                          <img 
                            src={order.roster_screenshot_url_2} 
                            alt="Screenshot 2" 
                            className="max-h-[440px] w-auto object-contain" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-black bg-zinc-100 p-2 rounded flex items-center justify-between text-xs">
                <div className="text-[10px] text-zinc-700 leading-tight">
                  <strong>INSTRUKSI TIM SETTING & QC:</strong>
                  <p>Cocokkan ejaan nama, nomor punggung, dan ukuran langsung dari catatan asli konsumen di atas.</p>
                </div>
                <div className="flex items-center gap-3 font-bold text-[10px] shrink-0">
                  <span className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 border border-black bg-white"></div> Nama Cocok
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 border border-black bg-white"></div> Nomor Cocok
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 border border-black bg-white"></div> QC Lolos
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-[8px] text-zinc-400 font-mono tracking-wider uppercase pt-2">
              Lembar 2: Roster & Personalisasi
            </div>
          </div>
        )}
      </div>
    </>
  )
}
