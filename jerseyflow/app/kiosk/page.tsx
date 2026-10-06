"use client"

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
  CheckCheck
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  fabric_type: string
  collar_type: string
  total_qty: number
  current_status: string
  priority: string
  deadline_date: string
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

const STAGES_CONFIG: { [key: string]: { label: string; next: string; nextLabel: string; allowedRoles: string[] } } = {
  DESIGN_QUEUE: {
    label: "Antrean Desain",
    next: "PRINTING",
    nextLabel: "Cetak & Sublim",
    allowedRoles: ["OWNER", "ADMIN", "DESIGNER", "OPERATOR_PRINT"]
  },
  PRINTING: {
    label: "Cetak & Sublim",
    next: "CUTTING",
    nextLabel: "Cutting Pola",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_PRINT"]
  },
  CUTTING: {
    label: "Cutting Pola",
    next: "SEWING",
    nextLabel: "Lini Jahit",
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_CUTTING"]
  },
  SEWING: {
    label: "Lini Jahit",
    next: "QC_PACKING",
    nextLabel: "QC & Packing",
    allowedRoles: ["OWNER", "ADMIN", "SEWING_SUPERVISOR", "OPERATOR_SEWING"]
  },
  QC_PACKING: {
    label: "QC & Packing",
    next: "READY_FOR_DELIVERY",
    nextLabel: "Siap Diambil",
    allowedRoles: ["OWNER", "ADMIN", "QC", "OPERATOR_PACKING"]
  },
  READY_FOR_DELIVERY: {
    label: "Siap Diambil",
    next: "COMPLETED",
    nextLabel: "Pesanan Selesai",
    allowedRoles: ["OWNER", "ADMIN"]
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

// Fungsi pembantu: Memastikan baris terbaru selalu di urutan paling pertama (Index 0)
function sortAuditLogsDescending(logs: AuditLog[]): AuditLog[] {
  return [...logs].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    if (timeA !== timeB) {
      return timeB - timeA
    }
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
    role: "OPERATOR_PRINT",
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
          role: (profile?.role || "OPERATOR_PRINT").toUpperCase(),
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

        // Hanya baca riwayat log tanpa menambah log sebelum divalidasi
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
  const userHasPermission = currentStageConfig
    ? currentStageConfig.allowedRoles.includes(operatorInfo.role) ||
      operatorInfo.role === "OWNER" ||
      operatorInfo.role === "ADMIN"
    : false

  const handleFinishCurrentStage = async () => {
    if (!currentOrder || !currentStageConfig || !userHasPermission) return
    setUpdating(true)
    setMessage(null)

    const nextStageKey = currentStageConfig.next
    const finishedLabel = currentStageConfig.label
    const nextLabel = currentStageConfig.nextLabel

    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          current_status: nextStageKey,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentOrder.id)

      if (updateErr) throw updateErr

      const auditNote = `Tugas pos [${finishedLabel}] telah diselesaikan. Kain & SPK diserahkan ke pos [${nextLabel}].`
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
            placeholder="Ketik / tempel No. Order (cth: JR-2610...)"
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
              Audit trail pengerjaan telah dicatat oleh: <strong>{completedStageInfo.operatorName}</strong>
            </p>
          </div>

          <div className="border border-emerald-200 bg-white p-3.5 rounded text-xs text-zinc-700 space-y-1.5 max-w-md mx-auto">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
              Instruksi Serah Terima
            </span>
            <p className="font-semibold text-zinc-900">
              Silakan bawa fisik lembar SPK & kain ke pos selanjutnya:
            </p>
            <div className="inline-block bg-zinc-900 text-white font-black px-3.5 py-1.5 rounded text-xs font-mono">
              &rarr; {completedStageInfo.nextStage}
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
        /* 3. Detail SPK */
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
              <div className="grid grid-cols-2 gap-2.5 text-xs border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Nama Pemesan</span>
                  <strong className="text-zinc-900 uppercase font-bold text-xs">{currentOrder.customer_name}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Target Deadline</span>
                  <strong className="text-red-700 font-mono text-xs">{formatDateID(currentOrder.deadline_date)}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Bahan & Kerah</span>
                  <span className="text-zinc-800 font-medium text-xs">{currentOrder.fabric_type} &bull; {currentOrder.collar_type}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Total Pesanan</span>
                  <strong className="font-mono text-zinc-900 font-bold text-xs">{currentOrder.total_qty} PCS</strong>
                </div>
              </div>

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

              {userHasPermission ? (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={handleFinishCurrentStage}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {updating
                        ? "Menyimpan & Menyerahkan..."
                        : `Selesaikan Tugas Pos ${currentStageConfig?.label || ""} & Teruskan`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Bukan Wewenang Divisi Anda</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Pesanan ini saat ini berada di pos <strong>{currentStageConfig?.label}</strong>. Akun Anda adalah <strong>{operatorInfo.role}</strong>. Hanya operator pos terkait atau Admin/Owner yang dapat memindahkan pesanan ini.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4. Timeline Riwayat Audit Trail Terbalik (Terbaru Selalu di Paling Atas) */}
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
