import os
import sys
import re

target_file = os.path.join("app", "orders", "[id]", "page.tsx")
if not os.path.exists(target_file):
    print(f"[ERROR] Berkas {target_file} tidak ditemukan!")
    sys.exit(1)

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# 1. GANTI PANEL BIAYA LAMA DENGAN SMART CATEGORY PRICING DI [id]/page.tsx
pricing_pattern = re.compile(
    r'\{\/\* Kolom 3:.*?Biaya.*?Kalkulator.*?Mekanisme B.*?\}\}[\s\S]*?SISA TAGIHAN:[\s\S]*?<\/span>\s*<\/div>\s*<\/div>',
    re.MULTILINE
)

new_pricing_jsx = """{/* Kolom 3: Kalkulator Harga Pintar Berbasis Kategori Aktif */}
          <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5 mb-1.5">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Biaya & Pembayaran
                </span>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200" title="Ketik total harga borongan bulat">
                  <input
                    type="checkbox"
                    disabled={isLocked || isDesignerRole}
                    checked={isManualPrice}
                    onChange={(e) => {
                      setIsManualPrice(e.target.checked)
                      if (e.target.checked && manualTotalPrice === 0) {
                        setManualTotalPrice(totalPrice)
                      }
                    }}
                    className="rounded text-purple-600 focus:ring-purple-600 h-3 w-3"
                  />
                  <span>Borongan</span>
                </label>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* 1. Kategori Jersey */}
                {hasJersey && (
                  <div className="bg-zinc-50/70 p-1.5 rounded border border-zinc-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-zinc-500 uppercase block">Tarif Jersey Atasan</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">Dewasa (Rp)</label>
                        <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(priceAdult)} onChange={(e) => setPriceAdult(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                      </div>
                      <div>
                        <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">Anak (Rp)</label>
                        <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(priceKid)} onChange={(e) => setPriceKid(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">+ Lengan Panjang / Raglan Panjang (Rp)</label>
                      <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(feeLongSleeve)} onChange={(e) => setFeeLongSleeve(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                    </div>
                  </div>
                )}

                {/* 2. Kategori Jaket */}
                {hasJaket && (
                  <div className="bg-blue-50/50 p-1.5 rounded border border-blue-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-blue-800 uppercase block">Tarif Jaket Printing</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-blue-900 font-medium mb-0.5 text-[9.5px]">Jaket / Pcs (Rp)</label>
                        <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(priceJacket)} onChange={(e) => setPriceJacket(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-blue-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                      </div>
                      <div>
                        <label className="block text-blue-900 font-medium mb-0.5 text-[9.5px]">+ Kupluk (Rp)</label>
                        <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(feeHoodie)} onChange={(e) => setFeeHoodie(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-blue-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Kategori Celana & Training */}
                {(hasCelanaPendek || hasTraining) && (
                  <div className="bg-purple-50/40 p-1.5 rounded border border-purple-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-purple-800 uppercase block">Tarif Celana / Bawahan</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {hasCelanaPendek && (
                        <div>
                          <label className="block text-purple-900 font-medium mb-0.5 text-[9.5px]">Celana Pendek (Rp)</label>
                          <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(pricePants)} onChange={(e) => setPricePants(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-purple-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                        </div>
                      )}
                      {hasTraining && (
                        <div>
                          <label className="block text-purple-900 font-medium mb-0.5 text-[9.5px]">Training (Rp)</label>
                          <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(priceTraining)} onChange={(e) => setPriceTraining(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-purple-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Biaya Tambahan Global */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">+ Jumbo 2XL+ (Rp)</label>
                    <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(feeJumbo)} onChange={(e) => setFeeJumbo(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs bg-white disabled:bg-zinc-100" />
                  </div>
                  <div>
                    <label className="block text-red-600 font-medium mb-0.5 text-[9.5px]">Diskon (Rp)</label>
                    <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(discountAmount)} onChange={(e) => setDiscountAmount(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-red-600 font-bold text-xs bg-white disabled:bg-zinc-100" />
                  </div>
                </div>

                {/* Total Tagihan */}
                <div className="pt-1 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-zinc-900 font-bold text-[10px]">TOTAL TAGIHAN (Rp)</label>
                    {isManualPrice && (
                      <span className="text-[9px] font-mono text-purple-700 bg-purple-100 px-1 rounded font-bold">Mode Borongan</span>
                    )}
                  </div>
                  {isManualPrice ? (
                    <input
                      type="text"
                      placeholder="0"
                      disabled={isLocked || isDesignerRole}
                      value={formatRibuan(manualTotalPrice)}
                      onChange={(e) => setManualTotalPrice(parseRibuan(e.target.value))}
                      className="w-full px-2 py-1 border-2 border-purple-600 rounded font-mono font-black text-purple-900 bg-purple-50/50 text-xs focus:ring-1 focus:ring-purple-600 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={formatRibuan(totalPrice)}
                      className="w-full px-2 py-1 border-2 border-zinc-900 rounded font-mono font-black bg-zinc-100 text-zinc-900 cursor-not-allowed text-xs"
                    />
                  )}
                </div>

                <div className="pt-0.5">
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Uang Muka / DP (Rp)</label>
                  <input type="text" placeholder="0" disabled={isLocked || isDesignerRole} value={formatRibuan(downPayment)} onChange={(e) => setDownPayment(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-600 focus:outline-none text-xs bg-white disabled:bg-zinc-100" />
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-zinc-200 flex justify-between items-center text-xs mt-auto">
              <span className="text-zinc-600 font-bold">SISA TAGIHAN:</span>
              <span className="font-black font-mono text-sm text-red-600">
                Rp {sisaPiutang.toLocaleString("id-ID")}
              </span>
            </div>
          </div>"""

if pricing_pattern.search(content):
    content = pricing_pattern.sub(new_pricing_jsx, content, count=1)
    print("[OK] Panel biaya berhasil diganti dengan Smart Category Pricing.")
else:
    print("[INFO] Panel biaya sudah diperbarui sebelumnya.")

# 2. GANTI TABEL MATRIKS UKURAN LAMA DENGAN TABEL MULTI-MODEL BARU (MENGHAPUS kidBaju SECARA TOTAL)
matrix_pattern = re.compile(
    r'\{\/\* MATRIKS UKURAN: ANAK \(KIRI\) & DEWASA \(KANAN\) \*\/\}[\s\S]*?TOTAL:\s*\{matrixTotals\.[^}]*\}[^<]*<\/span>\s*<\/div>\s*<\/div>\s*<\/div>',
    re.MULTILINE
)

new_matrix_jsx = """{/* MATRIKS UKURAN MULTI-MODEL: PANEL SELEKTOR + TABEL DINAMIS */}
        <div className="border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3.5">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-2">
            <div>
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-600" /> Matriks Ukuran & Selektor Model Item
              </span>
              <p className="text-[11px] text-zinc-500">
                Pilih model yang diproduksi pada order ini. Kolom tabel akan menyesuaikan secara otomatis.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                Tinta: {inkType === "ORI" ? "Ori" : "Cina"} ({inkProfile})
              </span>
            </div>
          </div>

          {/* 1. Panel Chip Selektor Model */}
          <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2.5 space-y-2 text-xs">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
              Pilih Item Aktif pada Order Ini:
            </span>

            {/* Jersey */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase w-14 shrink-0">Jersey:</span>
              {PRESET_MODELS.filter((p) => p.category === "jersey").map((m) => {
                const isActive = activeModels.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={isLocked || isDesignerRole}
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                        : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100"
                    } disabled:opacity-75 disabled:cursor-not-allowed`}
                  >
                    {isActive ? "✓ " : "+ "}{m.label}
                  </button>
                )
              })}
            </div>

            {/* Jaket */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-blue-500 uppercase w-14 shrink-0">Jaket:</span>
              {PRESET_MODELS.filter((p) => p.category === "jaket").map((m) => {
                const isActive = activeModels.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={isLocked || isDesignerRole}
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-blue-800 border-blue-200 hover:bg-blue-50"
                    } disabled:opacity-75 disabled:cursor-not-allowed`}
                  >
                    {isActive ? "✓ " : "+ "}{m.label}
                  </button>
                )
              })}
            </div>

            {/* Celana & Training */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-purple-500 uppercase w-14 shrink-0">Bawahan:</span>
              {PRESET_MODELS.filter((p) => p.category === "celana").map((m) => {
                const isActive = activeModels.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={isLocked || isDesignerRole}
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-purple-700 text-white border-purple-700 shadow-2xs"
                        : "bg-white text-purple-800 border-purple-200 hover:bg-purple-50"
                    } disabled:opacity-75 disabled:cursor-not-allowed`}
                  >
                    {isActive ? "✓ " : "+ "}{m.label}
                  </button>
                )
              })}
            </div>

            {/* Tambah Model Kustom Lain */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200/60">
              <span className="text-[10px] font-bold text-zinc-400 uppercase w-14 shrink-0">Kustom:</span>
              {activeModels
                .filter((m) => !PRESET_MODELS.some((p) => p.key === m))
                .map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-700 text-white text-xs font-bold border border-emerald-800 shadow-2xs"
                  >
                    <span>✓ {m}</span>
                    {!isLocked && !isDesignerRole && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModel(m)}
                        className="hover:text-red-200 font-bold ml-1 cursor-pointer"
                        title="Hapus Model Ini"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}

              {!isLocked && !isDesignerRole && (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Ketik model lain (cth: Singlet)..."
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomModel(); } }}
                    className="px-2 py-0.5 text-xs border border-zinc-300 rounded bg-white w-44"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomModel}
                    className="px-2 py-0.5 bg-zinc-800 text-white rounded text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                  >
                    + Tambah
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Dua Tabel Matriks Ukuran (Anak & Dewasa) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kategori Anak */}
            <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/40 space-y-2 overflow-x-auto">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
                <span className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1">
                  🧒 Kategori Anak
                </span>
                <span className="font-mono text-[11px] font-bold text-zinc-700">
                  Total Anak: {matrixTotals.kidTotalPcs} pcs
                </span>
              </div>

              <table className="w-full text-left text-xs min-w-full">
                <thead>
                  <tr className="text-zinc-600 font-semibold uppercase text-[10px] border-b border-zinc-200">
                    <th className="py-1 px-1.5 w-16">Ukuran</th>
                    {activeModels.map((m) => (
                      <th key={m} className="py-1 px-1 text-center font-bold text-zinc-800 truncate max-w-[85px]" title={m}>
                        {m}
                      </th>
                    ))}
                    <th className="py-1 px-1.5 text-right w-14">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {KID_SIZES.map((sz) => {
                    const row = kidMatrix[sz] || {}
                    const rowSubtotal = activeModels.reduce((sum, m) => sum + Number(row[m] || 0), 0)

                    return (
                      <tr key={sz} className="hover:bg-zinc-100/60">
                        <td className="py-1 px-1.5 font-bold font-mono text-zinc-800 text-[11px]">{sz}</td>
                        {activeModels.map((m) => (
                          <td key={m} className="py-1 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isLocked || isDesignerRole}
                              value={row[m] || ""}
                              onChange={(e) => handleMatrixChange("kid", sz, m, Number(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 bg-white disabled:bg-zinc-100"
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="py-1 px-1.5 text-right font-mono font-bold text-zinc-900">
                          {rowSubtotal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Kategori Dewasa */}
            <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/40 space-y-2 overflow-x-auto">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
                <span className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1">
                  👕 Kategori Dewasa
                </span>
                <span className="font-mono text-[11px] font-bold text-zinc-700">
                  Total Dewasa: {matrixTotals.adultTotalPcs} pcs
                </span>
              </div>

              <table className="w-full text-left text-xs min-w-full">
                <thead>
                  <tr className="text-zinc-600 font-semibold uppercase text-[10px] border-b border-zinc-200">
                    <th className="py-1 px-1.5 w-14">Ukuran</th>
                    {activeModels.map((m) => (
                      <th key={m} className="py-1 px-1 text-center font-bold text-zinc-800 truncate max-w-[85px]" title={m}>
                        {m}
                      </th>
                    ))}
                    <th className="py-1 px-1.5 text-right w-14">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {ADULT_SIZES.map((sz) => {
                    const row = adultMatrix[sz] || {}
                    const rowSubtotal = activeModels.reduce((sum, m) => sum + Number(row[m] || 0), 0)

                    return (
                      <tr key={sz} className="hover:bg-zinc-100/60">
                        <td className="py-1 px-1.5 font-bold font-mono text-zinc-800">{sz}</td>
                        {activeModels.map((m) => (
                          <td key={m} className="py-1 px-1 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isLocked || isDesignerRole}
                              value={row[m] || ""}
                              onChange={(e) => handleMatrixChange("adult", sz, m, Number(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 bg-white disabled:bg-zinc-100"
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="py-1 px-1.5 text-right font-mono font-bold text-zinc-900">
                          {rowSubtotal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Baris Grand Total Produksi */}
          <div className="bg-zinc-900 text-white p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold">Total Rekapitulasi Order:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
              {activeModels.map((m) => (
                <span key={m} className="bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {m}: <strong className="text-white">{matrixTotals.modelTotals[m] || 0}</strong>
                </span>
              ))}
              <span className="text-emerald-400 font-black text-xs pl-1">
                GRAND TOTAL: {matrixTotals.grandTotalPcs} Pcs
              </span>
            </div>
          </div>
        </div>"""

if matrix_pattern.search(content):
    content = matrix_pattern.sub(new_matrix_jsx, content, count=1)
    print("[OK] Tabel ukuran lama berhasil diganti dengan Matriks Multi-Model.")
else:
    print("[INFO] Tabel ukuran sudah diperbarui sebelumnya.")

# 3. VERIFIKASI AKHIR
if "kidBaju" in content:
    print("[PERINGATAN] Masih ada sisa kidBaju di dalam file, melakukan pembersihan teks...")
    content = re.sub(r'\{matrixTotals\.kidBaju\}', '{matrixTotals.kidTotalPcs}', content)
    content = re.sub(r'\{matrixTotals\.adultBaju\}', '{matrixTotals.adultTotalPcs}', content)
    content = re.sub(r'\{matrixTotals\.grandTotalBaju\}', '{matrixTotals.grandTotalPcs}', content)
    content = re.sub(r'\{matrixTotals\.kidCelana\}', '0', content)
    content = re.sub(r'\{matrixTotals\.adultCelana\}', '0', content)
    content = re.sub(r'\{matrixTotals\.grandCelana\}', '0', content)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"[OK] Berkas {target_file} telah bersih dan tuntas!")