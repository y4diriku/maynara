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

# 1. Pastikan tag <fieldset disabled={isArchived}> hanya terbuka tepat 1 kali
form_open = '<form onSubmit={handleSave} className="space-y-4">'
fieldset_open = '<fieldset disabled={isArchived} className="space-y-4 border-0 p-0 m-0 disabled:opacity-90 contents">'

if form_open in code and fieldset_open not in code:
    code = code.replace(form_open, form_open + "\n        " + fieldset_open, 1)
    print("[1/2] Tag pembuka fieldset dipastikan terpasang.")

# 2. Cari posisi akhir formulir </form> dan tutup tag </fieldset> sebelum tombol bawah
pos_form_close = code.rfind("</form>")

if pos_form_close != -1:
    # Cari posisi blok tombol simpan sebelum tag </form>
    pos_btn_div = code.rfind("<div className=\"flex justify-end gap-3 pt-2\">", 0, pos_form_close)
    if pos_btn_div == -1:
        # Fallback jika comment berbeda
        pos_btn_div = code.rfind("<div className=\"flex", 0, pos_form_close)

    # Cari apakah ada comment Tombol Simpan sebelumnya
    pos_comment = code.rfind("{/* Tombol Simpan */}", 0, pos_btn_div)
    start_replace = pos_comment if pos_comment != -1 else pos_btn_div

    new_footer_markup = '''        </fieldset>

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
        </div>
'''

    if start_replace != -1:
        code = code[:start_replace] + new_footer_markup + code[pos_form_close:]
        print("[2/2] Tag penutup </fieldset> dan tombol terkunci berhasil disempurnakan!")

with open(detail_file, "w", encoding="utf-8") as f:
    f.write(code)

print("\n[SELESAI] Struktur kurung JSX kembali seimbang 100%!")