"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { compressImage } from "@/lib/imageCompressor"
import Link from "next/link"
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Users2, 
  Shirt, 
  User, 
  DollarSign, 
  Layers, 
  UploadCloud, 
  FileText, 
  CheckCircle2
} from "lucide-react"

interface PartnerItem {
  id: string
  name: string
}

type DynamicSizeMatrix = Record<string, Record<string, number>>

import { FABRIC_OPTIONS, COLLAR_OPTIONS, CUSTOM_OPTION_VALUE, INK_PROFILES, PRESET_MODELS, ADULT_SIZES, KID_SIZES } from "@/lib/constants"

function formatRibuan(num: number): string {
  if (!num || isNaN(num)) return ""
  return num.toLocaleString("id-ID")
}

function parseRibuan(str: string): number {
  const clean = str.replace(/[^0-9]/g, "")
  return clean ? parseInt(clean, 10) : 0
}

export default function NewOrderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Identitas Pesanan
  const [orderTitle, setOrderTitle] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [priority, setPriority] = useState("NORMAL")
  const [currentAdmin, setCurrentAdmin] = useState<string>("Admin Manayra")
  const [currentAdminRole, setCurrentAdminRole] = useState<string>("ADMIN")

  // Parameter Spesifikasi, Tipe Order & Lokasi
  const [fabricType, setFabricType] = useState(FABRIC_OPTIONS[0])
  const [isCustomFabric, setIsCustomFabric] = useState(false)
  const [customFabric, setCustomFabric] = useState("")

  const [collarType, setCollarType] = useState(COLLAR_OPTIONS[0])
  const [isCustomCollar, setIsCustomCollar] = useState(false)
  const [customCollar, setCustomCollar] = useState("")

  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [deadlineDate, setDeadlineDate] = useState("")
  const [packageType, setPackageType] = useState<"ATASAN" | "STELAN">("ATASAN")
  const [inkType, setInkType] = useState<"ORI" | "CINA">("ORI")
  const [inkProfile, setInkProfile] = useState<string>("952")
  const [orderType, setOrderType] = useState<"FULL_ORDER" | "PRINT_PRESS">("FULL_ORDER")
  const [designLocation, setDesignLocation] = useState<"DISINI" | "LUAR">("DISINI")
  const [cuttingLocation, setCuttingLocation] = useState<"DISINI" | "LUAR">("DISINI")

  // Model Aktif & Kustom
  const [activeModels, setActiveModels] = useState<string[]>(["Lengan Pendek", "Lengan Panjang"])
  const [customModelInput, setCustomModelInput] = useState("")

  // State Biaya Dinamis Berbasis Kategori
  const [priceAdult, setPriceAdult] = useState<number>(0)
  const [priceKid, setPriceKid] = useState<number>(0)
  const [feeLongSleeve, setFeeLongSleeve] = useState<number>(0)
  const [priceJacket, setPriceJacket] = useState<number>(0)
  const [feeHoodie, setFeeHoodie] = useState<number>(0)
  const [pricePants, setPricePants] = useState<number>(0)
  const [priceTraining, setPriceTraining] = useState<number>(0)
  const [feeJumbo, setFeeJumbo] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [downPayment, setDownPayment] = useState<number>(0)

  // Sakelar Kunci Harga Paket Borongan (Override Manual)
  const [isManualPrice, setIsManualPrice] = useState(false)
  const [manualTotalPrice, setManualTotalPrice] = useState<number>(0)

  // Matriks Ukuran Dinamis
  const [adultMatrix, setAdultMatrix] = useState<DynamicSizeMatrix>(() => {
    const init: DynamicSizeMatrix = {}
    ADULT_SIZES.forEach((sz) => { init[sz] = {} })
    return init
  })

  const [kidMatrix, setKidMatrix] = useState<DynamicSizeMatrix>(() => {
    const init: DynamicSizeMatrix = {}
    KID_SIZES.forEach((sz) => { init[sz] = {} })
    return init
  })

  // Wadah Roster: WA Text & 2 Slot Screenshot
  const [rosterWaText, setRosterWaText] = useState("")
  const [rosterScreenshotUrl, setRosterScreenshotUrl] = useState<string | null>(null)
  const [rosterScreenshotUrl2, setRosterScreenshotUrl2] = useState<string | null>(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [uploadingScreenshot2, setUploadingScreenshot2] = useState(false)

  // Makloon & Catatan
  const [isMakloon, setIsMakloon] = useState(false)
  const [makloonVendorName, setMakloonVendorName] = useState("")
  const [partnerList, setPartnerList] = useState<PartnerItem[]>([])
  const [productionNotes, setProductionNotes] = useState("")
  const [catatanDesain, setCatatanDesain] = useState("")
  const [linkDriveAset, setLinkDriveAset] = useState("")

  useEffect(() => {
    async function initData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("full_name, role").eq("id", session.user.id).single()
        if (prof?.full_name) setCurrentAdmin(prof.full_name)
        if (prof?.role) setCurrentAdminRole(prof.role.toUpperCase())
      }

      const { data } = await supabase.from("makloon_partners").select("*").order("created_at", { ascending: false })
      if (data && data.length > 0) {
        setPartnerList(data.map((p: any) => ({
          id: p.id,
          name: p.name || p.partner_name || p.vendor_name || "Tanpa Nama"
        })))
      }
    }
    initData()
  }, [])

  // Deteksi Kategori yang Sedang Aktif
  const hasJersey = activeModels.some((m) =>
    ["Lengan Pendek", "Lengan Panjang", "Raglan Pendek", "Raglan Panjang"].includes(m)
  )
  const hasJaket = activeModels.some((m) =>
    ["Jaket Oblong", "Jaket Oblong (+Kupluk)", "Jaket Raglan", "Jaket Raglan (+Kupluk)"].includes(m)
  )
  const hasCelanaPendek = activeModels.includes("Celana Pendek")
  const hasTraining = activeModels.includes("Celana Training")

  // Toggle Aktif / Nonaktif Model
  const toggleModel = (modelKey: string) => {
    setActiveModels((prev) => {
      if (prev.includes(modelKey)) {
        if (prev.length === 1) {
          alert("Minimal harus ada 1 model yang aktif.")
          return prev
        }
        return prev.filter((m) => m !== modelKey)
      } else {
        return [...prev, modelKey]
      }
    })
  }

  const handleAddCustomModel = () => {
    const trimmed = customModelInput.trim()
    if (!trimmed) return
    if (activeModels.includes(trimmed)) {
      alert("Model tersebut sudah aktif.")
      return
    }
    setActiveModels((prev) => [...prev, trimmed])
    setCustomModelInput("")
  }

  const handleRemoveModel = (modelKey: string) => {
    if (activeModels.length === 1) {
      alert("Minimal harus ada 1 model aktif.")
      return
    }
    setActiveModels((prev) => prev.filter((m) => m !== modelKey))
  }

  const handleMatrixChange = (
    category: "adult" | "kid",
    size: string,
    model: string,
    val: number
  ) => {
    const setter = category === "adult" ? setAdultMatrix : setKidMatrix
    setter((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [model]: val >= 0 ? val : 0,
      },
    }))
  }

  // Kalkulasi Total Matriks Ukuran Multi-Model
  const matrixTotals = useMemo(() => {
    const modelTotals: Record<string, number> = {}
    activeModels.forEach((m) => { modelTotals[m] = 0 })

    let adultTotalPcs = 0
    ADULT_SIZES.forEach((sz) => {
      const row = adultMatrix[sz] || {}
      activeModels.forEach((m) => {
        const count = Number(row[m] || 0)
        modelTotals[m] = (modelTotals[m] || 0) + count
        adultTotalPcs += count
      })
    })

    let kidTotalPcs = 0
    KID_SIZES.forEach((sz) => {
      const row = kidMatrix[sz] || {}
      activeModels.forEach((m) => {
        const count = Number(row[m] || 0)
        modelTotals[m] = (modelTotals[m] || 0) + count
        kidTotalPcs += count
      })
    })

    const grandTotalPcs = adultTotalPcs + kidTotalPcs

    return {
      modelTotals,
      adultTotalPcs,
      kidTotalPcs,
      grandTotalPcs,
    }
  }, [adultMatrix, kidMatrix, activeModels])

  // Kalkulasi Harga Cerdas Kategori + Override Borongan
  const totalPrice = useMemo(() => {
    if (isManualPrice) {
      return manualTotalPrice > 0 ? manualTotalPrice : 0
    }

    let subtotal = 0

    // 1. Hitung Ukuran Dewasa
    ADULT_SIZES.forEach((sz) => {
      const isJumbo = sz === "2XL" || sz === "3XL" || sz === "4XL"
      const jumboSurcharge = isJumbo ? feeJumbo : 0
      const row = adultMatrix[sz] || {}

      activeModels.forEach((m) => {
        const qty = Number(row[m] || 0)
        if (qty <= 0) return

        if (m === "Lengan Pendek" || m === "Raglan Pendek") {
          subtotal += qty * (priceAdult + jumboSurcharge)
        } else if (m === "Lengan Panjang" || m === "Raglan Panjang") {
          subtotal += qty * (priceAdult + jumboSurcharge + feeLongSleeve)
        } else if (m === "Jaket Oblong" || m === "Jaket Raglan") {
          subtotal += qty * (priceJacket + jumboSurcharge)
        } else if (m === "Jaket Oblong (+Kupluk)" || m === "Jaket Raglan (+Kupluk)") {
          subtotal += qty * (priceJacket + jumboSurcharge + feeHoodie)
        } else if (m === "Celana Pendek") {
          subtotal += qty * pricePants
        } else if (m === "Celana Training") {
          subtotal += qty * priceTraining
        } else {
          // Model kustom bawaan ikut tarif jersey dewasa
          subtotal += qty * (priceAdult + jumboSurcharge)
        }
      })
    })

    // 2. Hitung Ukuran Anak
    KID_SIZES.forEach((sz) => {
      const row = kidMatrix[sz] || {}

      activeModels.forEach((m) => {
        const qty = Number(row[m] || 0)
        if (qty <= 0) return

        if (m === "Lengan Pendek" || m === "Raglan Pendek") {
          subtotal += qty * priceKid
        } else if (m === "Lengan Panjang" || m === "Raglan Panjang") {
          subtotal += qty * (priceKid + feeLongSleeve)
        } else if (m === "Jaket Oblong" || m === "Jaket Raglan") {
          subtotal += qty * priceJacket
        } else if (m === "Jaket Oblong (+Kupluk)" || m === "Jaket Raglan (+Kupluk)") {
          subtotal += qty * (priceJacket + feeHoodie)
        } else if (m === "Celana Pendek") {
          subtotal += qty * pricePants
        } else if (m === "Celana Training") {
          subtotal += qty * priceTraining
        } else {
          subtotal += qty * priceKid
        }
      })
    })

    const finalCalc = subtotal - discountAmount
    return finalCalc > 0 ? finalCalc : 0
  }, [
    isManualPrice,
    manualTotalPrice,
    adultMatrix,
    kidMatrix,
    activeModels,
    priceAdult,
    priceKid,
    feeLongSleeve,
    priceJacket,
    feeHoodie,
    pricePants,
    priceTraining,
    feeJumbo,
    discountAmount
  ])

  const sisaPiutang = useMemo(() => {
    const sisa = totalPrice - downPayment
    return sisa > 0 ? sisa : 0
  }, [totalPrice, downPayment])

  const processUploadScreenshot = async (file: File, slot: 1 | 2) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih atau drag file gambar (JPG, PNG, WEBP).")
      return
    }

    if (slot === 1) setUploadingScreenshot(true)
    else setUploadingScreenshot2(true)

    try {
      const compressedBlob = await compressImage(file, 1600, 0.8)
      const fileName = `roster-ss-${slot}-${Date.now()}.webp`

      const { error: uploadError } = await supabase.storage
        .from("order-mockups")
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from("order-mockups")
        .getPublicUrl(fileName)

      if (slot === 1) setRosterScreenshotUrl(publicUrlData.publicUrl)
      else setRosterScreenshotUrl2(publicUrlData.publicUrl)
    } catch (err: any) {
      alert("Gagal mengunggah screenshot: " + err.message)
    } finally {
      if (slot === 1) setUploadingScreenshot(false)
      else setUploadingScreenshot2(false)
    }
  }

  const handleUploadScreenshot = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0]
    if (file) processUploadScreenshot(file, slot)
  }

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragTarget !== targetKey) {
      setDragTarget(targetKey)
    }
  }

  const handleDragLeave = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragTarget((prev) => (prev === targetKey ? null : prev))
  }

  const handleDropScreenshot = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault()
    e.stopPropagation()
    setDragTarget(null)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadScreenshot(file, slot)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")

    try {
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, "0")
      const dd = String(now.getDate()).padStart(2, "0")
      const datePart = `${yy}${mm}${dd}`
      const randomPart = Math.floor(1000 + Math.random() * 9000)
      const orderNumber = `MN-${datePart}-${randomPart}`

      const isPaid = downPayment >= totalPrice
      const finalFabric = fabricType === CUSTOM_OPTION_VALUE ? (customFabric.trim() || "Kain Kustom") : fabricType
      const finalCollar = collarType === CUSTOM_OPTION_VALUE ? (customCollar.trim() || "Kerah Kustom") : collarType

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          order_title: orderTitle.trim(),
          customer_name: customerName.trim(),
          customer_phone: "-",
          fabric_type: finalFabric,
          collar_type: finalCollar,
          deadline_date: deadlineDate,
          priority: priority,
          created_by_name: currentAdmin,
          package_type: packageType,
          ink_type: inkType,
          ink_profile: inkProfile,
          order_type: orderType,
          design_location: designLocation,
          cutting_location: cuttingLocation,
          pricing_config: {
            priceAdult, priceKid, pricePants, priceJacket, priceTraining,
            feeLongSleeve, feeHoodie, feeJumbo, discountAmount,
            isManualPrice, manualTotalPrice
          },
          size_breakdown: {
            active_models: activeModels,
            adult: adultMatrix,
            kid: kidMatrix
          },
          roster_wa_text: rosterWaText.trim() || null,
          roster_screenshot_url: rosterScreenshotUrl || null,
          roster_screenshot_url_2: rosterScreenshotUrl2 || null,
          catatan_desain: catatanDesain.trim(),
          link_drive_aset: linkDriveAset.trim(),
          total_qty: matrixTotals.grandTotalPcs,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: isPaid,
          current_status: "ORDER_INBOX",
          production_notes: productionNotes,
          is_makloon: isMakloon,
          makloon_vendor_name: isMakloon ? makloonVendorName.trim() : null
        })
        .select()
        .single()

      if (orderError) throw orderError

      await supabase.from("production_logs").insert({
        order_id: orderData.id,
        stage: "DESIGN_QUEUE",
        notes: "Pesanan baru dibuat dan masuk ke antrean Order Masuk (Inbox).",
        operator_name: currentAdmin,
        operator_role: currentAdminRole
      })

      router.push(`/orders/${orderData.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat pesanan")
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
        <Link
          href="/orders"
          className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-zinc-900 leading-tight">Buat Pesanan Baru</h1>
          <p className="text-xs text-zinc-600">Input spesifikasi jersey, tipe order, matriks ukuran, dan catatan roster.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* PARAMETER UTAMA 3 KOLOM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kolom 1: Identitas & Prioritas */}
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-500" /> Informasi Pesanan
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-zinc-600 font-semibold mb-1">Nama Order</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jersey Futsal SSB"
                  value={orderTitle}
                  onChange={(e) => setOrderTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 border-2 border-zinc-800 rounded font-bold text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-zinc-50/50"
                />
              </div>
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nama Pemesan / Instansi</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Budi / PT Sejahtera"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              {/* PRIORITAS PENGERJAAN DENGAN IKON & LABEL LENGKAP */}
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Prioritas Pengerjaan</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white font-semibold text-xs"
                >
                  <option value="NORMAL">🟢 Reguler / Standar (Normal)</option>
                  <option value="HIGH">⚡ Express / Kilat (Prioritas Tinggi)</option>
                  <option value="URGENT">🔥 Super Express / Urgent (Darurat)</option>
                </select>
              </div>

              {/* TIPE ORDER: FULL ORDER vs PRINT PRESS */}
              <div className="pt-1 border-t border-zinc-100">
                <label className="block text-zinc-700 font-bold mb-1 text-[11px]">Tipe Pengerjaan Order</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex items-center gap-1.5 p-1.5 border rounded cursor-pointer text-[11px] font-medium bg-zinc-50">
                    <input
                      type="radio"
                      name="order_type"
                      checked={orderType === "FULL_ORDER"}
                      onChange={() => setOrderType("FULL_ORDER")}
                      className="text-zinc-900 focus:ring-zinc-900"
                    />
                    <span>Full Order</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 border rounded cursor-pointer text-[11px] font-medium bg-zinc-50">
                    <input
                      type="radio"
                      name="order_type"
                      checked={orderType === "PRINT_PRESS"}
                      onChange={() => setOrderType("PRINT_PRESS")}
                      className="text-zinc-900 focus:ring-zinc-900"
                    />
                    <span className="font-bold text-purple-900">Print + Press</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom 2: Bahan, Model, Paket, Tinta & Lokasi Layanan */}
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-2.5">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5 text-zinc-500" /> Bahan & Parameter Produksi
            </span>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Bahan Kain</label>
                  <select
                    value={fabricType}
                    onChange={(e) => {
                      const val = e.target.value
                      setFabricType(val)
                      setIsCustomFabric(val === CUSTOM_OPTION_VALUE)
                    }}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white text-[11px]"
                  >
                    {FABRIC_OPTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
                    <option value={CUSTOM_OPTION_VALUE}>+ Kustom / Lainnya (Ketik Manual)</option>
                  </select>
                  {isCustomFabric && (
                    <input
                      type="text"
                      placeholder="Ketik nama bahan..."
                      value={customFabric}
                      onChange={(e) => setCustomFabric(e.target.value)}
                      className="w-full px-2 py-1 border border-blue-400 bg-blue-50/50 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-[10.5px] font-semibold text-blue-900 mt-1"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Model Kerah</label>
                  <select
                    value={collarType}
                    onChange={(e) => {
                      const val = e.target.value
                      setCollarType(val)
                      setIsCustomCollar(val === CUSTOM_OPTION_VALUE)
                    }}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white text-[11px]"
                  >
                    {COLLAR_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                    <option value={CUSTOM_OPTION_VALUE}>+ Kustom / Lainnya (Ketik Manual)</option>
                  </select>
                  {isCustomCollar && (
                    <input
                      type="text"
                      placeholder="Ketik model kerah..."
                      value={customCollar}
                      onChange={(e) => setCustomCollar(e.target.value)}
                      className="w-full px-2 py-1 border border-blue-400 bg-blue-50/50 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none text-[10.5px] font-semibold text-blue-900 mt-1"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
                <div>
                  <label className="block text-zinc-700 font-bold mb-1 text-[11px]">Pilihan Paket</label>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                      <input
                        type="radio"
                        name="package_type"
                        checked={packageType === "ATASAN"}
                        onChange={() => setPackageType("ATASAN")}
                        className="text-zinc-900"
                      />
                      <span>Atasan Saja</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                      <input
                        type="radio"
                        name="package_type"
                        checked={packageType === "STELAN"}
                        onChange={() => setPackageType("STELAN")}
                        className="text-zinc-900"
                      />
                      <span className="font-semibold text-zinc-900">+ Celana</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-700 font-bold mb-1 text-[11px]">Tinta Sublim</label>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                      <input
                        type="radio"
                        name="ink_type"
                        checked={inkType === "ORI"}
                        onChange={() => {
                          setInkType("ORI")
                          setInkProfile("952")
                        }}
                        className="text-zinc-900"
                      />
                      <span className="font-semibold text-blue-800">Tinta Ori</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                      <input
                        type="radio"
                        name="ink_type"
                        checked={inkType === "CINA"}
                        onChange={() => {
                          setInkType("CINA")
                          setInkProfile("2 PAS")
                        }}
                        className="text-zinc-900"
                      />
                      <span>Tinta Cina</span>
                    </label>
                  </div>

                  {/* Profil Cetak Mesin */}
                  <div className="mt-1.5 pt-1 border-t border-zinc-100">
                    <span className="block text-[9.5px] text-zinc-500 font-bold mb-0.5 uppercase tracking-wider">
                      Profil ({inkType === "ORI" ? "Ori" : "Cina"}):
                    </span>
                    <div className="flex items-center gap-2">
                      {INK_PROFILES[inkType].map((prof) => (
                        <label key={prof} className="flex items-center gap-1 cursor-pointer text-[10.5px]">
                          <input
                            type="radio"
                            name="ink_profile"
                            value={prof}
                            checked={inkProfile === prof}
                            onChange={() => setInkProfile(prof)}
                            className="text-zinc-900"
                          />
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold ${
                            inkProfile === prof 
                              ? "bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs" 
                              : "text-zinc-600 hover:text-zinc-900"
                          }`}>
                            {prof}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100 text-[10.5px]">
                <div>
                  <span className="text-zinc-600 font-medium block">Desain/Setting:</span>
                  <select
                    value={designLocation}
                    onChange={(e) => setDesignLocation(e.target.value as any)}
                    className="w-full px-1.5 py-1 border border-zinc-300 rounded bg-white text-[10.5px] mt-0.5"
                  >
                    <option value="DISINI">Disini (Setting)</option>
                    <option value="LUAR">File Luar / Jadi</option>
                  </select>
                </div>
                <div>
                  <span className="text-zinc-600 font-medium block">Potong Kain:</span>
                  <select
                    value={cuttingLocation}
                    onChange={(e) => setCuttingLocation(e.target.value as any)}
                    className="w-full px-1.5 py-1 border border-zinc-300 rounded bg-white text-[10.5px] mt-0.5"
                  >
                    <option value="DISINI">Disini (Potong)</option>
                    <option value="LUAR">Kain Bawa Sendiri</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">Target Selesai (Deadline)</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Kolom 3: Kalkulator Harga Pintar Berbasis Kategori Aktif */}
          <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5 mb-1.5">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Biaya & Pembayaran
                </span>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200" title="Ketik total harga borongan bulat">
                  <input
                    type="checkbox"
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
                {/* 1. Kategori Jersey (Jika Aktif) */}
                {hasJersey && (
                  <div className="bg-zinc-50/70 p-1.5 rounded border border-zinc-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-zinc-500 uppercase block">Tarif Jersey Atasan</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">Dewasa (Rp)</label>
                        <input type="text" placeholder="0" value={formatRibuan(priceAdult)} onChange={(e) => setPriceAdult(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">Anak (Rp)</label>
                        <input type="text" placeholder="0" value={formatRibuan(priceKid)} onChange={(e) => setPriceKid(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">+ Lengan Panjang / Raglan Panjang (Rp)</label>
                      <input type="text" placeholder="0" value={formatRibuan(feeLongSleeve)} onChange={(e) => setFeeLongSleeve(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs" />
                    </div>
                  </div>
                )}

                {/* 2. Kategori Jaket (Jika Aktif) */}
                {hasJaket && (
                  <div className="bg-blue-50/50 p-1.5 rounded border border-blue-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-blue-800 uppercase block">Tarif Jaket Printing</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-blue-900 font-medium mb-0.5 text-[9.5px]">Jaket / Pcs (Rp)</label>
                        <input type="text" placeholder="0" value={formatRibuan(priceJacket)} onChange={(e) => setPriceJacket(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-blue-300 rounded font-mono text-xs bg-white" />
                      </div>
                      <div>
                        <label className="block text-blue-900 font-medium mb-0.5 text-[9.5px]">+ Kupluk (Rp)</label>
                        <input type="text" placeholder="0" value={formatRibuan(feeHoodie)} onChange={(e) => setFeeHoodie(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-blue-300 rounded font-mono text-xs bg-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Kategori Celana & Training (Jika Aktif) */}
                {(hasCelanaPendek || hasTraining) && (
                  <div className="bg-purple-50/40 p-1.5 rounded border border-purple-200/70 space-y-1">
                    <span className="text-[9.5px] font-bold text-purple-800 uppercase block">Tarif Celana / Bawahan</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {hasCelanaPendek && (
                        <div>
                          <label className="block text-purple-900 font-medium mb-0.5 text-[9.5px]">Celana Pendek (Rp)</label>
                          <input type="text" placeholder="0" value={formatRibuan(pricePants)} onChange={(e) => setPricePants(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-purple-300 rounded font-mono text-xs bg-white" />
                        </div>
                      )}
                      {hasTraining && (
                        <div>
                          <label className="block text-purple-900 font-medium mb-0.5 text-[9.5px]">Training (Rp)</label>
                          <input type="text" placeholder="0" value={formatRibuan(priceTraining)} onChange={(e) => setPriceTraining(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-purple-300 rounded font-mono text-xs bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Biaya Tambahan Global (Jumbo & Diskon) */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">+ Jumbo 2XL+ (Rp)</label>
                    <input type="text" placeholder="0" value={formatRibuan(feeJumbo)} onChange={(e) => setFeeJumbo(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-xs" />
                  </div>
                  <div>
                    <label className="block text-red-600 font-medium mb-0.5 text-[9.5px]">Diskon (Rp)</label>
                    <input type="text" placeholder="0" value={formatRibuan(discountAmount)} onChange={(e) => setDiscountAmount(parseRibuan(e.target.value))} className="w-full px-1.5 py-0.5 border border-zinc-300 rounded font-mono text-red-600 font-bold text-xs" />
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
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[9.5px]">Uang Muka / DP (Rp)</label>
                  <input type="text" placeholder="0" value={formatRibuan(downPayment)} onChange={(e) => setDownPayment(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-600 focus:outline-none text-xs" />
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-zinc-200 flex justify-between items-center text-xs mt-auto">
              <span className="text-zinc-600 font-bold">SISA TAGIHAN:</span>
              <span className="font-black font-mono text-sm text-red-600">
                Rp {sisaPiutang.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>

        {/* MATRIKS UKURAN MULTI-MODEL: PANEL SELEKTOR + TABEL DINAMIS */}
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
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                        : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100"
                    }`}
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
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-blue-800 border-blue-200 hover:bg-blue-50"
                    }`}
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
                    onClick={() => toggleModel(m.key)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                      isActive
                        ? "bg-purple-700 text-white border-purple-700 shadow-2xs"
                        : "bg-white text-purple-800 border-purple-200 hover:bg-purple-50"
                    }`}
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
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(m)}
                      className="hover:text-red-200 font-bold ml-1"
                      title="Hapus Model Ini"
                    >
                      ×
                    </button>
                  </span>
                ))}

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
                              value={row[m] || ""}
                              onChange={(e) => handleMatrixChange("kid", sz, m, Number(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 bg-white"
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
                              value={row[m] || ""}
                              onChange={(e) => handleMatrixChange("adult", sz, m, Number(e.target.value) || 0)}
                              className="w-12 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 bg-white"
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
        </div>

        {/* WADAH FLEKSIBEL ROSTER: WA TEXT & 2 SLOT SCREENSHOT */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
          <div className="border-b border-zinc-200 pb-2">
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-zinc-600" /> Roster & Catatan Konsumen 
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Teks Catatan Khusus / Roster (Chat WhatsApp Asli)
              </label>
              <textarea
                rows={5}
                placeholder="Paste chat WhatsApp konsumen di sini..."
                value={rosterWaText}
                onChange={(e) => setRosterWaText(e.target.value)}
                className="w-full p-2.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-zinc-50/50 text-zinc-800 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Screenshot 1 */}
              <div
                onDragOver={(e) => handleDragOver(e, "screenshot-1")}
                onDragLeave={(e) => handleDragLeave(e, "screenshot-1")}
                onDrop={(e) => handleDropScreenshot(e, 1)}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-zinc-700">Screenshot 1</span>
                  <span className="text-[10px] text-zinc-400 font-mono">Bisa Drag & Drop</span>
                </div>
                {rosterScreenshotUrl ? (
                  <div className={`border rounded p-2 transition-all space-y-1.5 ${
                    dragTarget === "screenshot-1" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-400" : "border-zinc-200 bg-zinc-50"
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700">✓ Gambar 1 Siap</span>
                      <button
                        type="button"
                        onClick={() => setRosterScreenshotUrl(null)}
                        className="text-zinc-400 hover:text-red-600 p-0.5"
                        title="Hapus Screenshot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="h-32 border border-zinc-300 rounded bg-white flex items-center justify-center overflow-hidden relative">
                      <img src={rosterScreenshotUrl} alt="Screenshot 1" className="h-full w-full object-contain" />
                      {dragTarget === "screenshot-1" && (
                        <div className="absolute inset-0 bg-blue-600/80 text-white font-bold text-xs flex items-center justify-center">
                          Lepas File untuk Ganti Screenshot 1
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className={`h-[120px] border-2 border-dashed rounded transition-colors flex flex-col items-center justify-center p-3 cursor-pointer text-center ${
                    dragTarget === "screenshot-1" ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-zinc-300 hover:border-zinc-500 bg-zinc-50/30"
                  }`}>
                    <UploadCloud className={`h-5 w-5 mb-0.5 ${dragTarget === "screenshot-1" ? "text-blue-600 animate-bounce" : "text-zinc-400"}`} />
                    <span className="text-xs font-semibold text-zinc-700">
                      {uploadingScreenshot ? "Mengunggah..." : dragTarget === "screenshot-1" ? "Lepas File di Sini!" : "Unggah Screenshot 1 (Klik / Drag)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadScreenshot(e, 1)}
                      disabled={uploadingScreenshot}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Screenshot 2 */}
              <div
                onDragOver={(e) => handleDragOver(e, "screenshot-2")}
                onDragLeave={(e) => handleDragLeave(e, "screenshot-2")}
                onDrop={(e) => handleDropScreenshot(e, 2)}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-zinc-700">Screenshot 2 (Opsional)</span>
                  <span className="text-[10px] text-zinc-400 font-mono">Bisa Drag & Drop</span>
                </div>
                {rosterScreenshotUrl2 ? (
                  <div className={`border rounded p-2 transition-all space-y-1.5 ${
                    dragTarget === "screenshot-2" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-400" : "border-zinc-200 bg-zinc-50"
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700">✓ Gambar 2 Siap</span>
                      <button
                        type="button"
                        onClick={() => setRosterScreenshotUrl2(null)}
                        className="text-zinc-400 hover:text-red-600 p-0.5"
                        title="Hapus Screenshot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="h-32 border border-zinc-300 rounded bg-white flex items-center justify-center overflow-hidden relative">
                      <img src={rosterScreenshotUrl2} alt="Screenshot 2" className="h-full w-full object-contain" />
                      {dragTarget === "screenshot-2" && (
                        <div className="absolute inset-0 bg-blue-600/80 text-white font-bold text-xs flex items-center justify-center">
                          Lepas File untuk Ganti Screenshot 2
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className={`h-[120px] border-2 border-dashed rounded transition-colors flex flex-col items-center justify-center p-3 cursor-pointer text-center ${
                    dragTarget === "screenshot-2" ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-zinc-300 hover:border-zinc-500 bg-zinc-50/30"
                  }`}>
                    <UploadCloud className={`h-5 w-5 mb-0.5 ${dragTarget === "screenshot-2" ? "text-blue-600 animate-bounce" : "text-zinc-400"}`} />
                    <span className="text-xs font-semibold text-zinc-700">
                      {uploadingScreenshot2 ? "Mengunggah..." : dragTarget === "screenshot-2" ? "Lepas File di Sini!" : "Unggah Screenshot 2 (Klik / Drag)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadScreenshot(e, 2)}
                      disabled={uploadingScreenshot2}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* JALUR PENGERJAAN JAHIT */}
        <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5 text-zinc-600" /> Jalur Pengerjaan Jahit
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <label className="block text-zinc-700 font-semibold">Tipe Pelaksana</label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sewing_route"
                    checked={!isMakloon}
                    onChange={() => setIsMakloon(false)}
                    className="text-zinc-900"
                  />
                  <span className="font-medium text-zinc-800">Jahit Internal Workshop</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sewing_route"
                    checked={isMakloon}
                    onChange={() => setIsMakloon(true)}
                    className="text-zinc-900"
                  />
                  <span className="font-medium text-purple-800 font-semibold">Mitra Makloon Luar</span>
                </label>
              </div>
            </div>

            {isMakloon && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-purple-900 font-semibold">Pilih Mitra Makloon</label>
                  <Link href="/makloon" target="_blank" className="text-[10px] text-purple-700 hover:underline">
                    + Kelola Partner
                  </Link>
                </div>

                {partnerList.length > 0 ? (
                  <select
                    value={makloonVendorName}
                    onChange={(e) => setMakloonVendorName(e.target.value)}
                    required={isMakloon}
                    className="w-full px-2.5 py-1.5 border border-purple-300 rounded text-xs bg-purple-50/50 font-medium text-zinc-900"
                  >
                    <option value="">-- Pilih Partner Makloon Terdaftar --</option>
                    {partnerList.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ketik nama partner makloon..."
                    value={makloonVendorName}
                    onChange={(e) => setMakloonVendorName(e.target.value)}
                    required={isMakloon}
                    className="w-full px-2.5 py-1.5 border border-purple-300 rounded text-xs bg-purple-50/50 text-zinc-900"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* CATATAN TEKNIS & BRIEF DESAIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-2">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight">
              Catatan Teknis & Instruksi Produksi
            </span>
            <textarea
              rows={3}
              value={productionNotes}
              onChange={(e) => setProductionNotes(e.target.value)}
              placeholder="Instruksi untuk bagian potong atau penjahit..."
              className="w-full p-2.5 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none text-zinc-800 leading-relaxed placeholder:text-zinc-400"
            />
          </div>

          <div className="border border-purple-200 bg-purple-50/30 p-3.5 rounded shadow-2xs space-y-2">
            <span className="text-xs font-bold text-purple-950 uppercase tracking-tight">
              Instruksi Setting Desain & Link Aset (Opsional)
            </span>
            <input
              type="text"
              placeholder="Link folder Google Drive / server lokal..."
              value={linkDriveAset}
              onChange={(e) => setLinkDriveAset(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-mono focus:ring-1 focus:ring-purple-900 focus:outline-none bg-white"
            />
            <textarea
              rows={2}
              placeholder="Brief motif warna/settingan..."
              value={catatanDesain}
              onChange={(e) => setCatatanDesain(e.target.value)}
              className="w-full p-2 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-purple-900 focus:outline-none bg-white text-zinc-800"
            />
          </div>
        </div>

        {/* Tombol Simpan */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/orders"
            className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {submitting ? "Menyimpan Pesanan..." : "Simpan Pesanan"}
          </button>
        </div>
      </form>
    </div>
  )
}
