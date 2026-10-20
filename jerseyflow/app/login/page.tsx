"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Lock, Mail, ArrowRight } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Branding Dinamis dari Pengaturan Sistem
  const [brandName, setBrandName] = useState("Manayra")
  const [brandTagline, setBrandTagline] = useState("Workshop OS")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadBrandSettings() {
      try {
        const { data } = await supabase.from("system_settings").select("key, value")
        if (data) {
          data.forEach((s) => {
            if (s.key === "brand_name" && s.value) setBrandName(s.value)
            if (s.key === "brand_tagline" && s.value) setBrandTagline(s.value)
            if (s.key === "brand_logo_url" && s.value) setLogoUrl(s.value)
          })
        }
      } catch (err) {
        // Fallback default jika koneksi awal tertunda
      }
    }

    loadBrandSettings()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMessage(error.message || "Email atau password salah.")
        setLoading(false)
        return
      }

      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single()

        const userRole = (profile?.role || "ADMIN").toUpperCase()
        const isDesigner =
          userRole.includes("DESIGN") ||
          userRole === "OPERATOR_DESIGN" ||
          userRole === "DESIGNER"
        const isOperator =
          (userRole.includes("OPERATOR") && !isDesigner) ||
          userRole === "SEWING_SUPERVISOR" ||
          userRole === "QC"

        if (isDesigner) {
          router.replace("/orders/studio")
        } else if (isOperator) {
          router.replace("/kiosk")
        } else {
          router.replace("/")
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat masuk.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-8 select-none">
      <div className="w-full max-w-sm border border-zinc-200/90 bg-white rounded-lg shadow-sm p-6 sm:p-7 space-y-6">
        {/* LOGO DINAMIS BERBENTUK BULAT & IDENTITAS WORKSHOP */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-zinc-900/10 shadow-sm bg-white p-0.5 flex items-center justify-center shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="h-full w-full rounded-full bg-zinc-900 flex items-center justify-center text-white font-black text-sm tracking-wider">
                MNR
              </div>
            )}
          </div>

          <div>
            <h1 className="text-base font-black tracking-tight text-zinc-900 uppercase">
              {brandName}
            </h1>
            <p className="text-xs text-zinc-500 font-medium tracking-tight">
              {brandTagline}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Email Pengguna
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                placeholder="nama@manayra.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none placeholder:text-zinc-400 text-zinc-900"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-700">
              Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none placeholder:text-zinc-400 text-zinc-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold py-2 transition-colors disabled:opacity-50 shadow-2xs"
          >
            {loading ? (
              <span>Memverifikasi Akun...</span>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-100 text-center">
          <span className="text-[10px] text-zinc-400 font-mono">
            Sistem Produksi Jersey Printing & Konveksi
          </span>
        </div>
      </div>
    </div>
  )
}
