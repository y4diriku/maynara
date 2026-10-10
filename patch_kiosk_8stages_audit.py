import os
import sys

target_paths = [
    os.path.join("jerseyflow", "app", "kiosk", "page.tsx"),
    os.path.join("app", "kiosk", "page.tsx")
]

target_file = None
for p in target_paths:
    if os.path.exists(p):
        target_file = p
        break

if not target_file:
    print("[ERROR] File app/kiosk/page.tsx tidak ditemukan!")
    sys.exit(1)

content = '''"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  QrCode, 
  CheckCircle2, 
  RotateCcw, 
  AlertCircle,
  Clock,
  Camera,
  CameraOff,
  History,
  ShieldAlert,
  User,
  CheckCheck,
  Lock,
  Banknote
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  fabric_type: string
  collar_type: string
  total_qty: number
  current_status: string
  priority: string
  deadline_date: string
  total_price?: number
  down_payment?: number
  is_paid_off?: boolean
  is_makloon?: boolean
  makloon_vendor_name?: string | null
}

interface AuditLog {
  id: string
  stage: string
  notes: string
  created_at: string
  operator_name?: string | null
  operator_role?: string | null
}

// 8 POS PRODUKSI DENGAN VALIDASI ROLE DAN NARASI AUDIT TRAIL SINKRON
const STAGES_CONFIG: { 
  [key: string]: { 
    label: string
    code: string
    next: string
    nextLabel: string
    allowedRoles: string[]
    logMessage: (isMakloon?: boolean, vendorName?: string | null) => string
  } 
} = {
  DESIGN_QUEUE: {
    label: "01. Antrean Desain",
    code: "01",
    next: "PRINTING",
    nextLabel: "02. Print Sublim",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_DESIGN", "DESIGNER"],
    logMessage: () => "Desain & layout pola selesai disiapkan. Berkas SPK diteruskan ke Pos 02 (Print Sublim)."
  },
  PRINTING: {
    label: "02. Print Sublim",
    code: "02",
    next: "CUTTING",
    nextLabel: "03. Potong Kain",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_PRINT"],
    logMessage: () => "Proses cetak kertas sublimasi selesai. Kertas & SPK diserahkan ke Pos 03 (Potong Kain)."
  },
  CUTTING: {
    label: "03. Potong Kain",
    code: "03",
    next: "HEAT_PRESS",
    nextLabel: "04. Press Kain",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_CUTTING"],
    logMessage: () => "Bahan kain rol dasar selesai dipotong panel kotak. Lembaran kain & SPK diserahkan ke Pos 04 (Press Kain)."
  },
  HEAT_PRESS: {
    label: "04. Press Kain",
    code: "04",
    next: "PATTERN_CUTTING",
    nextLabel: "05. Potong Pola",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_PRESS"],
    logMessage: () => "Proses transfer panas mesin press sublim selesai. Kain bergambar & SPK diserahkan ke Pos 05 (Potong Pola)."
  },
  PATTERN_CUTTING: {
    label: "05. Potong Pola",
    code: "05",
    next: "SEWING",
    nextLabel: "06. Lini Jahit",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_CUTTING"],
    logMessage: (isMakloon, vendor) => isMakloon
      ? `Potongan pola baju presisi selesai dipotong. Kain & SPK diserahkan ke Mitra Makloon (${vendor || "Vendor Luar"}).`
      : "Potongan pola jersey (badan, lengan, kerah) selesai dipotong presisi dan diserahkan ke Pos 06 (Lini Jahit)."
  },
  SEWING: {
    label: "06. Lini Jahit",
    code: "06",
    next: "QC_PACKING",
    nextLabel: "07. QC & Packing",
    allowedRoles: ["OWNER", "ADMIN", "SEWING_SUPERVISOR", "OPERATOR_SEWING"],
    logMessage: (isMakloon, vendor) => isMakloon
      ? `Jahitan jersey selesai diterima kembali dari mitra makloon (${vendor || "Vendor Luar"}) dan diserahkan ke Pos 07 (QC & Packing).`
      : "Proses jahit jersey selesai dirakit utuh dan diserahkan ke Pos 07 (QC & Packing)."
  },
  QC_PACKING: {
    label: "07. QC & Packing",
    code: "07",
    next: "READY_FOR_DELIVERY",
    nextLabel: "08. Siap Ambil",
    allowedRoles: ["OWNER", "ADMIN", "QC", "OPERATOR_PACKING"],
    logMessage: () => "Pemeriksaan QC jahitan, buang benang, dan packing plastik selesai (lolos sortir). Paket jersey ditempatkan di rak Pos 08 (Siap Ambil)."
  },
  READY_FOR_DELIVERY: {
    label: "08. Siap Ambil",
    code: "08",
    next: "COMPLETED",
    nextLabel: "Selesai & Arsip",
    allowedRoles: ["OWNER", "ACCOUNTING"], // HANYA OWNER & AKUNTING
    logMessage: () => "Pesanan telah diserahterimakan ke pemesan. Pembayaran telah LUNAS. Pengerjaan selesai penuh & diarsipkan."
  }
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

function formatTimeID(dateStr?: string | null): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB"
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount)
}

function sortAuditLogsDescending(logs: AuditLog[]): AuditLog[] {
  return [...logs].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (timeA !== timeB) return timeB - timeA
    return (b.id || "").localeCompare(a.id || "")
  })
}

function KioskContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialOrderQuery = searchParams.get("order") || ""

  const [orderNumberInput, setOrderNumberInput] = useState(initialOrderQuery)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  const [completedStageInfo, setCompletedStageInfo] = useState<{
    stageFinished: string
    nextStage: string
    operatorName: string
  } | null>(null)

  const [operatorInfo, setOperatorInfo] = useState<{ name: string; role: string; id: string | null }>({
    name: "Operator",
    role: "OPERATOR",
    id: null
  })

  const [isCameraActive, setIsCameraActive] = useState(false)
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    async function getOperator() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        setOperatorInfo({
          name: profile?.full_name || session.user.email?.split("@")[0] || "Operator",
          role: (profile?.role || "OPERATOR").toUpperCase(),
          id: session.user.id
        })
      }
    }
    getOperator()
  }, [])

  const loadAuditLogs = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from("production_logs")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })

      if (!error && data) {
        setAuditLogs(sortAuditLogsDescending(data))
      }
    } catch (err) {
      console.error("Gagal load audit:", err)
    }
  }

  const handleLookup = async (queryNum?: string) => {
    const target = (queryNum || orderNumberInput).trim()
    if (!target) return

    setLoading(true)
    setMessage(null)
    setCompletedStageInfo(null)

    try {
      const { data: oData, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", target)
        .single()

      if (oErr || !oData) {
        setCurrentOrder(null)
        setAuditLogs([])
        setMessage({ type: "error", text: `Pesanan "${target}" tidak ditemukan di sistem.` })
      } else {
        setCurrentOrder(oData)
        await loadAuditLogs(oData.id)
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat SPK" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialOrderQuery && operatorInfo.id) {
      handleLookup(initialOrderQuery)
    }
  }, [initialOrderQuery, operatorInfo.id])

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {}
        scannerRef.current = null
      }
      setIsCameraActive(false)
    } else {
      setIsCameraActive(true)
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        const qrCodeScanner = new Html5Qrcode("kiosk-qr-reader")
        scannerRef.current = qrCodeScanner

        await qrCodeScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            let scannedOrder = decodedText
            try {
              const url = new URL(decodedText)
              const orderParam = url.searchParams.get("order")
              if (orderParam) scannedOrder = orderParam
            } catch {}

            setOrderNumberInput(scannedOrder)
            handleLookup(scannedOrder)
            qrCodeScanner.stop().catch(() => {})
            setIsCameraActive(false)
          },
          () => {}
        )
      } catch (err) {
        setMessage({ type: "error", text: "Kamera tidak dapat diakses. Pastikan izin kamera aktif di browser." })
        setIsCameraActive(false)
      }
    }
  }

  const currentStageConfig = currentOrder ? STAGES_CONFIG[currentOrder.current_status] : null
  
  // Validasi Otorisasi Berdasarkan Role Akun Login
  const userHasPermission = currentStageConfig
    ? currentStageConfig.allowedRoles.includes(operatorInfo.role) ||
      operatorInfo.role === "OWNER"
    : false

  // Pengecekan Khusus Keuangan di Pos 08 (Siap Ambil)
  const isStage8 = currentOrder?.current_status === "READY_FOR_DELIVERY"
  const sisaTagihan = Number(currentOrder?.total_price || 0) - Number(currentOrder?.down_payment || 0)
  const isLunas = currentOrder?.is_paid_off || sisaTagihan <= 0

  const handleFinishCurrentStage = async () => {
    if (!currentOrder || !currentStageConfig || !userHasPermission) return

    // KUNCI GERBANG KASIR: Mencegah penyerahan di Pos 08 jika belum lunas!
    if (isStage8 && !isLunas) {
      setMessage({
        type: "error",
        text: `Pesanan belum lunas (Sisa: ${formatIDR(sisaTagihan)}). Tagihan wajib diselesaikan melalui Bagian Keuangan / Kasir sebelum diserahkan!`
      })
      return
    }

    setUpdating(true)
    setMessage(null)

    const nextStageKey = currentStageConfig.next
    const finishedLabel = currentStageConfig.label
    const nextLabel = currentStageConfig.nextLabel

    try {
      const updatePayload: Record<string, any> = {
        current_status: nextStageKey,
        updated_at: new Date().toISOString()
      }

      // Jika Pos 08 dieksekusi oleh Keuangan/Owner, tandai lunas otomatis
      if (isStage8) {
        updatePayload.is_paid_off = true
        updatePayload.down_payment = Number(currentOrder.total_price || 0)
      }

      const { error: updateErr } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", currentOrder.id)

      if (updateErr) throw updateErr

      const auditNote = currentStageConfig.logMessage(currentOrder.is_makloon, currentOrder.makloon_vendor_name)

      const { error: logErr } = await supabase.from("production_logs").insert({
        order_id: currentOrder.id,
        stage: nextStageKey,
        notes: auditNote,
        operator_name: operatorInfo.name,
        operator_role: operatorInfo.role,
        operator_id: operatorInfo.id
      })

      if (logErr) throw logErr

      await loadAuditLogs(currentOrder.id)

      setCompletedStageInfo({
        stageFinished: finishedLabel,
        nextStage: nextLabel,
        operatorName: operatorInfo.name
      })

      setCurrentOrder((prev) => prev ? { ...prev, current_status: nextStageKey } : null)
    } catch (err: any) {
      setMessage({ type: "error", text: "Gagal menyimpan log: " + err.message })
    } finally {
      setUpdating(false)
    }
  }

  const handleScanNext = () => {
    setCurrentOrder(null)
    setCompletedStageInfo(null)
    setAuditLogs([])
    setOrderNumberInput("")
    setMessage(null)
    router.replace("/kiosk")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 pt-1">
      {/* 1. Header Identitas Operator */}
      <div className="border border-zinc-200 bg-white p-3 rounded-lg shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black text-zinc-900 flex items-center gap-1.5 uppercase tracking-tight">
            <QrCode className="h-4 w-4 text-zinc-800" /> Pos Scanner SPK Produksi
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 mt-0.5">
            <User className="h-3.5 w-3.5 text-zinc-400" />
            <span>PIC: <strong className="text-zinc-900">{operatorInfo.name}</strong></span>
            <span className="text-zinc-300">&bull;</span>
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 bg-zinc-100 border border-zinc-200 rounded text-zinc-800">
              {operatorInfo.role}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCamera}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-colors ${
            isCameraActive 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-zinc-900 hover:bg-zinc-800 text-white"
          }`}
        >
          {isCameraActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          <span>{isCameraActive ? "Tutup Kamera" : "Scan Kamera"}</span>
        </button>
      </div>

      {/* Kotak Scanner Kamera */}
      {isCameraActive && (
        <div className="border-2 border-zinc-900 bg-black rounded-lg overflow-hidden p-2 space-y-2">
          <div id="kiosk-qr-reader" className="w-full h-64 bg-zinc-950 flex items-center justify-center text-white text-xs font-mono" />
          <p className="text-[11px] text-zinc-300 text-center font-mono">
            Arahkan kamera ke QR Code di lembar SPK
          </p>
        </div>
      )}

      {/* Input Pencarian Manual */}
      <div className="border border-zinc-200 bg-white p-2.5 rounded shadow-2xs">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleLookup()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ketik / tempel No. Order (cth: MN-2610...)"
            value={orderNumberInput}
            onChange={(e) => setOrderNumberInput(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-zinc-300 rounded text-xs font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Mencari..." : "Buka SPK"}
          </button>
        </form>
      </div>

      {message && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          message.type === "error"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 2. Layar Sukses Serah Terima */}
      {completedStageInfo ? (
        <div className="border-2 border-emerald-500 bg-emerald-50/70 p-6 rounded-lg shadow-sm text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="h-14 w-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCheck className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-black text-emerald-950 uppercase tracking-tight">
              Tugas di Pos {completedStageInfo.stageFinished} Telah Selesai!
            </h2>
            <p className="text-xs text-emerald-800">
              Audit trail serah terima telah dicatat oleh: <strong>{completedStageInfo.operatorName}</strong>
            </p>
          </div>

          <div className="border border-emerald-200 bg-white p-3.5 rounded text-xs text-zinc-700 space-y-1.5 max-w-md mx-auto">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
              Instruksi Alur Pengerjaan
            </span>
            <p className="font-semibold text-zinc-900">
              Silakan serahkan berkas & hasil kerja ke pos selanjutnya:
            </p>
            <div className="inline-block bg-zinc-900 text-white font-black px-3.5 py-1.5 rounded text-xs font-mono">
              &rarr; Pos {completedStageInfo.nextStage}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleScanNext}
              className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded text-xs transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Scan SPK Berikutnya</span>
            </button>
          </div>
        </div>
      ) : currentOrder ? (
        /* 3. Detail SPK Yang Sedang Dibuka */
        <div className="space-y-4">
          <div className="border border-zinc-200 bg-white rounded-lg shadow-2xs overflow-hidden">
            <div className="bg-zinc-900 text-white p-3 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider block">
                  LEMBAR KERJA PRODUKSI
                </span>
                <strong className="text-sm font-mono tracking-wide">{currentOrder.order_number}</strong>
              </div>
              <span className="border border-white/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                {currentOrder.priority}
              </span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Nama Order Menonjol */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5 space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-wider">Nama Order</span>
                <strong className="text-xs font-black uppercase text-zinc-950 block">
                  {currentOrder.order_title || "-"}
                </strong>
                <span className="text-[11px] text-zinc-600 block">
                  Pemesan: <strong>{currentOrder.customer_name}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Target Deadline</span>
                  <strong className="text-red-700 font-mono text-xs">{formatDateID(currentOrder.deadline_date)}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Total Pesanan</span>
                  <strong className="font-mono text-zinc-900 font-bold text-xs">{currentOrder.total_qty} PCS</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500 block text-[10px]">Bahan & Kerah</span>
                  <span className="text-zinc-800 font-medium text-xs">{currentOrder.fabric_type} &bull; {currentOrder.collar_type}</span>
                </div>
              </div>

              {/* Posisi Pengerjaan */}
              <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50 space-y-1">
                <span className="text-[9px] uppercase font-bold text-zinc-500 block">Posisi Pengerjaan Saat Ini</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    {currentStageConfig?.label || currentOrder.current_status}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Target berikutnya: <strong className="text-zinc-800">{currentStageConfig?.nextLabel || "Selesai"}</strong>
                  </span>
                </div>
              </div>

              {/* Peringatan Khusus Pos 08 (Kasir & Pelunasan) */}
              {isStage8 && !isLunas && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs space-y-1 text-red-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Banknote className="h-4 w-4 text-red-600 shrink-0" />
                    <span>Tagihan Belum Lunas ({formatIDR(sisaTagihan)})</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-red-700">
                    Barang tidak dapat diserahkan sebelum pembayaran diselesaikan. Selesaikan transaksi di Bagian Keuangan.
                  </p>
                </div>
              )}

              {/* Tombol Eksekusi atau Peringatan Otorisasi */}
              {userHasPermission ? (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={updating || (isStage8 && !isLunas)}
                    onClick={handleFinishCurrentStage}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {updating
                        ? "Menyimpan & Menyerahkan..."
                        : isStage8
                        ? "Konfirmasi Penyerahan Barang & Arsip"
                        : `Selesaikan Tugas ${currentStageConfig?.label || ""} & Teruskan`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isStage8 ? <Lock className="h-4 w-4 text-amber-700 shrink-0" /> : <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />}
                    <span>{isStage8 ? "Khusus Bagian Keuangan / Kasir" : "Bukan Wewenang Divisi Anda"}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {isStage8 
                      ? "Tahap akhir serah terima barang hanya dapat dieksekusi oleh akun dengan role ACCOUNTING atau OWNER."
                      : `Pesanan ini berada di pos ${currentStageConfig?.label}. Akun Anda adalah ${operatorInfo.role}. Hanya operator pos terkait yang dapat memindahkan pesanan ini.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4. Timeline Riwayat Audit Trail Terbalik (Terbaru di Paling Atas) */}
          <div className="border border-zinc-200 bg-white rounded-lg p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5 uppercase tracking-tight">
                <History className="h-3.5 w-3.5 text-zinc-600" /> Riwayat Pengerjaan & Audit Trail
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {auditLogs.length} Catatan
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-4 text-center text-zinc-400 text-xs font-mono">
                Belum ada catatan perpindahan pos untuk pesanan ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.map((log, index) => {
                  const picName = log.operator_name || "Staf Workshop"
                  const picRole = log.operator_role || "OPERATOR"
                  const isLatest = index === 0

                  return (
                    <div
                      key={log.id}
                      className={
                        "pl-3 py-1.5 space-y-0.5 text-xs border-l-2 " +
                        (isLatest
                          ? "border-emerald-600 bg-emerald-50/50 rounded-r p-2 -ml-0.5"
                          : "border-zinc-200")
                      }
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {isLatest && (
                            <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                              Pos Terkini
                            </span>
                          )}
                          <strong className="text-zinc-900 font-bold">
                            {picName}
                          </strong>
                          <span className="text-zinc-500 font-mono font-medium px-1 py-0.2 bg-zinc-100 rounded text-[10px] border border-zinc-200">
                            {picRole}
                          </span>
                        </div>

                        <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          {formatDateID(log.created_at)} &bull; {formatTimeID(log.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-snug">
                        {log.notes}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono">Memuat pemindai SPK...</div>}>
      <KioskContent />
    </Suspense>
  )
}
'''

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"[BERHASIL] File {target_file} berhasil disinkronkan dengan 8 Pos Kerja, Gerbang Kasir & Validasi Role!")