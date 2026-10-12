import os
import sys

def get_target_file(rel_path):
    candidates = [
        rel_path,
        os.path.join("jerseyflow", rel_path)
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

new_order_file = get_target_file(os.path.join("app", "orders", "new", "page.tsx"))
if not new_order_file:
    print("[ERROR] File app/orders/new/page.tsx tidak ditemukan!")
    sys.exit(1)

with open(new_order_file, "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("\r\n", "\n")

# Ganti query select agar mengambil full_name dan role
old_query = '.from("profiles").select("full_name").eq("id", session.user.id).single()'
new_query = '.from("profiles").select("full_name, role").eq("id", session.user.id).single()'

if old_query in code:
    code = code.replace(old_query, new_query, 1)
    with open(new_order_file, "w", encoding="utf-8") as f:
        f.write(code)
    print(f"[BERHASIL] Query profil diselaraskan (.select('full_name, role')): {new_order_file}")
else:
    print("[LEWAT] Pola query tidak ditemukan atau sudah diperbaiki.")