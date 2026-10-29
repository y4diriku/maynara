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
  CheckCheck,
  Lock,
  Banknote,
  Printer,
  Sparkles,
  Layers,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  Copy
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  fabric_type: string
  collar_type?: string
  total_qty: number
  current_status: string
  priority?: string
  deadline_date: string
  ink_type?: string | null
  ink_profile?: string | null
  size_breakdown?: any
  mockup_url?: string | null
  link_drive_aset?: string | null
  catatan_desain?: string | null
  total_price?: number
  down_payment?: number
  is_paid_off?: boolean
  is_makloon?: boolean
  makloon_vendor_name?: string | null
  created_at?: string
}

interface AuditLog {
  id: string
  stage: string
  notes: string
  created_at: string
  operator_name?: string | null
  operator_role?: string | null
}

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
    allowedRoles: ["OWNER", "ADMIN", "OPERATOR_PATTERN_CUTTING", "OPERATOR_CUTTING"],
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
    allowedRoles: ["OWNER", "ACCOUNTING"],
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

  // State Khusus Stasiun Kerja Print Sublim & Mode Switcher
  const [printQueue, setPrintQueue] = useState<Order[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [showManualScanner, setShowManualScanner] = useState(false)
  const [workstationMode, setWorkstationMode] = useState<"PRINT_QUEUE" | "SCANNER">("PRINT_QUEUE")

  const [isCameraActive, setIsCameraActive] = useState(false)
  const scannerRef = useRef<any>(null)

  // Ambil Data Sesi & Role
  useEffect(() => {
    async function getOperator() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        const r = (profile?.role || "OPERATOR").toUpperCase()
        setOperatorInfo({
          name: profile?.full_name || session.user.email?.split("@")[0] || "Operator",
          role: r,
          id: session.user.id
        })

        // Jika bukan operator print murni, default ke mode scanner
        if (r !== "OPERATOR_PRINT" && r !== "ADMIN" && r !== "OWNER") {
          setWorkstationMode("SCANNER")
        }
      }
    }
    getOperator()
  }, [])

  // Muat Antrean Pesanan di Pos 02 dengan 3 Lapis FIFO Cerdas
  const loadPrintQueue = async () => {
    setLoadingQueue(true)
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, order_title, customer_name, fabric_type, collar_type, total_qty, current_status, priority, deadline_date, ink_type, ink_profile, size_breakdown, mockup_url, link_drive_aset, catatan_desain, created_at")
        .eq("current_status", "PRINTING")

      if (!error && data) {
        // PENGURUTAN PRODUKSI (SMART FIFO):
        // 1. Prioritas Layanan (URGENT > HIGH > NORMAL)
        // 2. Deadline terdekat
        // 3. FIFO (created_at lebih awal diproses lebih awal)
        const priorityWeight: Record<string, number> = { URGENT: 3, HIGH: 2, NORMAL: 1 }

        const sorted = [...data].sort((a, b) => {
          const pA = priorityWeight[a.priority || "NORMAL"] || 1
          const pB = priorityWeight[b.priority || "NORMAL"] || 1
          if (pB !== pA) return pB - pA

          const deadA = a.deadline_date || "9999-99-99"
          const deadB = b.deadline_date || "9999-99-99"
          if (deadA !== deadB) return deadA.localeCompare(deadB)

          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          return timeA - timeB
        })

        setPrintQueue(sorted)
      }
    } catch (err) {
      console.error("Gagal memuat antrean cetak:", err)
    } finally {
      setLoadingQueue(false)
    }
  }

  useEffect(() => {
    loadPrintQueue()

    const channel = supabase
      .channel("kiosk_realtime_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadPrintQueue()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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

  // Konfirmasi 1-Klik Langsung dari Layar Komputer Cetak
  const handleQuickFinishPrint = async (task: Order) => {
    const profileName = task.ink_profile || (task.ink_type === "CINA" ? "2 PAS" : "952")
    const confirmMsg = `Konfirmasi selesai cetak kertas sublimasi untuk "${task.order_number} - ${task.order_title || task.customer_name}"?\n\nProfil Tinta: ${task.ink_type === "CINA" ? "Tinta Cina" : "Tinta Ori"} (${profileName})\n\nKertas cetak dan SPK siap diserahkan ke Pos 03 (Potong Kain).`

    if (!window.confirm(confirmMsg)) return

    setUpdating(true)
    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          current_status: "CUTTING",
          updated_at: new Date().toISOString()
        })
        .eq("id", task.id)

      if (updateErr) throw updateErr

      await supabase.from("production_logs").insert({
        order_id: task.id,
        stage: "CUTTING",
        notes: `Proses cetak kertas sublimasi selesai menggunakan profil ${profileName}. Kertas cetak & SPK diserahkan ke Pos 03 (Potong Kain).`,
        operator_name: operatorInfo.name,
        operator_role: operatorInfo.role,
        operator_id: operatorInfo.id
      })

      setPrintQueue((prev) => prev.filter((o) => o.id !== task.id))
      setMessage({
        type: "success",
        text: `Berhasil! Pesanan ${task.order_number} selesai dicetak dan diteruskan ke Pos 03 (Potong Kain).`
      })
    } catch (err: any) {
      alert("Gagal menyelesaikan cetak: " + err.message)
    } finally {
      setUpdating(false)
    }
  }

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
    ? currentStageConfig.allowedRoles.includes(operatorInfo.role) || operatorInfo.role === "OWNER"
    : false

  const isStage8 = currentOrder?.current_status === "READY_FOR_DELIVERY"
  const sisaTagihan = Number(currentOrder?.total_price || 0) - Number(currentOrder?.down_payment || 0)
  const isLunas = currentOrder?.is_paid_off || sisaTagihan <= 0

  const handleFinishCurrentStage = async () => {
    if (!currentOrder || !currentStageConfig || !userHasPermission) return

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
      loadPrintQueue()
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

  const isPrintWorkstationUser = 
    operatorInfo.role === "OPERATOR_PRINT" || 
    operatorInfo.role === "ADMIN" || 
    operatorInfo.role === "OWNER"

  const isAdminOrOwner = operatorInfo.role === "ADMIN" || operatorInfo.role === "OWNER"

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16 pt-1">
      {/* 1. Header Identitas Stasiun Kerja */}
      <div className="border border-zinc-200 bg-white p-3.5 rounded-lg shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-zinc-900 flex items-center gap-1.5 uppercase tracking-tight">
              {operatorInfo.role === "OPERATOR_PRINT" ? (
                <>
                  <Printer className="h-4 w-4 text-zinc-900" /> Stasiun Kerja Cetak Sublimasi (Pos 02)
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 text-zinc-900" /> Pos Scanner SPK Produksi
                </>
              )}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
              {printQueue.length} Siap Cetak
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 mt-1">
            <User className="h-3.5 w-3.5 text-zinc-400" />
            <span>PIC: <strong className="text-zinc-900">{operatorInfo.name}</strong></span>
            <span className="text-zinc-300">&bull;</span>
            <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.2 bg-zinc-100 border border-zinc-200 rounded text-zinc-800">
              {operatorInfo.role}
            </span>
          </div>
        </div>

        {/* Action Controls & Mode Switcher Admin/Owner */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdminOrOwner && (
            <div className="flex items-center bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setWorkstationMode("PRINT_QUEUE")}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  workstationMode === "PRINT_QUEUE" ? "bg-white text-zinc-900 shadow-2xs font-bold" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Meja Print (Pos 02)
              </button>
              <button
                type="button"
                onClick={() => setWorkstationMode("SCANNER")}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  workstationMode === "SCANNER" ? "bg-white text-zinc-900 shadow-2xs font-bold" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Scanner Bebas
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadPrintQueue()}
            disabled={loadingQueue}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-600 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
            title="Refresh Antrean"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? "animate-spin text-zinc-900" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
              isCameraActive 
                ? "bg-red-600 hover:bg-red-700 text-white" 
                : "bg-zinc-900 hover:bg-zinc-800 text-white"
            }`}
          >
            {isCameraActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            <span>{isCameraActive ? "Tutup Kamera" : "Scan QR"}</span>
          </button>
        </div>
      </div>

      {/* Kamera Pemindai (Jika Dinyalakan) */}
      {isCameraActive && (
        <div className="border-2 border-zinc-900 bg-black rounded-lg overflow-hidden p-2 space-y-2">
          <div id="kiosk-qr-reader" className="w-full h-64 bg-zinc-950 flex items-center justify-center text-white text-xs font-mono" />
          <p className="text-[11px] text-zinc-300 text-center font-mono">
            Arahkan kamera ke QR Code di lembar SPK
          </p>
        </div>
      )}

      {/* Alert Pesan Notifikasi */}
      {message && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          message.type === "error"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-emerald-50 text-emerald-800 border-emerald-200"
        }`}>
          {message.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DAFTAR ANTREAN KHUSUS CETAK SUBLIMASI (POS 02)                         */}
      {/* ========================================================================= */}
      {!currentOrder && (operatorInfo.role === "OPERATOR_PRINT" || (isAdminOrOwner && workstationMode === "PRINT_QUEUE")) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Antrean Menunggu Dicetak (Urutan FIFO & Prioritas) ({printQueue.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Urutan #1 wajib didahulukan
            </span>
          </div>

          {loadingQueue && printQueue.length === 0 ? (
            <div className="py-12 bg-white border border-zinc-200 rounded-lg text-center text-zinc-500 font-mono text-xs">
              <RefreshCw className="h-4 w-4 animate-spin inline mr-2 text-zinc-900" />
              Memuat antrean cetak meja kerja...
            </div>
          ) : printQueue.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded-lg p-10 text-center bg-white space-y-1.5">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-zinc-800">Semua Pesanan Cetak Selesai!</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Tidak ada pesanan yang tertahan di Pos 02 (Print Sublim). Pesanan baru dari studio desainer akan muncul otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {printQueue.map((task, index) => {
                const profileName = task.ink_profile || (task.ink_type === "CINA" ? "2 PAS" : "952")
                const isUrgent = task.priority === "URGENT"
                const isHigh = task.priority === "HIGH"

                return (
                  <div
                    key={task.id}
                    className={`border rounded-lg bg-white p-3.5 shadow-2xs space-y-3 transition-all hover:border-zinc-400 ${
                      isUrgent 
                        ? "border-red-300 ring-2 ring-red-400/30" 
                        : isHigh 
                        ? "border-amber-300 ring-1 ring-amber-400/20" 
                        : "border-zinc-200"
                    }`}
                  >
                    {/* Baris Atas: Urutan Antrean, No Order & Prioritas */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* BADGE URUTAN FIFO */}
                        <span className="font-mono font-black text-[10px] bg-blue-700 text-white px-2 py-0.5 rounded shadow-2xs shrink-0">
                          #{index + 1}
                        </span>
                        <span className="font-mono font-black text-xs bg-zinc-900 text-white px-2 py-0.5 rounded shadow-2xs shrink-0">
                          {task.order_number}
                        </span>
                        <strong className="text-xs font-black text-zinc-900 truncate uppercase" title={task.order_title || task.customer_name}>
                          {task.order_title || task.customer_name}
                        </strong>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 font-mono ${
                        isUrgent
                          ? "bg-red-600 text-white animate-pulse"
                          : isHigh
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                      }`}>
                        {isUrgent ? "🔥 URGENT" : isHigh ? "⚡ KILAT" : "REGULER"}
                      </span>
                    </div>

                    {/* Badan Kartu: Thumbnail & Spesifikasi Profil */}
                    <div className="flex gap-3">
                      {/* Thumbnail Mockup */}
                      <div className="w-20 h-28 bg-zinc-50 border border-zinc-200 rounded p-1 shrink-0 flex items-center justify-center overflow-hidden">
                        {task.mockup_url ? (
                          <img src={task.mockup_url} alt="Mockup" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-zinc-400 text-center font-mono">No Mockup</span>
                        )}
                      </div>

                      {/* Spesifikasi Cetak & PROFIL MENCOLOK */}
                      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                        {/* BOX PROFIL WARNA RIP (ANTI SALAH CETAK) */}
                        <div className="bg-amber-50 border border-amber-300 rounded p-1.5 space-y-0.5">
                          <span className="text-[9px] font-bold text-amber-900 uppercase block tracking-wider">
                            Profil Mesin Cetak (RIP):
                          </span>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-amber-950 text-[10.5px]">
                              {task.ink_type === "CINA" ? "Tinta Cina" : "Tinta Ori"}
                            </span>
                            <span className="font-mono text-xs font-black bg-amber-400 text-amber-950 px-2 py-0.5 rounded shadow-2xs">
                              {profileName}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-600 space-y-0.5">
                          <div className="truncate">
                            Kain: <strong className="text-zinc-900">{task.fabric_type}</strong>
                          </div>
                          <div>
                            Jumlah: <strong className="font-mono text-zinc-950">{task.total_qty} pcs</strong>
                            <span className="mx-1 text-zinc-300">&bull;</span>
                            <span className="text-red-700 font-bold font-mono text-[10px]">
                              Deadline: {formatDateID(task.deadline_date)}
                            </span>
                          </div>
                        </div>

                        {/* Model Item Badges */}
                        {Array.isArray(task.size_breakdown?.active_models) && task.size_breakdown.active_models.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {task.size_breakdown.active_models.map((m: string) => (
                              <span key={m} className="px-1.5 py-0.2 bg-zinc-100 text-zinc-800 text-[8.5px] font-mono font-bold rounded border border-zinc-200">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Akses Cepat Link Aset Desain / Folder Komputer */}
                    <div className="pt-1 border-t border-zinc-100">
                      {task.link_drive_aset ? (
                        <div className="flex items-center gap-1.5">
                          {task.link_drive_aset.startsWith("http") ? (
                            <a
                              href={task.link_drive_aset}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition-colors truncate max-w-full"
                              title="Buka Link Google Drive / Cloud"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">Buka File Aset Desain</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(task.link_drive_aset!)
                                alert(`Path folder lokal disalin:\n${task.link_drive_aset}\n\nSilakan paste di Windows Explorer atau Software RIP!`)
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded hover:bg-purple-100 transition-colors truncate max-w-full cursor-pointer"
                              title="Klik untuk Salin Path Folder Lokal / Server"
                            >
                              <FolderOpen className="h-3 w-3 shrink-0" />
                              <span className="truncate">Salin Path: {task.link_drive_aset}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic block">Link aset belum dicantumkan</span>
                      )}
                    </div>

                    {/* Tombol Aksi Bawah: Selesai 1-Klik Langsung di Meja Cetak */}
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleLookup(task.order_number)}
                        className="px-2.5 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Buka Lembar Kerja Penuh"
                      >
                        <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Buka SPK</span>
                      </button>

                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => handleQuickFinishPrint(task)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Selesai Cetak ➔ Ke Pos 03</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Panel Pencarian / Pemindai Manual */}
      {!currentOrder && (showManualScanner || !isPrintWorkstationUser || workstationMode === "SCANNER") && (
        <div className="border border-zinc-200 bg-white rounded-lg shadow-2xs p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wide">
              <QrCode className="h-3.5 w-3.5 text-zinc-500" />
              Cari / Scan No. Order Manual
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLookup()
            }}
            className="flex gap-2 pt-1"
          >
            <input
              type="text"
              placeholder="Ketik / tempel No. Order (cth: MN-26...)"
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-zinc-300 rounded text-xs font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-zinc-50/50"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Mencari..." : "Buka SPK"}
            </button>
          </form>
        </div>
      )}

      {/* 4. Layar Sukses Serah Terima */}
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
              className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded text-xs transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Kembali ke Antrean Meja Cetak</span>
            </button>
          </div>
        </div>
      ) : currentOrder ? (
        /* 5. Tampilan Detail Lembar Kerja SPK Penuh */
        <div className="space-y-3">
          {/* TOMBOL KEMBALI BESAR & MENCOLOK KE DAFTAR ANTREAN */}
          <button
            type="button"
            onClick={() => {
              setCurrentOrder(null)
              setAuditLogs([])
              setMessage(null)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Antrean Siap Cetak ({printQueue.length})</span>
          </button>

          <div className="border border-zinc-200 bg-white rounded-lg shadow-2xs overflow-hidden">
            <div className="bg-zinc-900 text-white p-3 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider block">
                  LEMBAR KERJA PRODUKSI
                </span>
                <strong className="text-sm font-mono tracking-wide">{currentOrder.order_number}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-tight shadow-xs ${
                  currentOrder.priority === "URGENT"
                    ? "bg-red-600 text-white animate-pulse"
                    : currentOrder.priority === "HIGH"
                    ? "bg-amber-500 text-white"
                    : "bg-white/20 text-white"
                }`}>
                  {currentOrder.priority === "URGENT" ? "🔥 SUPER URGENT" : currentOrder.priority === "HIGH" ? "⚡ EXPRESS" : "REGULER"}
                </span>
              </div>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Nama Order */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5 space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-wider">Nama Order</span>
                <strong className="text-xs font-black uppercase text-zinc-950 block">
                  {currentOrder.order_title || "-"}
                </strong>
                <span className="text-[11px] text-zinc-600 block">
                  Pemesan: <strong>{currentOrder.customer_name}</strong>
                </span>
              </div>

              {/* Banner Profil Tinta Jika Pos 02 */}
              {currentOrder.current_status === "PRINTING" && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-950 uppercase tracking-tight flex items-center gap-1.5 text-[11px]">
                      🖨️ Instruksi Cetak Komputer RIP (Pos 02)
                    </span>
                    <span className="font-mono text-xs font-black bg-amber-400 text-amber-950 px-2 py-0.5 rounded shadow-2xs">
                      {currentOrder.ink_type === "CINA" ? "TINTA CINA" : "TINTA ORI"} &bull; {currentOrder.ink_profile || (currentOrder.ink_type === "CINA" ? "2 PAS" : "952")}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-snug">
                    Cocokkan file di software RIP dengan bahan kain <strong className="font-bold">{currentOrder.fabric_type}</strong> sebelum memproses cetak.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 text-xs border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Target Deadline</span>
                  <strong className="text-red-700 font-mono text-xs">{formatDateID(currentOrder.deadline_date)}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Total Pesanan</span>
                  <strong className="font-mono text-zinc-900 font-bold text-xs">{currentOrder.total_qty} PCS</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Bahan Kain</span>
                  <strong className="text-zinc-900 text-xs block truncate">{currentOrder.fabric_type}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Model Kerah</span>
                  <strong className="text-zinc-900 text-xs block truncate">{currentOrder.collar_type || "-"}</strong>
                </div>

                {/* Model Item Produksi */}
                {Array.isArray(currentOrder.size_breakdown?.active_models) && currentOrder.size_breakdown.active_models.length > 0 && (
                  <div className="col-span-2 pt-1 border-t border-zinc-100/70">
                    <span className="text-zinc-500 block text-[10px] mb-1 font-medium">Model Item Produksi:</span>
                    <div className="flex flex-wrap gap-1">
                      {currentOrder.size_breakdown.active_models.map((m: string) => (
                        <span key={m} className="px-2 py-0.5 bg-zinc-900 text-white text-[10px] font-semibold rounded shadow-2xs font-mono">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Posisi Pengerjaan */}
              <div className="border border-emerald-300 rounded p-2.5 bg-emerald-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-emerald-800 block">Posisi Pengerjaan Saat Ini</span>
                  <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    Pos Aktif Sekarang
                  </span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="font-mono font-black text-sm text-zinc-950">
                    {currentStageConfig?.label || currentOrder.current_status}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-sans">
                    Target berikutnya: <strong className="text-zinc-900">{currentStageConfig?.nextLabel || "Selesai"}</strong>
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
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {updating
                        ? "Menyimpan & Menyerahkan..."
                        : isStage8
                        ? "Konfirmasi Penyerahan Barang & Arsip"
                        : `Selesaikan Tugas ${currentStageConfig?.label || ""} & Teruskan ➔`}
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

          {/* Timeline Riwayat Audit Trail */}
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
                            <span className="bg-blue-600 text-white font-mono text-[8.5px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                              Aktivitas Terakhir
                            </span>
                          )}
                          <strong className="text-zinc-900 font-bold">{picName}</strong>
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
