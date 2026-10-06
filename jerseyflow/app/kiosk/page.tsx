"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  Camera, 
  Search, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Shirt, 
  User, 
  History,
  AlertTriangle 
} from "lucide-react"

const STAGES = [
  { key: "DESIGN_QUEUE", label: "Antrean Desain" },
  { key: "PRINTING", label: "Cetak & Sublim" },
  { key: "CUTTING", label: "Cutting Pola" },
  { key: "SEWING", label: "Lini Jahit" },
  { key: "QC_PACKING", label: "QC & Packing" },
  { key: "READY_FOR_DELIVERY", label: "Siap Ambil" },
]

export default function KioskPage() {
  const searchParams = useSearchParams()
  const initialOrderQuery = searchParams.get("order") || ""

  const [searchCode, setSearchCode] = useState(initialOrderQuery)
  const [order, setOrder] = useState<any | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState("")
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)

  const [scannerActive, setScannerActive] = useState(false)
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        setCurrentUser({
          id: session.user.id,
          name: prof?.full_name || session.user.email?.split("@")[0] || "Operator",
          role: (prof?.role || "OPERATOR").toUpperCase()
        })
      }
    }
    getUser()

    if (initialOrderQuery) {
      loadOrderData(initialOrderQuery)
    }
  }, [initialOrderQuery])

  const loadOrderData = async (code: string) => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return

    setLoading(true)
    setMsg("")

    const { data: oData } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", cleanCode)
      .single()

    if (!oData) {
      setOrder(null)
      setLogs([])
      setMsg("Order " + cleanCode + " tidak ditemukan.")
      setLoading(false)
      return
    }

    setOrder(oData)

    // Muat Audit Trail / Riwayat Pos
    const { data: lData } = await supabase
      .from("production_logs")
      .select("*")
      .eq("order_id", oData.id)
      .order("created_at", { ascending: false })

    if (lData) setLogs(lData)
    setLoading(false)
  }

  const handleAdvanceStage = async () => {
    if (!order) return
    setProcessing(true)
    setMsg("")

    const currentIndex = STAGES.findIndex((s) => s.key === order.current_status)
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
      setMsg("Pesanan sudah berada di tahapan akhir.")
      setProcessing(false)
      return
    }

    const nextStage = STAGES[currentIndex + 1]
    const operatorName = currentUser?.name || "Operator"
    const operatorRole = currentUser?.role || "OPERATOR"

    try {
      // 1. Update status order
      const { error: oErr } = await supabase
        .from("orders")
        .update({ current_status: nextStage.key })
        .eq("id", order.id)

      if (oErr) throw oErr

      // 2. Audit Trail Record
      const { error: lErr } = await supabase
        .from("production_logs")
        .insert({
          order_id: order.id,
          stage: nextStage.key,
          notes: `Diselesaikan oleh ${operatorName} (${operatorRole}) -> Maju ke ${nextStage.label}`
        })

      if (lErr) throw lErr

      setMsg(`Berhasil! Order berpindah ke pos: ${nextStage.label}`)
      loadOrderData(order.order_number)
    } catch (err: any) {
      setMsg("Gagal memproses pos: " + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const startScanner = async () => {
    setScannerActive(true)
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const html5QrCode = new Html5Qrcode("kiosk-qr-reader")
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let code = decodedText
          if (decodedText.includes("order=")) {
            code = decodedText.split("order=")[1].split("&")[0]
          }
          setSearchCode(code)
          loadOrderData(code)
          stopScanner()
        },
        () => {}
      )
    } catch (err) {
      setMsg("Tidak dapat mengaktifkan kamera scanner.")
      setScannerActive(false)
    }
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear()
        setScannerActive(false)
      }).catch(() => {
        setScannerActive(false)
      })
    } else {
      setScannerActive(false)
    }
  }

  const currentStageIndex = order ? STAGES.findIndex((s) => s.key === order.current_status) : -1
  const nextStage = currentStageIndex !== -1 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div>
          <h1 className="text-base font-bold text-zinc-900 leading-tight">Station Kiosk Produksi</h1>
          <p className="text-xs text-zinc-600">Scan QR SPK fisik untuk memvalidasi pengerjaan pos dan audit trail.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-zinc-400 block font-mono">Operator Bertugas</span>
          <strong className="text-xs font-bold text-zinc-800">{currentUser?.name}</strong>
          <span className="text-[10px] text-zinc-500 font-mono ml-1">({currentUser?.role})</span>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded text-xs font-medium border ${
          msg.includes("Berhasil") ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
        }`}>
          {msg}
        </div>
      )}

      {/* INPUT SCANNER / KODE */}
      <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Ketik atau scan nomor SPK (JR-XXXX)..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOrderData(searchCode)}
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded text-xs font-mono uppercase focus:ring-1 focus:ring-zinc-900 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => loadOrderData(searchCode)}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold shadow-2xs"
          >
            Cari
          </button>
          <button
            type="button"
            onClick={scannerActive ? stopScanner : startScanner}
            className={`px-3 py-2 rounded text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              scannerActive ? "bg-red-50 text-red-700 border-red-300" : "bg-zinc-100 text-zinc-800 border-zinc-300 hover:bg-zinc-200"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>{scannerActive ? "Tutup Kamera" : "Scan Kamera"}</span>
          </button>
        </div>

        {scannerActive && (
          <div className="p-3 border border-zinc-300 rounded bg-zinc-50 flex flex-col items-center">
            <div id="kiosk-qr-reader" className="w-full max-w-xs rounded overflow-hidden"></div>
            <span className="text-[11px] text-zinc-500 mt-2 font-mono">Arahkan kamera ke QR Code pada kertas SPK</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="p-8 text-center text-xs font-mono text-zinc-500">
          Memuat data pesanan & riwayat pos...
        </div>
      )}

      {order && !loading && (
        <div className="space-y-4">
          {/* PANEL STATUS POS & TOMBOL SELESAI */}
          <div className="border border-zinc-200 bg-white p-4 rounded shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Surat Perintah Kerja</span>
                <h2 className="text-base font-bold text-zinc-900">{order.order_number}</h2>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Posisi Pos Saat Ini</span>
                <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-zinc-900 text-white shadow-2xs font-mono">
                  {STAGES.find((s) => s.key === order.current_status)?.label || order.current_status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 border border-zinc-100 bg-zinc-50 rounded">
                <span className="text-[10px] text-zinc-500 block">Pemesan</span>
                <strong className="text-zinc-900 truncate block">{order.customer_name}</strong>
              </div>
              <div className="p-2 border border-zinc-100 bg-zinc-50 rounded">
                <span className="text-[10px] text-zinc-500 block">Bahan & Kerah</span>
                <strong className="text-zinc-900 truncate block">{order.fabric_type}</strong>
              </div>
              <div className="p-2 border border-zinc-100 bg-zinc-50 rounded">
                <span className="text-[10px] text-zinc-500 block">Volume Total</span>
                <strong className="text-zinc-900 font-mono block">{order.total_qty} PCS</strong>
              </div>
              <div className="p-2 border border-zinc-100 bg-zinc-50 rounded">
                <span className="text-[10px] text-zinc-500 block">Deadline</span>
                <strong className="text-red-700 font-mono block">{order.deadline_date}</strong>
              </div>
            </div>

            {/* ACTION ADVANCE BUTTON */}
            {nextStage ? (
              <button
                type="button"
                disabled={processing}
                onClick={handleAdvanceStage}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {processing ? "Mencatat Log..." : `Selesaikan Pos Ini & Lanjut ke: ${nextStage.label}`}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="p-3 bg-zinc-100 rounded text-center text-xs text-zinc-600 font-medium">
                Pesanan telah mencapai tahapan akhir (Siap Diambil/Kirim).
              </div>
            )}
          </div>

          {/* AUDIT TRAIL DIGITAL (RIWAYAT VALIDASI STASIUN KERJA) */}
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-zinc-500" /> Audit Trail / Riwayat Pos Kerja ({logs.length})
            </span>

            <div className="divide-y divide-zinc-100 text-xs">
              {logs.length === 0 ? (
                <div className="py-4 text-center text-zinc-400 text-xs">Belum ada catatan riwayat pos.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="py-2 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-900"></span>
                        <span>{log.notes || `Berpindah ke pos ${log.stage}`}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 block">
                        Stempel Pos: {log.stage}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
