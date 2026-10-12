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

interface SizeRow {
  pendek: number
  panjang: number
  celana: number
}

type SizeMatrix = Record<string, SizeRow>

const FABRIC_OPTIONS = [
  "Dryfit Milano",
  "Dryfit Jarum",
  "Dryfit Bintik",
  "Dryfit Benzema",
  "Serena Super",
  "Polyester Standard"
]

const COLLAR_OPTIONS = [
  "O-Neck Standar",
  "V-Neck Standar",
  "V-Neck Variasi / Rib",
  "Kerah Polo Kancing",
  "Kerah Mandarin / Sanghai"
]

const ADULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"]
const KID_SIZES = ["S Anak", "M Anak", "L Anak", "XL Anak"]

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
  const [collarType, setCollarType] = useState(COLLAR_OPTIONS[0])
  const [deadlineDate, setDeadlineDate] = useState("")
  const [packageType, setPackageType] = useState<"ATASAN" | "STELAN">("ATASAN")
  const [inkType, setInkType] = useState<"ORI" | "CINA">("ORI")
  const [orderType, setOrderType] = useState<"FULL_ORDER" | "PRINT_PRESS">("FULL_ORDER")
  const [designLocation, setDesignLocation] = useState<"DISINI" | "LUAR">("DISINI")
  const [cuttingLocation, setCuttingLocation] = useState<"DISINI" | "LUAR">("DISINI")

  // 5 State Harga Cerdas (Mekanisme B)
  const [priceAdult, setPriceAdult] = useState<number>(0)
  const [priceKid, setPriceKid] = useState<number>(0)
  const [pricePants, setPricePants] = useState<number>(0)
  const [feeLongSleeve, setFeeLongSleeve] = useState<number>(0)
  const [feeJumbo, setFeeJumbo] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [downPayment, setDownPayment] = useState<number>(0)

  // Matriks Ukuran
  const [adultMatrix, setAdultMatrix] = useState<SizeMatrix>(() => {
    const init: SizeMatrix = {}
    ADULT_SIZES.forEach((sz) => { init[sz] = { pendek: 0, panjang: 0, celana: 0 } })
    return init
  })

  const [kidMatrix, setKidMatrix] = useState<SizeMatrix>(() => {
    const init: SizeMatrix = {}
    KID_SIZES.forEach((sz) => { init[sz] = { pendek: 0, panjang: 0, celana: 0 } })
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
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single()
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

  // Kalkulasi Matriks Ukuran
  const matrixTotals = useMemo(() => {
    let adultPendek = 0, adultPanjang = 0, adultCelana = 0
    ADULT_SIZES.forEach((sz) => {
      adultPendek += Number(adultMatrix[sz]?.pendek || 0)
      adultPanjang += Number(adultMatrix[sz]?.panjang || 0)
      adultCelana += Number(adultMatrix[sz]?.celana || 0)
    })
    const adultBaju = adultPendek + adultPanjang

    let kidPendek = 0, kidPanjang = 0, kidCelana = 0
    KID_SIZES.forEach((sz) => {
      kidPendek += Number(kidMatrix[sz]?.pendek || 0)
      kidPanjang += Number(kidMatrix[sz]?.panjang || 0)
      kidCelana += Number(kidMatrix[sz]?.celana || 0)
    })
    const kidBaju = kidPendek + kidPanjang

    const grandTotalBaju = adultBaju + kidBaju
    const grandTotalCelana = adultCelana + kidCelana
    const totalOrderQty = grandTotalBaju > 0 ? grandTotalBaju : grandTotalCelana

    return {
      adultPendek, adultPanjang, adultCelana, adultBaju,
      kidPendek, kidPanjang, kidCelana, kidBaju,
      grandTotalBaju, grandTotalCelana, totalOrderQty
    }
  }, [adultMatrix, kidMatrix])

  // Kalkulasi Harga Cerdas Mekanisme B
  const totalPrice = useMemo(() => {
    let subtotal = 0

    ADULT_SIZES.forEach((sz) => {
      const isJumbo = sz === "2XL" || sz === "3XL" || sz === "4XL"
      const jumboSurcharge = isJumbo ? feeJumbo : 0
      
      const p = Number(adultMatrix[sz]?.pendek || 0)
      const pj = Number(adultMatrix[sz]?.panjang || 0)
      const c = Number(adultMatrix[sz]?.celana || 0)

      subtotal += p * (priceAdult + jumboSurcharge)
      subtotal += pj * (priceAdult + jumboSurcharge + feeLongSleeve)
      if (packageType === "STELAN") subtotal += c * pricePants
    })

    KID_SIZES.forEach((sz) => {
      const p = Number(kidMatrix[sz]?.pendek || 0)
      const pj = Number(kidMatrix[sz]?.panjang || 0)
      const c = Number(kidMatrix[sz]?.celana || 0)

      subtotal += p * priceKid
      subtotal += pj * (priceKid + feeLongSleeve)
      if (packageType === "STELAN") subtotal += c * pricePants
    })

    const finalCalc = subtotal - discountAmount
    return finalCalc > 0 ? finalCalc : 0
  }, [adultMatrix, kidMatrix, priceAdult, priceKid, pricePants, feeLongSleeve, feeJumbo, packageType, discountAmount])

  const sisaPiutang = useMemo(() => {
    const sisa = totalPrice - downPayment
    return sisa > 0 ? sisa : 0
  }, [totalPrice, downPayment])

  const handleAdultChange = (sz: string, field: keyof SizeRow, val: number) => {
    setAdultMatrix((prev) => ({
      ...prev,
      [sz]: { ...prev[sz], [field]: val >= 0 ? val : 0 }
    }))
  }

  const handleKidChange = (sz: string, field: keyof SizeRow, val: number) => {
    setKidMatrix((prev) => ({
      ...prev,
      [sz]: { ...prev[sz], [field]: val >= 0 ? val : 0 }
    }))
  }

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0]
    if (!file) return

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

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          order_title: orderTitle.trim(),
          customer_name: customerName.trim(),
          customer_phone: "-",
          fabric_type: fabricType,
          collar_type: collarType,
          deadline_date: deadlineDate,
          priority: priority,
          created_by_name: currentAdmin,
          package_type: packageType,
          ink_type: inkType,
          order_type: orderType,
          design_location: designLocation,
          cutting_location: cuttingLocation,
          pricing_config: { priceAdult, priceKid, pricePants, feeLongSleeve, feeJumbo, discountAmount },
          size_breakdown: {
            adult: adultMatrix,
            kid: kidMatrix
          },
          roster_wa_text: rosterWaText.trim() || null,
          roster_screenshot_url: rosterScreenshotUrl || null,
          roster_screenshot_url_2: rosterScreenshotUrl2 || null,
          catatan_desain: catatanDesain.trim(),
          link_drive_aset: linkDriveAset.trim(),
          total_qty: matrixTotals.totalOrderQty,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: isPaid,
          current_status: "DESIGN_QUEUE",
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
        notes: "Pesanan baru dibuat dan masuk antrean desain.",
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
                    onChange={(e) => setFabricType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white text-[11px]"
                  >
                    {FABRIC_OPTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Model Kerah</label>
                  <select
                    value={collarType}
                    onChange={(e) => setCollarType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-zinc-300 rounded focus:ring-1 focus:ring-zinc-900 focus:outline-none bg-white text-[11px]"
                  >
                    {COLLAR_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
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
                        onChange={() => setInkType("ORI")}
                        className="text-zinc-900"
                      />
                      <span className="font-semibold text-blue-800">Tinta Ori</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                      <input
                        type="radio"
                        name="ink_type"
                        checked={inkType === "CINA"}
                        onChange={() => setInkType("CINA")}
                        className="text-zinc-900"
                      />
                      <span>Tinta Cina</span>
                    </label>
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

          {/* Kolom 3: Kalkulator Biaya Cerdas (Mekanisme B) */}
          <div className="border border-zinc-200 bg-white p-3 rounded shadow-2xs space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-tight flex items-center gap-1.5 mb-1.5 border-b border-zinc-100 pb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Kalkulator Harga & Pembayaran
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Harga Baju Dewasa</label>
                    <input type="text" placeholder="0" value={formatRibuan(priceAdult)} onChange={(e) => setPriceAdult(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Harga Baju Anak</label>
                    <input type="text" placeholder="0" value={formatRibuan(priceKid)} onChange={(e) => setPriceKid(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-100 pt-1">
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">+ Lengan Panjang</label>
                    <input type="text" placeholder="0" value={formatRibuan(feeLongSleeve)} onChange={(e) => setFeeLongSleeve(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">+ Jumbo (2XL+)</label>
                    <input type="text" placeholder="0" value={formatRibuan(feeJumbo)} onChange={(e) => setFeeJumbo(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono focus:ring-1 focus:ring-zinc-900 focus:outline-none text-xs" />
                  </div>
                  {packageType === "STELAN" && (
                    <div className="col-span-2 bg-purple-50 p-1 rounded border border-purple-100">
                      <label className="block text-purple-800 font-bold mb-0.5 text-[10px]">Harga Celana / Pcs</label>
                      <input type="text" placeholder="0" value={formatRibuan(pricePants)} onChange={(e) => setPricePants(parseRibuan(e.target.value))} className="w-full px-2 py-0.5 border border-purple-300 rounded font-mono text-purple-900 focus:ring-1 focus:ring-purple-600 focus:outline-none text-xs" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-800 pt-1.5 mt-0.5">
                  <div>
                    <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Diskon (Rp)</label>
                    <input type="text" placeholder="0" value={formatRibuan(discountAmount)} onChange={(e) => setDiscountAmount(parseRibuan(e.target.value))} className="w-full px-2 py-1 border border-zinc-300 rounded font-mono text-red-600 font-bold focus:ring-1 focus:ring-red-600 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-zinc-900 font-bold mb-0.5 text-[10px]">TOTAL TAGIHAN (Rp)</label>
                    <input type="text" readOnly value={formatRibuan(totalPrice)} className="w-full px-2 py-1 border-2 border-zinc-900 rounded font-mono font-black bg-zinc-100 text-zinc-900 cursor-not-allowed text-xs" />
                  </div>
                </div>

                <div className="pt-0.5">
                  <label className="block text-zinc-600 font-medium mb-0.5 text-[10px]">Uang Muka / DP (Rp)</label>
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

        {/* MATRIKS UKURAN: ANAK (KIRI) & DEWASA (KANAN) */}
        <div className="border border-zinc-200 bg-white rounded p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <div>
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-600" /> Matriks Ukuran & Rekapitulasi Produksi
              </span>
              <p className="text-[11px] text-zinc-500">
                Isi jumlah pcs sesuai ukuran. Kolom Celana otomatis aktif jika memilih paket Stelan.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-zinc-100 text-zinc-800 border">
                Paket: {packageType === "STELAN" ? "Stelan Celana" : "Atasan Saja"}
              </span>
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                Tinta: {inkType === "ORI" ? "Ori" : "Cina"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Kategori Anak (Sebelah Kiri) */}
            <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/40 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
                <span className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1">
                  🧒 Kategori Anak
                </span>
                <span className="font-mono text-[11px] font-bold text-zinc-700">
                  Subtotal: {matrixTotals.kidBaju} Baju {packageType === "STELAN" && `• ${matrixTotals.kidCelana} Celana`}
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-600 font-semibold uppercase text-[10px] border-b border-zinc-200">
                    <th className="py-1 px-2 w-20">Ukuran</th>
                    <th className="py-1 px-2 text-center">Pendek</th>
                    <th className="py-1 px-2 text-center">Panjang</th>
                    {packageType === "STELAN" && <th className="py-1 px-2 text-center bg-purple-50 text-purple-900">Celana</th>}
                    <th className="py-1 px-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {KID_SIZES.map((sz) => {
                    const row = kidMatrix[sz] || { pendek: 0, panjang: 0, celana: 0 }
                    const subBaju = Number(row.pendek || 0) + Number(row.panjang || 0)

                    return (
                      <tr key={sz} className="hover:bg-zinc-100/60">
                        <td className="py-1 px-2 font-bold font-mono text-zinc-800 text-[11px]">{sz}</td>
                        <td className="py-1 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.pendek || ""}
                            onChange={(e) => handleKidChange(sz, "pendek", Number(e.target.value) || 0)}
                            className="w-14 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-1 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.panjang || ""}
                            onChange={(e) => handleKidChange(sz, "panjang", Number(e.target.value) || 0)}
                            className="w-14 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900"
                            placeholder="0"
                          />
                        </td>
                        {packageType === "STELAN" && (
                          <td className="py-1 px-2 text-center bg-purple-50/50">
                            <input
                              type="number"
                              min="0"
                              value={row.celana || ""}
                              onChange={(e) => handleKidChange(sz, "celana", Number(e.target.value) || 0)}
                              className="w-14 text-center py-0.5 border border-purple-300 rounded font-mono text-xs focus:ring-1 focus:ring-purple-900 bg-white"
                              placeholder="0"
                            />
                          </td>
                        )}
                        <td className="py-1 px-2 text-right font-mono font-bold text-zinc-900">
                          {subBaju} pcs
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Kategori Dewasa (Sebelah Kanan) */}
            <div className="border border-zinc-200 rounded p-2.5 bg-zinc-50/40 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
                <span className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1">
                  👕 Kategori Dewasa
                </span>
                <span className="font-mono text-[11px] font-bold text-zinc-700">
                  Subtotal: {matrixTotals.adultBaju} Baju {packageType === "STELAN" && `• ${matrixTotals.adultCelana} Celana`}
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-600 font-semibold uppercase text-[10px] border-b border-zinc-200">
                    <th className="py-1 px-2 w-16">Ukuran</th>
                    <th className="py-1 px-2 text-center">Pendek</th>
                    <th className="py-1 px-2 text-center">Panjang</th>
                    {packageType === "STELAN" && <th className="py-1 px-2 text-center bg-purple-50 text-purple-900">Celana</th>}
                    <th className="py-1 px-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {ADULT_SIZES.map((sz) => {
                    const row = adultMatrix[sz] || { pendek: 0, panjang: 0, celana: 0 }
                    const subBaju = Number(row.pendek || 0) + Number(row.panjang || 0)

                    return (
                      <tr key={sz} className="hover:bg-zinc-100/60">
                        <td className="py-1 px-2 font-bold font-mono text-zinc-800">{sz}</td>
                        <td className="py-1 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.pendek || ""}
                            onChange={(e) => handleAdultChange(sz, "pendek", Number(e.target.value) || 0)}
                            className="w-14 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-1 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.panjang || ""}
                            onChange={(e) => handleAdultChange(sz, "panjang", Number(e.target.value) || 0)}
                            className="w-14 text-center py-0.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900"
                            placeholder="0"
                          />
                        </td>
                        {packageType === "STELAN" && (
                          <td className="py-1 px-2 text-center bg-purple-50/50">
                            <input
                              type="number"
                              min="0"
                              value={row.celana || ""}
                              onChange={(e) => handleAdultChange(sz, "celana", Number(e.target.value) || 0)}
                              className="w-14 text-center py-0.5 border border-purple-300 rounded font-mono text-xs focus:ring-1 focus:ring-purple-900 bg-white"
                              placeholder="0"
                            />
                          </td>
                        )}
                        <td className="py-1 px-2 text-right font-mono font-bold text-zinc-900">
                          {subBaju} pcs
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Total Bar */}
          <div className="bg-zinc-900 text-white p-2.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold">Grand Total Produksi:</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>Anak: <strong>{matrixTotals.kidBaju} pcs</strong></span>
              <span>&bull;</span>
              <span>Dewasa: <strong>{matrixTotals.adultBaju} pcs</strong></span>
              {packageType === "STELAN" && (
                <>
                  <span>&bull;</span>
                  <span className="text-purple-300 font-bold">Celana: {matrixTotals.grandTotalCelana} pcs</span>
                </>
              )}
              <span>&bull;</span>
              <span className="text-emerald-300 font-bold text-xs">
                TOTAL: {matrixTotals.grandTotalBaju} Stel / Pcs
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
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-zinc-700">Screenshot 1</span>
                {rosterScreenshotUrl ? (
                  <div className="border border-zinc-200 rounded p-2 bg-zinc-50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700">✓ Gambar 1 Siap</span>
                      <button
                        type="button"
                        onClick={() => setRosterScreenshotUrl(null)}
                        className="text-zinc-400 hover:text-red-600 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="h-32 border border-zinc-300 rounded bg-white flex items-center justify-center overflow-hidden">
                      <img src={rosterScreenshotUrl} alt="Screenshot 1" className="h-full w-full object-contain" />
                    </div>
                  </div>
                ) : (
                  <label className="h-[120px] border-2 border-dashed border-zinc-300 rounded hover:border-zinc-500 transition-colors flex flex-col items-center justify-center p-3 cursor-pointer bg-zinc-50/30 text-center">
                    <UploadCloud className="h-5 w-5 text-zinc-400 mb-0.5" />
                    <span className="text-xs font-semibold text-zinc-700">
                      {uploadingScreenshot ? "Mengunggah..." : "Unggah Screenshot 1"}
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

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-zinc-700">Screenshot 2 (Opsional)</span>
                {rosterScreenshotUrl2 ? (
                  <div className="border border-zinc-200 rounded p-2 bg-zinc-50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700">✓ Gambar 2 Siap</span>
                      <button
                        type="button"
                        onClick={() => setRosterScreenshotUrl2(null)}
                        className="text-zinc-400 hover:text-red-600 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="h-32 border border-zinc-300 rounded bg-white flex items-center justify-center overflow-hidden">
                      <img src={rosterScreenshotUrl2} alt="Screenshot 2" className="h-full w-full object-contain" />
                    </div>
                  </div>
                ) : (
                  <label className="h-[120px] border-2 border-dashed border-zinc-300 rounded hover:border-zinc-500 transition-colors flex flex-col items-center justify-center p-3 cursor-pointer bg-zinc-50/30 text-center">
                    <UploadCloud className="h-5 w-5 text-zinc-400 mb-0.5" />
                    <span className="text-xs font-semibold text-zinc-700">
                      {uploadingScreenshot2 ? "Mengunggah..." : "Unggah Screenshot 2"}
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
