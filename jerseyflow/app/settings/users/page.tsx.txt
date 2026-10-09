"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Users2, UserPlus, ArrowLeft, ShieldAlert, KeyRound, UserX, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface ProfileItem {
  id: string
  full_name: string
  role: string
  created_at: string
}

const ROLE_LABELS: { [key: string]: string } = {
  OWNER: "Owner",
  ADMIN: "Admin Workshop",
  OPERATOR_DESIGN: "Operator Desain & Setting",
  DESIGNER: "Operator Desain & Setting",
  OPERATOR_PRINT: "Operator Print",
  OPERATOR_PRESS: "Operator Press",
  OPERATOR_CUTTING: "Operator Cutting",
  OPERATOR_SEWING: "Operator Jahit",
  SEWING_SUPERVISOR: "Supervisor Jahit",
  QC: "Quality Control",
  OPERATOR_PACKING: "Operator Finishing & Packing",
  OPERATOR: "Operator Produksi"
}

export default function UserManagementPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState("")

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("ADMIN")

  // Modal Reset Password State
  const [resetModalUser, setResetModalUser] = useState<ProfileItem | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetting, setResetting] = useState(false)

  const loadProfiles = async () => {
    setLoading(true)
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
    if (data) setProfiles(data)
    setLoading(false)
  }

  useEffect(() => {
    async function verifyAndLoad() {
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
      loadProfiles()
    }

    verifyAndLoad()
  }, [router])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg("")

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role })
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || "Gagal membuat akun")

      setMsg("Akun staf berhasil dibuat!")
      setFullName("")
      setEmail("")
      setPassword("")
      loadProfiles()
    } catch (err: any) {
      setMsg("Error: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetModalUser || !newPassword) return
    setResetting(true)
    setMsg("")

    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetModalUser.id, newPassword })
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || "Gagal reset kata sandi")

      setMsg(`Kata sandi untuk ${resetModalUser.full_name} berhasil diubah!`)
      setResetModalUser(null)
      setNewPassword("")
    } catch (err: any) {
      setMsg("Error: " + err.message)
    } finally {
      setResetting(false)
    }
  }

  const handleDeleteUser = async (user: ProfileItem) => {
    const confirmDelete = window.confirm(
      `Yakin ingin mencabut akses staf: "${user.full_name}"? Akun ini tidak akan bisa login lagi.`
    )
    if (!confirmDelete) return

    setMsg("")
    try {
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || "Gagal menghapus user")

      setMsg(`Akses staf ${user.full_name} berhasil dicabut.`)
      loadProfiles()
    } catch (err: any) {
      setMsg("Error: " + err.message)
    }
  }

  if (loading || !authorized) {
    return (
      <div className="flex h-[60vh] items-center justify-center font-mono text-xs text-zinc-500">
        Memverifikasi wewenang kelola staf...
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
        <Link href="/settings" className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-zinc-900 leading-tight">Manajemen Staf & Akses Sistem</h1>
          <p className="text-xs text-zinc-600">Daftarkan akun staf baru, atur ulang kata sandi, atau cabut akses operator.</p>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          msg.includes("berhasil") ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg.includes("berhasil") ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          <span>{msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Form Pendaftaran Akun Staf */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3 h-fit">
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-zinc-500" /> Daftarkan Akun Staf
          </span>

          <form onSubmit={handleCreateUser} className="space-y-2.5 text-xs">
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                placeholder="Misal: Dedi Tukang Jahit"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Email Login</label>
              <input
                type="email"
                required
                placeholder="dedi@manayra.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Kata Sandi Awal</label>
              <input
                type="password"
                required
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-600 font-medium mb-1">Peran / Hak Akses</label>
                                          <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white font-medium text-zinc-800"
              >
                <optgroup label="Manajemen & Kantor">
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin Workshop</option>
                </optgroup>
                <optgroup label="Pos 1: Desain & Setting">
                  <option value="OPERATOR_DESIGN">Operator Desain & Setting</option>
                </optgroup>
                <optgroup label="Pos 2: Cetak & Sublimasi">
                  <option value="OPERATOR_PRINT">Operator Print</option>
                  <option value="OPERATOR_PRESS">Operator Press</option>
                </optgroup>
                <optgroup label="Pos 3: Potong Kain">
                  <option value="OPERATOR_CUTTING">Operator Cutting</option>
                </optgroup>
                <optgroup label="Pos 4: Lini Jahit">
                  <option value="OPERATOR_SEWING">Operator Jahit</option>
                  <option value="SEWING_SUPERVISOR">Supervisor Jahit</option>
                </optgroup>
                <optgroup label="Pos 5: QC & Finishing">
                  <option value="QC">Quality Control</option>
                  <option value="OPERATOR_PACKING">Operator Finishing & Packing</option>
                </optgroup>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs mt-2"
            >
              {submitting ? "Memproses..." : "Daftarkan Staf"}
            </button>
          </form>
        </div>

        {/* Tabel Daftar Staf & Aksi Akun */}
        <div className="md:col-span-2 border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <Users2 className="h-3.5 w-3.5 text-zinc-500" /> Daftar Pengguna Terdaftar ({profiles.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Nama Staf</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Tgl Daftar</th>
                  <th className="py-2.5 px-3 text-center">Kelola Akun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/60">
                    <td className="py-2.5 px-3 font-semibold text-zinc-900">{p.full_name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        p.role === "OWNER" ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-zinc-100 text-zinc-800 border-zinc-300"
                      }`}>
                        {ROLE_LABELS[p.role] || p.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">
                      {new Date(p.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.role !== "OWNER" ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setResetModalUser(p)}
                            className="p-1 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-100 rounded"
                            title="Reset Kata Sandi"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(p)}
                            className="p-1 text-zinc-400 hover:text-red-600 border border-zinc-200 hover:bg-red-50 rounded"
                            title="Cabut Akses Akun"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-mono">Utama</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Reset Password */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-300 rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-900">
              Reset Sandi: {resetModalUser.full_name}
            </h3>
            <p className="text-xs text-zinc-600">Masukkan kata sandi baru untuk akun staf ini.</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Kata sandi baru (min. 6 karakter)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded shadow-2xs disabled:opacity-50"
                >
                  {resetting ? "Menyimpan..." : "Perbarui Kata Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
