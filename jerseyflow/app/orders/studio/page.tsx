"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { 
  RefreshCw, 
  Printer, 
  CheckCircle2, 
  Palette, 
  FileText,
  Sparkles,
  ExternalLink
} from "lucide-react"

interface DesignTask {
  id: string
  order_number: string
  order_title?: string | null
  customer_name: string
  total_qty: number
  fabric_type: string
  collar_type: string
  deadline_date: string
  created_at: string
  link_drive_aset?: string | null
  catatan_desain?: string | null
  mockup_url?: string | null
  mockup_url_2?: string | null
  mockup_url_3?: string | null
  size_breakdown?: any
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

export default function DesignerStudioPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<DesignTask[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [designerInfo, setDesignerInfo] = useState<{ name: string; role: string; id: string | null }>({
    name: "Desainer",
    role: "OPERATOR_DESIGN",
    id: null
  })

  const loadDesignerTasks = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single()

      if (profile) {
        setDesignerInfo({
          name: profile.full_name || session.user.email?.split("@")[0] || "Desainer",
          role: (profile.role || "OPERATOR_DESIGN").toUpperCase(),
          id: session.user.id
        })
      }

      const role = (profile?.role || "").toUpperCase()
      const isDesigner = role.includes("DESIGN")
      const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN"

      if (!isDesigner && !isOwnerOrAdmin) {
        router.replace("/")
        return
      }

      let query = supabase
        .from("orders")
        .select("id, order_number, order_title, customer_name, total_qty, fabric_type, collar_type, deadline_date, created_at, link_drive_aset, catatan_desain, mockup_url, mockup_url_2, mockup_url_3, size_breakdown")
        .eq("current_status", "DESIGN_QUEUE")

      if (!isOwnerOrAdmin) {
        query = query.eq("assigned_designer_id", session.user.id)
      }

      const { data, error } = await query.order("deadline_date", { ascending: true })

      if (!error && data) {
        setTasks(data)
      }
    } catch (err) {
      console.error("Gagal memuat tugas desain:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDesignerTasks()

    const channel = supabase
      .channel("designer_studio_realtime_v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadDesignerTasks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Selesai Desain -> Maju ke Pos 02 (PRINTING)
  const handleFinishDesign = async (task: DesignTask) => {
    if (!task.mockup_url) {
      const confirmNoMockup = window.confirm(
        "Peringatan: Anda belum mengunggah gambar Mockup Desain (Gambar 1). Apakah Anda yakin ingin meneruskan pesanan ini ke pos Print Sublim tanpa mockup?"
      )
      if (!confirmNoMockup) return
    }

    const confirmSend = window.confirm(
      `Selesaikan desain untuk "${task.order_number} - ${task.order_title || task.customer_name}" dan teruskan ke Pos 02 (Print Sublim)?`
    )
    if (!confirmSend) return

    setProcessingId(task.id)

    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          current_status: "PRINTING",
          updated_at: new Date().toISOString()
        })
        .eq("id", task.id)

      if (updateErr) throw updateErr

      await supabase.from("production_logs").insert({
        order_id: task.id,
        stage: "PRINTING",
        notes: `Layout desain & mockup telah di-ACC oleh ${designerInfo.name}. SPK diteruskan ke Pos 02 (Print Sublim).`,
        operator_name: designerInfo.name,
        operator_role: designerInfo.role,
        operator_id: designerInfo.id
      })

      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      alert("Berhasil! Tugas desain selesai dan diteruskan ke mesin Print Sublim.")
    } catch (err: any) {
      alert("Gagal memperbarui status: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Studio Desain & Setting</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Tugas Aktif ({tasks.length})
            </span>
          </div>
          <p className="text-xs text-zinc-600">Daftar antrean desain Anda. Klik tombol "Buka Detail Lengkap" untuk mengunggah mockup & melihat rincian.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadDesignerTasks(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-zinc-200 rounded text-xs text-zinc-600 hover:bg-zinc-50 transition-colors shadow-2xs"
            title="Muat Ulang Tugas"
          >
            <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin text-zinc-900" : "h-3.5 w-3.5"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Daftar Kartu Tugas Desain */}
      <div className="space-y-3">
        {loading && tasks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-mono text-xs">
            <RefreshCw className="h-4 w-4 animate-spin inline mr-2 text-zinc-900" />
            Memuat daftar tugas desain...
          </div>
        ) : tasks.length === 0 ? (
          <div className="border border-dashed border-zinc-300 rounded-lg p-12 text-center bg-white space-y-2">
            <Palette className="h-8 w-8 text-zinc-300 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-800">Tidak Ada Tugas Desain Saat Ini</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Belum ada pesanan baru di Pos Antrean Desain yang ditugaskan kepada Anda. Silakan hubungi Admin jika ada order masuk.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tasks.map((task) => {
              const isProcessing = processingId === task.id
              const hasMockup = Boolean(task.mockup_url)

              return (
                <div key={task.id} className="border border-zinc-200 bg-white rounded-lg p-4 shadow-2xs space-y-3 hover:border-zinc-400 transition-colors">
                  {/* Baris Atas */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-black text-sm text-zinc-950 bg-zinc-100 px-2.5 py-1 rounded border border-zinc-200 shrink-0">
                        {task.order_number}
                      </span>
                      <div className="min-w-0">
                        <strong className="text-xs font-black uppercase text-zinc-900 block leading-tight truncate">
                          {task.order_title || task.customer_name}
                        </strong>
                        <span className="text-[10px] text-zinc-500 font-medium truncate block">
                          Pemesan: {task.customer_name} &bull; <strong className="text-zinc-900 font-mono">{task.total_qty} pcs</strong> ({task.fabric_type})
                        </span>
                        {Array.isArray(task.size_breakdown?.active_models) && task.size_breakdown.active_models.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {task.size_breakdown.active_models.map((m: string) => (
                              <span key={m} className="px-1.5 py-0.2 bg-zinc-100 text-zinc-800 text-[9px] font-mono font-semibold rounded border border-zinc-200">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-bold text-xs">
                        Deadline: {formatDateID(task.deadline_date)}
                      </span>
                    </div>
                  </div>

                  {/* Ringkasan Singkat Link & Brief */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-50 border border-zinc-200/80 rounded p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">Link Aset / Google Drive</span>
                      {task.link_drive_aset ? (
                        <a
                          href={task.link_drive_aset}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-700 font-bold hover:underline truncate max-w-full text-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{task.link_drive_aset}</span>
                        </a>
                      ) : (
                        <span className="text-amber-700 font-medium block text-xs">⚠️ Link Aset belum disertakan oleh CS</span>
                      )}
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200/80 rounded p-2.5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">Catatan Brief Desain</span>
                      <p className="text-zinc-800 text-xs leading-snug font-sans truncate" title={task.catatan_desain || "-"}>
                        {task.catatan_desain || "Tidak ada catatan khusus dari pemesan."}
                      </p>
                    </div>
                  </div>

                  {/* Toolbar Aksi Bawah: Buka Detail Penuh & Cetak SPK */}
                  <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {hasMockup ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mockup Terunggah (Siap Cetak SPK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                          <Sparkles className="h-3.5 w-3.5" /> Belum Upload Mockup (Buka Detail untuk Upload)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Link
                        href={`/orders/${task.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded transition-colors shadow-2xs"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Buka Detail Lengkap & Upload Mockup</span>
                      </Link>

                      <Link
                        href={`/orders/${task.id}/spk`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-800 text-xs font-semibold transition-colors shadow-2xs"
                        title="Cetak SPK Fisik Pertama"
                      >
                        <Printer className="h-3.5 w-3.5 text-zinc-600" />
                        <span>Cetak SPK</span>
                      </Link>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleFinishDesign(task)}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{isProcessing ? "Memproses..." : "Selesai Desain & Teruskan ➔"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
