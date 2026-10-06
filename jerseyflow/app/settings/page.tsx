"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { compressImage } from "@/lib/imageCompressor"
import { 
  Settings, 
  UploadCloud, 
  Save, 
  Users2, 
  Sliders, 
  MessageSquare,
  CheckCircle2,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const [brandName, setBrandName] = useState("Manayra")
  const [brandTagline, setBrandTagline] = useState("Workshop OS")
  const [logoUrl, setLogoUrl] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    async function verifyAndLoad() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()

      if ((profile?.role || "").toUpperCase() !== "OWNER") {
        router.replace("/")
        return
      }

      setAuthorized(true)

      // Muat pengaturan dari database
      const { data: settingsData } = await supabase.from("system_settings").select("*")
      if (settingsData) {
        settingsData.forEach((item) => {
          if (item.key === "brand_name") setBrandName(item.value)
          if (item.key === "brand_tagline") setBrandTagline(item.value)
          if (item.key === "brand_logo_url") setLogoUrl(item.value)
        })
      }

      setLoading(false)
    }

    verifyAndLoad()
  }, [router])

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setMsg("")

    try {
      // Kompres logo agar ringan (maksimal 400px persegi)
      const compressedBlob = await compressImage(file, 400, 0.85)
      const fileName = `brand-logo-${Date.now()}.webp`

      const { error: uploadError } = await supabase.storage
        .from("order-mockups")
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from("order-mockups")
        .getPublicUrl(fileName)

      const freshUrl = publicUrlData.publicUrl
      setLogoUrl(freshUrl)

      await supabase.from("system_settings").upsert({
        key: "brand_logo_url",
        value: freshUrl,
        updated_at: new Date().toISOString()
      })

      setMsg("Logo berhasil diperbarui!")
    } catch (err: any) {
      setMsg("Gagal unggah logo: " + err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg("")

    try {
      await supabase.from("system_settings").upsert([
        { key: "brand_name", value: brandName, updated_at: new Date().toISOString() },
        { key: "brand_tagline", value: brandTagline, updated_at: new Date().toISOString() },
      ])

      setMsg("Pengaturan berhasil disimpan! Muat ulang halaman untuk melihat perubahan.")
    } catch (err: any) {
      setMsg("Error: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !authorized) {
    return (
      <div className="flex h-[60vh] items-center justify-center font-mono text-xs text-zinc-500">
        Memverifikasi wewenang pengaturan...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-zinc-900 leading-tight">Pengaturan Workshop</h1>
            <p className="text-xs text-zinc-600">Kelola identitas merek, logo, dan preferensi sistem operasional.</p>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          msg.includes("berhasil") 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <CheckCircle2 className="h-4 w-4" />
          <span>{msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Navigasi Sub-Menu */}
        <div className="border border-zinc-200 bg-white rounded p-2 space-y-1 h-fit shadow-2xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-900 text-white text-xs font-semibold">
            <Sliders className="h-3.5 w-3.5" />
            <span>Identitas & Tampilan</span>
          </div>
          <Link
            href="/settings/users"
            className="flex items-center gap-2 px-3 py-2 rounded text-zinc-700 hover:bg-zinc-100 text-xs font-medium transition-colors"
          >
            <Users2 className="h-3.5 w-3.5 text-zinc-500" />
            <span>Manajemen Staf & Akses</span>
          </Link>
          <div className="flex items-center justify-between px-3 py-2 rounded text-zinc-400 text-xs font-medium cursor-not-allowed">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
              <span>WhatsApp Gateway</span>
            </div>
            <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.2 rounded border">Segera</span>
          </div>
        </div>

        {/* Panel Form Identitas */}
        <div className="md:col-span-2 border border-zinc-200 bg-white rounded p-4 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-tight">
            Identitas Visual Workshop
          </h2>

          {/* Upload Logo */}
          <div className="p-3 border border-zinc-200 rounded bg-zinc-50/50 space-y-3">
            <label className="block text-xs font-semibold text-zinc-800">
              Logo Workshop (Sidebar & Kop)
            </label>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded border border-zinc-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Brand" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="font-extrabold font-mono text-zinc-700 text-xs">MNR</span>
                )}
              </div>
              <div className="space-y-1 text-xs">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded font-medium shadow-2xs transition-colors">
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>{uploadingLogo ? "Mengunggah..." : "Ganti File Logo"}</span>
                  <input type="file" accept="image/*" onChange={handleUploadLogo} disabled={uploadingLogo} className="hidden" />
                </label>
                <p className="text-[11px] text-zinc-500">
                  Format PNG, JPG, atau WebP. Otomatis terkompresi tanpa membebani penyimpanan.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Nama Brand / Workshop</label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-semibold mb-1">Subteks / Slogan Singkat</label>
              <input
                type="text"
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-4 py-2 rounded shadow-2xs transition-colors disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
