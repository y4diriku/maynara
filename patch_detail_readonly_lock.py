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

detail_file = get_target_file(os.path.join("app", "orders", "[id]", "page.tsx"))
if not detail_file:
    print("[ERROR] File app/orders/[id]/page.tsx tidak ditemukan!")
    sys.exit(1)

with open(detail_file, "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("\r\n", "\n")

# 1. Tambah import Lock jika belum ada
if "Lock" not in code:
    code = code.replace(
        "Clock\n} from \"lucide-react\"",
        "Clock,\n  Lock\n} from \"lucide-react\""
    )
    print("[1/5] Import icon Lock berhasil ditambahkan.")

# 2. Definisikan variabel isArchived
if "const isArchived =" not in code:
    code = code.replace(
        'const activeStageIndex = useMemo(() => {',
        'const isArchived = currentStatus === "COMPLETED"\n\n  const activeStageIndex = useMemo(() => {'
    )
    print("[2/5] Deteksi status isArchived berhasil disisipkan.")

# 3. Tambahkan Banner Hijau "Arsip Terkunci (Read-Only)" di bawah notifikasi msg
banner_markup = '''      {/* BANNER PESANAN TERKUNCI DALAM ARSIP (READ-ONLY) */}
      {isArchived && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <strong className="block font-bold">Pesanan Telah Selesai & Terkunci dalam Arsip (Read-Only)</strong>
              <span className="text-[11px] text-emerald-800">Seluruh spesifikasi, matriks ukuran, dan data keuangan dikunci permanen demi menjaga integritas pembukuan workshop.</span>
            </div>
          </div>
          <span className="font-mono text-[9px] font-bold bg-white text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded uppercase shrink-0 shadow-2xs">
            ARSIP TERKUNCI
          </span>
        </div>
      )}'''

if "{isArchived && (" not in code:
    old_msg_end = '        </div>\n      )}'
    pos_msg = code.find(old_msg_end)
    if pos_msg != -1:
        code = code[:pos_msg + len(old_msg_end)] + "\n\n" + banner_markup + code[pos_msg + len(old_msg_end):]
        print("[3/5] Banner notifikasi Arsip Terkunci berhasil dipasang.")

# 4. Kunci seluruh isi form menggunakan <fieldset disabled={isArchived}>
if "<fieldset disabled={isArchived}" not in code:
    code = code.replace(
        '<form onSubmit={handleSave} className="space-y-4">',
        '<form onSubmit={handleSave} className="space-y-4">\n        <fieldset disabled={isArchived} className="space-y-4 border-0 p-0 m-0 disabled:opacity-90 contents">'
    )
    print("[4/5] Fieldset pengunci form input berhasil dipasang.")

# 5. Sesuaikan tombol aksi di bagian bawah
old_bottom_btns = '''        {/* Tombol Simpan */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/orders"
            className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            Kembali
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Menyimpan Perubahan..." : "Simpan Pembaruan Data"}
          </button>
        </div>'''

new_bottom_btns = '''        </fieldset>

        {/* Tombol Aksi / Simpan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-200">
          {isArchived ? (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Mode Arsip: Dokumen terkunci untuk audit & hanya dapat dicetak ulang.</span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              href="/orders"
              className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
            >
              {isArchived ? "Kembali ke Daftar Pesanan" : "Kembali"}
            </Link>

            {!isArchived && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Menyimpan Perubahan..." : "Simpan Pembaruan Data"}
              </button>
            )}
          </div>
        </div>'''

if old_bottom_btns in code:
    code = code.replace(old_bottom_btns, new_bottom_btns)
    print("[5/5] Tombol simpan dinonaktifkan untuk pesanan arsip.")

with open(detail_file, "w", encoding="utf-8") as f:
    f.write(code)

print("\n[SELESAI] Mode Read-Only (Penguncian Otomatis Arsip) berhasil diaktifkan 100%!")