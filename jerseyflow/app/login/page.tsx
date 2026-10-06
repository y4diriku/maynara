"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    if (data?.user) {
      // Ambil role profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      if (profile?.role === "OPERATOR_PRINT" || profile?.role === "SEWING_SUPERVISOR") {
        router.push("/kiosk")
      } else {
        router.push("/")
      }
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded p-6 shadow-sm space-y-4">
        <div className="text-center space-y-1">
          <div className="h-9 w-9 bg-zinc-900 text-white font-bold rounded flex items-center justify-center mx-auto text-sm">
            JF
          </div>
          <h1 className="text-base font-bold text-zinc-900">Masuk ke Manayra</h1>
          <p className="text-xs text-zinc-600">Sistem Kendali Operasional Konveksi</p>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-700 font-medium mb-1">Email Pengguna</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="nama@workshop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
              <Mail className="h-3.5 w-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">Kata Sandi</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
              <Lock className="h-3.5 w-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span>{loading ? "Memverifikasi..." : "Masuk Sistem"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-100 text-center">
          <span className="text-[11px] text-zinc-600 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Akses Khusus Tim Internal
          </span>
        </div>
      </div>
    </div>
  )
}
