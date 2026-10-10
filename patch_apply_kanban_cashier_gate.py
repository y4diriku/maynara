import os
import sys

def get_target_file(rel_path):
    candidates = [
        os.path.join("jerseyflow", rel_path),
        rel_path
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

kanban_file = get_target_file(os.path.join("app", "page.tsx"))
if not kanban_file:
    print("[ERROR] File app/page.tsx tidak ditemukan!")
    sys.exit(1)

with open(kanban_file, "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("\r\n", "\n")

# 1. Pastikan icon Lock diimpor dari lucide-react
if "Lock" not in code:
    idx_lucide = code.find('from "lucide-react"')
    if idx_lucide != -1:
        brace_pos = code.rfind("}", 0, idx_lucide)
        code = code[:brace_pos] + "  Lock,\n" + code[brace_pos:]
        print("[1/3] Icon Lock ditambahkan ke import.")

# 2. Pastikan state userRole & fetch role ada
if "const [userRole, setUserRole]" not in code:
    pos_state = code.find("const [isSubmitting, setIsSubmitting]")
    if pos_state != -1:
        line_end = code.find("\n", pos_state)
        code = code[:line_end + 1] + '  const [userRole, setUserRole] = useState<string>("")\n' + code[line_end + 1:]
        print("[2/3] State userRole berhasil ditambahkan.")

if "fetchUserRole" not in code:
    old_effect = "useEffect(() => {\n    fetchOrders()"
    new_effect = """useEffect(() => {
    async function fetchUserRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()
        if (prof?.role) setUserRole(prof.role.toUpperCase())
      }
    }
    fetchUserRole()
    fetchOrders()"""
    if old_effect in code:
        code = code.replace(old_effect, new_effect, 1)

# 3. Ganti tombol Pos 08 dengan proteksi Role Kasir
pos_stage = code.find("isLastStage ?")
if pos_stage != -1:
    pos_open = code.find("(", pos_stage)
    pos_close = code.find(") : (", pos_open)

    new_btn_markup = """(userRole === "OWNER" || userRole === "ACCOUNTING") ? (
                            <button
                              type="button"
                              onClick={() => setArchiveModalOrder(order)}
                              className="flex-1 h-5 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition-colors shadow-2xs"
                              title="Selesaikan & serahkan pesanan"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                              <span>Selesai</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="flex-1 h-5 flex items-center justify-center gap-1 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded text-[8.5px] font-bold cursor-not-allowed"
                              title="Hanya Admin Keuangan / Owner yang dapat mengonfirmasi penyerahan barang"
                            >
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                              <span>Kasir</span>
                            </button>
                          """

    if pos_open != -1 and pos_close != -1:
        code = code[:pos_open + 1] + "\n                            " + new_btn_markup + code[pos_close:]
        print("[3/3] Proteksi Gerbang Kasir di Pos 08 berhasil dipasang!")

with open(kanban_file, "w", encoding="utf-8") as f:
    f.write(code)

print("\n[SELESAI] Papan Kanban kini 100% terlindungi oleh Gerbang Kasir!")