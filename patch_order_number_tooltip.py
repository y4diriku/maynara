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

# 1. Pastikan interface Order memuat field created_by_name
if "created_by_name?: string | null" not in code:
    code = code.replace(
        'order_title?: string | null',
        'order_title?: string | null\n  created_by_name?: string | null'
    )
    print("[1/2] Interface Order diperbarui dengan field created_by_name.")

# 2. Pasang Tooltip dan cursor-help pada elemen pembungkus Nomor Order
old_no_order_div = '''                        {/* 1. Baris No Order Menjadi Badge Prioritas Langsung */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <div className="flex items-center gap-1 truncate">'''

new_no_order_div = '''                        {/* 1. Baris No Order Menjadi Badge Prioritas Langsung + Tooltip Pembuat */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <div 
                            className="flex items-center gap-1 truncate cursor-help" 
                            title={`Diterbitkan oleh: ${order.created_by_name || "Admin Manayra"}`}
                          >'''

if old_no_order_div in code:
    code = code.replace(old_no_order_div, new_no_order_div, 1)
    print("[2/2] Tooltip nama pembuat berhasil dipasang pada Nomor Order.")
else:
    print("[LEWAT] Blok baris nomor order tidak cocok persis, silakan periksa kode.")

with open(kanban_file, "w", encoding="utf-8") as f:
    f.write(code)

print("\n[SELESAI] Tooltip pembuat order aktif tanpa menambah ruang kartu!")