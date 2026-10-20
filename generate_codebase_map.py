import os
import re

# Tentukan direktori target (otomatis mendeteksi folder jerseyflow atau direktori aktif)
target_dir = "jerseyflow" if os.path.exists("jerseyflow") else "."
output_file = "peta_modul_jerseyflow.txt"

# Folder yang wajib dilewati agar tidak membuat file txt kepenuhan
EXCLUDE_DIRS = {"node_modules", ".next", ".git", "dist", "build", "__pycache__"}
EXCLUDE_EXTS = {".png", ".jpg", ".jpeg", ".ico", ".webp", ".lock", ".env", ".DS_Store"}

def scan_codebase():
    report_lines = []
    report_lines.append("=" * 80)
    report_lines.append(" PETA STRUKTUR MODUL & KODE PROGRAM - JERSEYFLOW (MRR JERSEY / MANAYRA)")
    report_lines.append("=" * 80 + "\n")

    total_files = 0
    file_tree = []

    # 1. Buat Pohon Direktori (Directory Tree)
    for root, dirs, files in os.walk(target_dir):
        # Buang folder yang di-exclude
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        relative_root = os.path.relpath(root, target_dir)
        indent_level = 0 if relative_root == "." else relative_root.count(os.sep) + 1
        
        if relative_root != ".":
            file_tree.append(f"{'    ' * indent_level}📁 {os.path.basename(root)}/")
        
        for file in sorted(files):
            if any(file.endswith(ext) for ext in EXCLUDE_EXTS):
                continue
            file_tree.append(f"{'    ' * (indent_level + 1)}📄 {file}")
            total_files += 1

    report_lines.append(f"Total Berkas Terindeks: {total_files} file\n")
    report_lines.append("--- STRUKTUR DIREKTORI PROYEK ---")
    report_lines.extend(file_tree)
    report_lines.append("\n" + "=" * 80)
    report_lines.append(" RINCIAN MODUL, HALAMAN, DAN FUNGSI UTAMA")
    report_lines.append("=" * 80 + "\n")

    # 2. Ekstraksi Rute, Komponen, dan Fungsi per File .tsx / .ts
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in sorted(files):
            if file.endswith(".tsx") or file.endswith(".ts"):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, target_dir)
                
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception as e:
                    continue

                report_lines.append(f"📌 BERKAS: {rel_path}")
                
                # Deteksi Tipe Komponen (Client / Server)
                if '"use client"' in content or "'use client'" in content:
                    report_lines.append("   └─ Jenis: Client Component")
                else:
                    report_lines.append("   └─ Jenis: Server Component / API Route")

                # Ekstraksi Nama Fungsi / Komponen React menggunakan Regex
                # Mencari pola seperti: export default function Nama(), const Nama = ...
                func_patterns = re.findall(r'(?:export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()', content)
                
                extracted_funcs = []
                for match in func_patterns:
                    fname = match[0] if match[0] else match[1]
                    if fname and fname not in extracted_funcs:
                        extracted_funcs.append(fname)

                if extracted_funcs:
                    report_lines.append(f"   └─ Fungsi/Komponen: {', '.join(extracted_funcs)}")
                
                # Ekstraksi Import Utama (untuk melihat relasi modul)
                imports = re.findall(r'import\s+.*?from\s+["\'](.*?)["\']', content)
                local_imports = [imp for imp in imports if imp.startswith("@/") or imp.startswith(".")]
                if local_imports:
                    report_lines.append(f"   └─ Ketergantungan Modul: {', '.join(local_imports)}")

                report_lines.append("-" * 60)

    # Simpan ke file teks
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("\n".join(report_lines))

    print(f"[BERHASIL] Peta modul berhasil dibuat! Silakan buka file: {output_file}")

if __name__ == "__main__":
    scan_codebase()