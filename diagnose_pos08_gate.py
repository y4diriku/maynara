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
kiosk_file = get_target_file(os.path.join("app", "kiosk", "page.tsx"))

print("=" * 65)
print("HASIL DIAGNOSA FITUR GERBANG KASIR POS 08 (JERSEYFLOW)")
print("=" * 65)

# 1. CEK PAPAN KANBAN (app/page.tsx)
print("\n[1] Papan Kanban (app/page.tsx):")
if kanban_file:
    with open(kanban_file, "r", encoding="utf-8") as f:
        k_code = f.read()

    has_modal = "archiveModalOrder" in k_code and "handleExecuteArchive" in k_code
    has_role_gate = 'userRole === "ACCOUNTING"' in k_code and "Kasir" in k_code
    has_unpaid_warning = "Tagihan belum lunas" in k_code or "modalIsLunas" in k_code

    if has_modal and has_role_gate and has_unpaid_warning:
        print("  -> STATUS: [SUDAH TERPASANG LENGKAP]")
        print("     * Modal Kasir Pelunasan: AKTIF")
        print("     * Proteksi Tombol Role Kasir: AKTIF")
    else:
        print("  -> STATUS: [BELUM LENGKAP]")
        if not has_modal: print("     x Modal Pop-up pelunasan belum terpasang.")
        if not has_role_gate: print("     x Proteksi tombol role kasir belum terpasang.")
else:
    print("  -> File app/page.tsx tidak ditemukan.")

# 2. CEK KIOSK SCANNER (app/kiosk/page.tsx)
print("\n[2] Kiosk Scanner SPK (app/kiosk/page.tsx):")
if kiosk_file:
    with open(kiosk_file, "r", encoding="utf-8") as f:
        ks_code = f.read()

    has_8_stages = "PATTERN_CUTTING" in ks_code and "HEAT_PRESS" in ks_code
    has_kiosk_accounting = 'allowedRoles: ["OWNER", "ACCOUNTING"]' in ks_code
    has_kiosk_unpaid_lock = "isStage8 && !isLunas" in ks_code

    if has_8_stages and has_kiosk_accounting and has_kiosk_unpaid_lock:
        print("  -> STATUS: [SUDAH TERPASANG LENGKAP]")
        print("     * Alur 8 Pos Kerja di Kiosk: AKTIF")
        print("     * Role ACCOUNTING di Pos 08: AKTIF")
        print("     * Kunci Larangan Selesai jika Belum Lunas: AKTIF")
    else:
        print("  -> STATUS: [BELUM TERPASANG / MASIH KODE LAMA]")
        if not has_8_stages: print("     x Kiosk masih alur 6 tahap lama (belum ada Press & Potong Pola).")
        if not has_kiosk_accounting: print("     x Pos 08 Kiosk belum mengunci role ACCOUNTING.")
        if not has_kiosk_unpaid_lock: print("     x Kiosk belum memblokir order yang belum lunas.")
else:
    print("  -> File app/kiosk/page.tsx tidak ditemukan.")

print("\n" + "=" * 65)