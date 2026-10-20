"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { compressImage } from "@/lib/imageCompressor"
import Link from "next/link"
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Shirt, 
  User, 
  DollarSign, 
  Layers, 
  Printer, 
  UploadCloud, 
  ImageIcon, 
  FileText, 
  X, 
  Users2,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Share2,
  Copy,
  ExternalLink,
  MessageSquare
} from "lucide-react"

interface PartnerItem {
  id: string
  name: string
}

type DynamicSizeMatrix = Record<string, Record<string, number>>

import { FABRIC_OPTIONS, COLLAR_OPTIONS, CUSTOM_OPTION_VALUE, INK_PROFILES, PRESET_MODELS, ADULT_SIZES, KID_SIZES } from "@/lib/constants"



const STAGES = [
  { key: "DESIGN_QUEUE", label: "Desain", code: "01", accent: "bg-blue-600" },
  { key: "PRINTING", label: "Print Sublim", code: "02", accent: "bg-indigo-600" },
  { key: "CUTTING", label: "Potong Kain", code: "03", accent: "bg-amber-600" },
  { key: "HEAT_PRESS", label: "Press Kain", code: "04", accent: "bg-rose-600" },
  { key: "PATTERN_CUTTING", label: "Potong Pola", code: "05", accent: "bg-teal-600" },
  { key: "SEWING", label: "Lini Jahit", code: "06", accent: "bg-emerald-600" },
  { key: "QC_PACKING", label: "QC & Pack", code: "07", accent: "bg-violet-600" },
  { key: "READY_FOR_DELIVERY", label: "Siap Ambil", code: "08", accent: "bg-zinc-900" },
]

function formatRibuan(num: number): string {
  if (!num || isNaN(num)) return ""
  return num.toLocaleString("id-ID")
}

function parseRibuan(str: string): number {
  const clean = str.replace(/[^0-9]/g, "")
  return clean ? parseInt(clean, 10) : 0
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling, setCancelling] = useState(false)

  // State Modal Pelacakan Konsumen & WhatsApp
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [customerPhoneInput, setCustomerPhoneInput] = useState("")

  // Identitas & Status
  const [orderNumber, setOrderNumber] = useState("")
  const [orderTitle, setOrderTitle] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [currentStatus, setCurrentStatus] = useState("")
  const [priority, setPriority] = useState("NORMAL")

  // Parameter Spesifikasi, Paket, Tinta, Tipe & Lokasi
  const [fabricType, setFabricType] = useState("")
  const [isCustomFabric, setIsCustomFabric] = useState(false)
  const [customFabric, setCustomFabric] = useState("")

  const [collarType, setCollarType] = useState("")
  const [isCustomCollar, setIsCustomCollar] = useState(false)
  const [customCollar, setCustomCollar] = useState("")
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
  const [priceJacket, setPriceJacket] = useState<number>(0)
  const [feeHoodie, setFeeHoodie] = useState<number>(0)
  const [priceTraining, setPriceTraining] = useState<number>(0)

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

  // Wadah Roster WA & 2 Screenshot
  const [rosterWaText, setRosterWaText] = useState("")
  const [rosterScreenshotUrl, setRosterScreenshotUrl] = useState<string | null>(null)
  const [rosterScreenshotUrl2, setRosterScreenshotUrl2] = useState<string | null>(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [uploadingScreenshot2, setUploadingScreenshot2] = useState(false)

  // Biaya Cerdas Mekanisme B
  const [priceAdult, setPriceAdult] = useState<number>(0)
  const [priceKid, setPriceKid] = useState<number>(0)
  const [pricePants, setPricePants] = useState<number>(0)
  const [feeLongSleeve, setFeeLongSleeve] = useState<number>(0)
  const [feeJumbo, setFeeJumbo] = useState<number>(0)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [downPayment, setDownPayment] = useState<number>(0)
  const [productionNotes, setProductionNotes] = useState("")
  const [catatanDesain, setCatatanDesain] = useState("")
  const [linkDriveAset, setLinkDriveAset] = useState("")

  // Makloon
  const [isMakloon, setIsMakloon] = useState(false)
  const [makloonVendorName, setMakloonVendorName] = useState("")
  const [partnerList, setPartnerList] = useState<PartnerItem[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)

  // Mockup Gambar
  const [mockupUrl1, setMockupUrl1] = useState<string | null>(null)
  const [mockupUrl2, setMockupUrl2] = useState<string | null>(null)
  const [mockupUrl3, setMockupUrl3] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [dragTarget, setDragTarget] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!orderId) return
      setLoading(true)

      const { data: oData, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (oErr || !oData) {
        setMsg("Pesanan tidak ditemukan.")
        setLoading(false)
        return
      }

      setOrderNumber(oData.order_number)
      setOrderTitle(oData.order_title || "")
      setCustomerName(oData.customer_name)
      if (oData.customer_phone && oData.customer_phone !== "-") {
        setCustomerPhoneInput(oData.customer_phone)
      }
      const rawFabric = oData.fabric_type || ""
      if (rawFabric && !FABRIC_OPTIONS.includes(rawFabric)) {
        setIsCustomFabric(true)
        setCustomFabric(rawFabric)
        setFabricType(CUSTOM_OPTION_VALUE)
      } else {
        setIsCustomFabric(false)
        setCustomFabric("")
        setFabricType(rawFabric || FABRIC_OPTIONS[0])
      }

      const rawCollar = oData.collar_type || ""
      if (rawCollar && !COLLAR_OPTIONS.includes(rawCollar)) {
        setIsCustomCollar(true)
        setCustomCollar(rawCollar)
        setCollarType(CUSTOM_OPTION_VALUE)
      } else {
        setIsCustomCollar(false)
        setCustomCollar("")
        setCollarType(rawCollar || COLLAR_OPTIONS[0])
      }
      setDeadlineDate(oData.deadline_date)
      setPriority(oData.priority || "NORMAL")
      setPackageType((oData.package_type as any) || "ATASAN")
      const loadedInkType = (oData.ink_type as any) || "ORI"
      setInkType(loadedInkType)
      setInkProfile(oData.ink_profile || (loadedInkType === "CINA" ? "2 PAS" : "952"))
      setOrderType((oData.order_type as any) || "FULL_ORDER")
      setDesignLocation((oData.design_location as any) || "DISINI")
      setCuttingLocation((oData.cutting_location as any) || "DISINI")

      setDownPayment(Number(oData.down_payment) || 0)
      
      // Ambil role user login & verifikasi akses
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).single()
        if (prof?.role) {
          const r = prof.role.toUpperCase()
          setUserRole(r)
          const isDesigner = r.includes("DESIGN") || r === "OPERATOR_DESIGN" || r === "DESIGNER"
          const isAuthorized = r === "OWNER" || r === "ADMIN" || r === "ACCOUNTING" || isDesigner
          if (!isAuthorized) {
            router.replace("/")
            return
          }
        }
      }
      setCurrentStatus(oData.current_status)
      setProductionNotes(oData.production_notes || "")
      setCatatanDesain(oData.catatan_desain || "")
      setLinkDriveAset(oData.link_drive_aset || "")
      setIsMakloon(Boolean(oData.is_makloon))
      setMakloonVendorName(oData.makloon_vendor_name || "")
      setMockupUrl1(oData.mockup_url || null)
      setMockupUrl2(oData.mockup_url_2 || null)
      setMockupUrl3(oData.mockup_url_3 || null)
      setRosterWaText(oData.roster_wa_text || "")
      setRosterScreenshotUrl(oData.roster_screenshot_url || null)
      setRosterScreenshotUrl2(oData.roster_screenshot_url_2 || null)

      // Memuat data harga tersimpan
      if (oData.pricing_config) {
        setPriceAdult(Number(oData.pricing_config.priceAdult || 0))
        setPriceKid(Number(oData.pricing_config.priceKid || 0))
        setPricePants(Number(oData.pricing_config.pricePants || 0))
        setPriceJacket(Number(oData.pricing_config.priceJacket || 0))
        setPriceTraining(Number(oData.pricing_config.priceTraining || 0))
        setFeeLongSleeve(Number(oData.pricing_config.feeLongSleeve || 0))
        setFeeHoodie(Number(oData.pricing_config.feeHoodie || 0))
        setFeeJumbo(Number(oData.pricing_config.feeJumbo || 0))
        setDiscountAmount(Number(oData.pricing_config.discountAmount || 0))
        setIsManualPrice(Boolean(oData.pricing_config.isManualPrice))
        setManualTotalPrice(Number(oData.pricing_config.manualTotalPrice || 0))
      }

      // Memuat Matriks Ukuran dari JSONB (dengan Backward Compatibility otomatis)
      if (oData.size_breakdown && typeof oData.size_breakdown === "object") {
        const bd = oData.size_breakdown
        let loadedActiveModels: string[] = []

        if (Array.isArray(bd.active_models) && bd.active_models.length > 0) {
          loadedActiveModels = bd.active_models
        } else {
          // Migrasi otomatis data format lama
          loadedActiveModels = ["Lengan Pendek", "Lengan Panjang"]
          const hasCelana =
            Object.values(bd.adult || {}).some((r: any) => Number(r?.celana || 0) > 0) ||
            Object.values(bd.kid || {}).some((r: any) => Number(r?.celana || 0) > 0)
          if (hasCelana) loadedActiveModels.push("Celana Pendek")
        }
        setActiveModels(loadedActiveModels)

        // Matriks Dewasa
        const nextAdult: DynamicSizeMatrix = {}
        ADULT_SIZES.forEach((sz) => {
          nextAdult[sz] = {}
          const row = bd.adult?.[sz] || {}
          if ("pendek" in row || "panjang" in row || "celana" in row) {
            if (row.pendek) nextAdult[sz]["Lengan Pendek"] = Number(row.pendek)
            if (row.panjang) nextAdult[sz]["Lengan Panjang"] = Number(row.panjang)
            if (row.celana) nextAdult[sz]["Celana Pendek"] = Number(row.celana)
          } else {
            loadedActiveModels.forEach((m) => {
              if (row[m]) nextAdult[sz][m] = Number(row[m])
            })
          }
        })
        setAdultMatrix(nextAdult)

        // Matriks Anak
        const nextKid: DynamicSizeMatrix = {}
        KID_SIZES.forEach((sz) => {
          nextKid[sz] = {}
          const row = bd.kid?.[sz] || {}
          if ("pendek" in row || "panjang" in row || "celana" in row) {
            if (row.pendek) nextKid[sz]["Lengan Pendek"] = Number(row.pendek)
            if (row.panjang) nextKid[sz]["Lengan Panjang"] = Number(row.panjang)
            if (row.celana) nextKid[sz]["Celana Pendek"] = Number(row.celana)
          } else {
            loadedActiveModels.forEach((m) => {
              if (row[m]) nextKid[sz][m] = Number(row[m])
            })
          }
        })
        setKidMatrix(nextKid)
      }

      setLoadingPartners(true)
      const { data: pData } = await supabase
        .from("makloon_partners")
        .select("*")
        .order("created_at", { ascending: false })

      if (pData && pData.length > 0) {
        setPartnerList(pData.map((p: any) => ({
          id: p.id,
          name: p.name || p.partner_name || p.vendor_name || "Tanpa Nama"
        })))
      }
      setLoadingPartners(false)
      setLoading(false)
    }

    loadData()
  }, [orderId])

    // Deteksi Kategori yang Sedang Aktif
  const hasJersey = activeModels.some((m) =>
    ["Lengan Pendek", "Lengan Panjang", "Raglan Pendek", "Raglan Panjang"].includes(m)
  )
  const hasJaket = activeModels.some((m) =>
    ["Jaket Oblong", "Jaket Oblong (+Kupluk)", "Jaket Raglan", "Jaket Raglan (+Kupluk)"].includes(m)
  )
  const hasCelanaPendek = activeModels.includes("Celana Pendek")
  const hasTraining = activeModels.includes("Celana Training")

  // Handler Selektor Model Dinamis
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

  // Kalkulasi Matriks Ukuran Multi-Model
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
      totalOrderQty: grandTotalPcs,
    }
  }, [adultMatrix, kidMatrix, activeModels])

  // Kalkulasi Harga Cerdas Kategori + Override Borongan
  const totalPrice = useMemo(() => {
    if (isManualPrice) {
      return manualTotalPrice > 0 ? manualTotalPrice : 0
    }

    let subtotal = 0

    // 1. Dewasa
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
          subtotal += qty * (priceAdult + jumboSurcharge)
        }
      })
    })

    // 2. Anak
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

  const [userRole, setUserRole] = useState<string>("")
  const isArchived = currentStatus === "COMPLETED"
  const isCancelled = currentStatus === "CANCELLED"
  
  // Desainer boleh upload mockup & simpan, tapi form spesifikasi/harga tetap read-only
  const isDesignerRole = userRole.includes("DESIGN") || userRole === "OPERATOR_DESIGN" || userRole === "DESIGNER"
  const isLocked = isArchived || isCancelled

  const activeStageIndex = useMemo(() => {
    if (currentStatus === "COMPLETED") return 8
    return STAGES.findIndex((s) => s.key === currentStatus)
  }, [currentStatus])

  ))
  }

  ))
  }

  const processUploadScreenshot = async (file: File, slot: 1 | 2) => {
    if (!file || !orderId) return
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih atau drag file gambar (JPG, PNG, WEBP).")
      return
    }

    if (slot === 1) setUploadingScreenshot(true)
    else setUploadingScreenshot2(true)

    try {
      const compressedBlob = await compressImage(file, 1600, 0.8)
      const fileName = `roster-ss-${slot}-${orderId}.webp`

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

      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      const colKey = slot === 1 ? "roster_screenshot_url" : "roster_screenshot_url_2"
      await supabase.from("orders").update({ [colKey]: freshUrl }).eq("id", orderId)

      if (slot === 1) setRosterScreenshotUrl(freshUrl)
      else setRosterScreenshotUrl2(freshUrl)

      setMsg(`Screenshot ${slot} berhasil diperbarui!`)
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

  const handleDeleteScreenshot = async (slot: 1 | 2) => {
    const colKey = slot === 1 ? "roster_screenshot_url" : "roster_screenshot_url_2"
    await supabase.from("orders").update({ [colKey]: null }).eq("id", orderId)
    if (slot === 1) setRosterScreenshotUrl(null)
    else setRosterScreenshotUrl2(null)
  }

  const processUploadMockup = async (file: File, slot: 1 | 2 | 3) => {
    if (!file || !orderId) return
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih atau drag file gambar (JPG, PNG, WEBP).")
      return
    }

    setUploadingSlot(slot)
    setMsg("")

    try {
      const compressedBlob = await compressImage(file, 1600, 0.8)
      const fileName = `mockup-${orderId}-slot${slot}.webp`

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

      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      const columnKey = slot === 1 ? "mockup_url" : slot === 2 ? "mockup_url_2" : "mockup_url_3"

      await supabase.from("orders").update({ [columnKey]: freshUrl }).eq("id", orderId)

      if (slot === 1) setMockupUrl1(freshUrl)
      else if (slot === 2) setMockupUrl2(freshUrl)
      else setMockupUrl3(freshUrl)

      setMsg(`Mockup Gambar ${slot} berhasil diunggah!`)
    } catch (err: any) {
      setMsg("Gagal unggah: " + err.message)
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleUploadMockup = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) => {
    const file = e.target.files?.[0]
    if (file) processUploadMockup(file, slot)
  }

  const handleDeleteMockup = async (slot: 1 | 2 | 3) => {
    const columnKey = slot === 1 ? "mockup_url" : slot === 2 ? "mockup_url_2" : "mockup_url_3"
    await supabase.from("orders").update({ [columnKey]: null }).eq("id", orderId)
    if (slot === 1) setMockupUrl1(null)
    else if (slot === 2) setMockupUrl2(null)
    else setMockupUrl3(null)
  }

  // Helper Event Handlers Drag and Drop
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

  const handleDropMockup = (e: React.DragEvent, slot: 1 | 2 | 3) => {
    e.preventDefault()
    e.stopPropagation()
    setDragTarget(null)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadMockup(file, slot)
  }

  const handleDropScreenshot = (e: React.DragEvent, slot: 1 | 2) => {
    e.preventDefault()
    e.stopPropagation()
    setDragTarget(null)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadScreenshot(file, slot)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg("")

    try {
      const isPaid = downPayment >= totalPrice
      const finalFabric = fabricType === CUSTOM_OPTION_VALUE ? (customFabric.trim() || "Kain Kustom") : fabricType
      const finalCollar = collarType === CUSTOM_OPTION_VALUE ? (customCollar.trim() || "Kerah Kustom") : collarType

      const { error: oErr } = await supabase
        .from("orders")
        .update({
          order_title: orderTitle.trim(),
          customer_name: customerName.trim(),
          fabric_type: finalFabric,
          collar_type: finalCollar,
          deadline_date: deadlineDate,
          priority: priority,
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
          total_qty: matrixTotals.grandTotalPcs,
          total_price: totalPrice,
          down_payment: downPayment,
          is_paid_off: isPaid,
          production_notes: productionNotes,
          catatan_desain: catatanDesain.trim(),
          link_drive_aset: linkDriveAset.trim(),
          is_makloon: isMakloon,
          makloon_vendor_name: isMakloon ? makloonVendorName.trim() : null
        })
        .eq("id", orderId)

      if (oErr) throw oErr

      setMsg("Data pesanan dan kalkulasi harga berhasil disimpan!")
    } catch (err: any) {
      setMsg("Gagal menyimpan: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Fungsi Handler Pelacakan Konsumen & WhatsApp
  const trackingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/track/${orderNumber}`
    : `/track/${orderNumber}`

  const handleCopyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      alert("Gagal menyalin link otomatis.")
    }
  }

  const handleSendWA = () => {
    const cleanPhone = customerPhoneInput.replace(/[^0-9]/g, "")
    let waPhone = cleanPhone
    if (waPhone.startsWith("0")) {
      waPhone = "62" + waPhone.slice(1)
    }

    const messageText = `Halo Kak *${customerName || "Pelanggan"}*,\n\nBerikut adalah tautan pemantauan langsung (*live tracking*) untuk melihat progres pengerjaan pesanan jersey *${orderTitle || customerName}* di workshop kami:\n\n🔗 ${trackingUrl}\n\n📅 Target Estimasi Selesai: *${deadlineDate || "-"}*\n\nTerima kasih telah mempercayakan produksi Anda kepada kami! 🙏`

    const encodedMsg = encodeURIComponent(messageText)
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`

    window.open(waUrl, "_blank")
  }

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      alert("Alasan pembatalan wajib diisi.")
      return
    }
    setCancelling(true)
    try {
      const { error: cancelErr } = await supabase
        .from("orders")
        .update({
          current_status: "CANCELLED",
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId)

      if (cancelErr) throw cancelErr

      await supabase.from("production_logs").insert({
        order_id: orderId,
        stage: "CANCELLED",
        notes: `Pesanan dibatalkan. Alasan: ${cancelReason.trim()}`,
        operator_name: "Admin / Owner"
      })

      setCurrentStatus("CANCELLED")
      setShowCancelModal(false)
      setMsg("Pesanan berhasil dibatalkan dan telah resmi dikeluarkan dari antrean Kanban.")
    } catch (err: any) {
      alert("Gagal membatalkan pesanan: " + err.message)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono">Memuat detail pesanan...</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* 1. Header & Navigasi */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href={isDesignerRole ? "/orders/studio" : "/orders"}
            className="p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
            title={isDesignerRole ? "Kembali ke Studio Desain" : "Kembali ke Daftar Pesanan"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-900 leading-tight">Detail & Edit Pesanan</h1>
              <span className="font-mono text-xs bg-zinc-900 px-2 py-0.5 rounded font-black text-white shadow-2xs">
                {orderNumber}
              </span>
            </div>
            <p className="text-xs text-zinc-600">Kelola spesifikasi, matriks ukuran, rincian biaya, dan catatan roster.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={isDesignerRole ? "/orders/studio" : "/"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>{isDesignerRole ? "Studio Desain" : "Papan Kanban"}</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowTrackingModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Bagikan Tautan Pelacakan ke Konsumen"
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-700" />
            <span>Pelacakan & WA</span>
          </button>
          <Link
            href={`/orders/${orderId}/form-order`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-800 text-xs font-semibold shadow-2xs transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-600" />
            <span>Form Order (Konsumen)</span>
          </Link>
          <Link
            href={`/orders/${orderId}/spk`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak SPK</span>
          </Link>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded text-xs font-medium border flex items-center gap-2 ${
          msg.includes("berhasil") 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg.includes("berhasil") ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          <span>{msg}</span>
        </div>
      )}

      {/* BANNER PESANAN DIBATALKAN (CANCELLED) */}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 text-red-950 px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <strong className="block font-bold">Pesanan Ini Telah Dibatalkan (CANCELLED)</strong>
              <span className="text-[11px] text-red-800">Pesanan telah resmi dikeluarkan dari antrean Kanban dan terkunci untuk riwayat arsip.</span>
            </div>
          </div>
          <span className="font-mono text-[9px] font-bold bg-white text-red-800 border border-red-300 px-2 py-0.5 rounded uppercase shrink-0 shadow-2xs">
            DIBATALKAN
          </span>
        </div>
      )}

      {/* BANNER PESANAN TERKUNCI DALAM ARSIP (READ-ONLY) */}
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
      )}

      {/* BANNER KHUSUS OPERATOR DESAIN & SETTING */}
      {isDesignerRole && !isArchived && !isCancelled && (
        <div className="bg-blue-50 border border-blue-200 text-blue-950 px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <strong className="block font-bold">Mode Akses Desainer & Setting (Read-Only)</strong>
              <span className="text-[11px] text-blue-800">
                Spesifikasi dan harga dikunci untuk menjaga integritas data. Anda dapat meninjau ukuran/roster, mengunggah Mockup (Gambar 1, 2, 3), dan mencetak SPK.
              </span>
            </div>
          </div>
          <span className="font-mono text-[9px] font-bold bg-white text-blue-800 border border-blue-300 px-2 py-0.5 rounded uppercase shrink-0 shadow-2xs">
            DESAINER AKTIF
          </span>
        </div>
      )}

      {/* 2. Visual Stepper 8 Tahap Produksi */}
      <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-600" /> Alur Produksi 8 Tahap Workshop
          </span>
          <div>
            {currentStatus === "COMPLETED" ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Selesai & Diambil
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Posisi: {STAGES.find((s) => s.key === currentStatus)?.label || currentStatus.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 pt-1">
          {STAGES.map((st, idx) => {
            const isCompleted = activeStageIndex > idx
            const isCurrent = activeStageIndex === idx

            return (
              <div
                key={st.key}
                className={`p-2 rounded border transition-colors flex flex-col justify-between min-h-[58px] ${
                  isCurrent
                    ? `${st.accent} text-white border-transparent shadow-xs ring-2 ring-zinc-900/10`
                    : isCompleted
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-zinc-50 border-zinc-200 text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[9px] font-black ${
                    isCurrent ? "text-white/80" : isCompleted ? "text-emerald-700" : "text-zinc-400"
                  }`}>
                    {st.code}
                  </span>
                  {isCompleted && (
                    <span className="h-3.5 w-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  {isCurrent && (
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>

                <div className="mt-1">
                  <span className={`text-[10px] font-bold block leading-tight truncate ${
                    isCurrent ? "text-white" : isCompleted ? "text-emerald-950" : "text-zinc-600"
                  }`}>
                    {st.label}
                  </span>
                  <span className={`text-[8.5px] block font-mono ${
                    isCurrent ? "text-white/80" : isCompleted ? "text-emerald-600" : "text-zinc-400"
                  }`}>
                    {isCurrent ? "Sedang Proses" : isCompleted ? "Selesai" : "Menunggu"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Galeri Mockup Desain (3 Slot) - DENGAN FITUR DRAG AND DROP & KLIK */}
      <div className="border border-zinc-200 bg-white p-3.5 rounded shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-zinc-600" /> Galeri Mockup Desain (Maksimal 3 Gambar)
          </span>
          <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
            Tarik & Lepas (Drag & Drop) file gambar langsung ke kotak di bawah
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Slot 1 */}
          <div
            onDragOver={(e) => handleDragOver(e, "mockup-1")}
            onDragLeave={(e) => handleDragLeave(e, "mockup-1")}
            onDrop={(e) => handleDropMockup(e, 1)}
            className={`border rounded p-2.5 transition-all relative space-y-2 ${
              dragTarget === "mockup-1"
                ? "border-blue-600 bg-blue-50 ring-2 ring-blue-400 scale-[1.01]"
                : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 1 (Utama)</span>
              {mockupUrl1 && (
                <button type="button" onClick={() => handleDeleteMockup(1)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl1 ? (
              <div className="h-36 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white relative overflow-hidden group">
                <img src={mockupUrl1} alt="Gambar 1" className="h-full w-full object-contain" />
                {dragTarget === "mockup-1" && (
                  <div className="absolute inset-0 bg-blue-600/80 backdrop-blur-2xs flex items-center justify-center text-white font-bold text-xs animate-in fade-in">
                    Lepas File untuk Ganti Gambar 1
                  </div>
                )}
              </div>
            ) : (
              <div className={`h-36 border-2 border-dashed rounded flex flex-col items-center justify-center text-xs transition-colors p-2 text-center ${
                dragTarget === "mockup-1" ? "border-blue-500 bg-blue-100/50 text-blue-700 font-bold" : "border-zinc-300 text-zinc-500"
              }`}>
                <UploadCloud className={`h-6 w-6 mb-1 ${dragTarget === "mockup-1" ? "text-blue-600 animate-bounce" : "text-zinc-400"}`} />
                <span>{dragTarget === "mockup-1" ? "Lepas File di Sini!" : "Drag & drop gambar ke sini"}</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-xs font-medium transition-colors shadow-2xs">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{uploadingSlot === 1 ? "Mengunggah..." : mockupUrl1 ? "Pilih Gambar Lain" : "Unggah Gambar 1"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 1)} disabled={uploadingSlot === 1} className="hidden" />
            </label>
          </div>

          {/* Slot 2 */}
          <div
            onDragOver={(e) => handleDragOver(e, "mockup-2")}
            onDragLeave={(e) => handleDragLeave(e, "mockup-2")}
            onDrop={(e) => handleDropMockup(e, 2)}
            className={`border rounded p-2.5 transition-all relative space-y-2 ${
              dragTarget === "mockup-2"
                ? "border-blue-600 bg-blue-50 ring-2 ring-blue-400 scale-[1.01]"
                : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 2 (Opsional)</span>
              {mockupUrl2 && (
                <button type="button" onClick={() => handleDeleteMockup(2)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl2 ? (
              <div className="h-36 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white relative overflow-hidden group">
                <img src={mockupUrl2} alt="Gambar 2" className="h-full w-full object-contain" />
                {dragTarget === "mockup-2" && (
                  <div className="absolute inset-0 bg-blue-600/80 backdrop-blur-2xs flex items-center justify-center text-white font-bold text-xs animate-in fade-in">
                    Lepas File untuk Ganti Gambar 2
                  </div>
                )}
              </div>
            ) : (
              <div className={`h-36 border-2 border-dashed rounded flex flex-col items-center justify-center text-xs transition-colors p-2 text-center ${
                dragTarget === "mockup-2" ? "border-blue-500 bg-blue-100/50 text-blue-700 font-bold" : "border-zinc-300 text-zinc-500"
              }`}>
                <UploadCloud className={`h-6 w-6 mb-1 ${dragTarget === "mockup-2" ? "text-blue-600 animate-bounce" : "text-zinc-400"}`} />
                <span>{dragTarget === "mockup-2" ? "Lepas File di Sini!" : "Drag & drop gambar ke sini"}</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-xs font-medium transition-colors shadow-2xs">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{uploadingSlot === 2 ? "Mengunggah..." : mockupUrl2 ? "Pilih Gambar Lain" : "Unggah Gambar 2"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 2)} disabled={uploadingSlot === 2} className="hidden" />
            </label>
          </div>

          {/* Slot 3 */}
          <div
            onDragOver={(e) => handleDragOver(e, "mockup-3")}
            onDragLeave={(e) => handleDragLeave(e, "mockup-3")}
            onDrop={(e) => handleDropMockup(e, 3)}
            className={`border rounded p-2.5 transition-all relative space-y-2 ${
              dragTarget === "mockup-3"
                ? "border-blue-600 bg-blue-50 ring-2 ring-blue-400 scale-[1.01]"
                : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-700">Gambar 3 (Opsional)</span>
              {mockupUrl3 && (
                <button type="button" onClick={() => handleDeleteMockup(3)} className="text-zinc-400 hover:text-red-600 p-0.5" title="Hapus Gambar">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mockupUrl3 ? (
              <div className="h-36 border border-zinc-200 rounded p-1 flex items-center justify-center bg-white relative overflow-hidden group">
                <img src={mockupUrl3} alt="Gambar 3" className="h-full w-full object-contain" />
                {dragTarget === "mockup-3" && (
                  <div className="absolute inset-0 bg-blue-600/80 backdrop-blur-2xs flex items-center justify-center text-white font-bold text-xs animate-in fade-in">
                    Lepas File untuk Ganti Gambar 3
                  </div>
                )}
              </div>
            ) : (
              <div className={`h-36 border-2 border-dashed rounded flex flex-col items-center justify-center text-xs transition-colors p-2 text-center ${
                dragTarget === "mockup-3" ? "border-blue-500 bg-blue-100/50 text-blue-700 font-bold" : "border-zinc-300 text-zinc-500"
              }`}>
                <UploadCloud className={`h-6 w-6 mb-1 ${dragTarget === "mockup-3" ? "text-blue-600 animate-bounce" : "text-zinc-400"}`} />
                <span>{dragTarget === "mockup-3" ? "Lepas File di Sini!" : "Drag & drop gambar ke sini"}</span>
              </div>
            )}
            <label className="cursor-pointer w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded text-xs font-medium transition-colors shadow-2xs">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{uploadingSlot === 3 ? "Mengunggah..." : mockupUrl3 ? "Pilih Gambar Lain" : "Unggah Gambar 3"}</span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadMockup(e, 3)} disabled={uploadingSlot === 3} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <fieldset disabled={isLocked || isDesignerRole} className="space-y-4 border-0 p-0 m-0 disabled:opacity-90 contents">
        {/* Parameter Utama 3 Kolom */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <label className="block text-zinc-600 font-medium mb-1">Target Deadline</label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-mono text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Kolom 3: Biaya & Pembayaran (Kalkulator Cerdas Mekanisme B) */}
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
                Pembaruan angka otomatis memperbarui total order. Kolom celana aktif jika memilih paket Stelan.
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
                        onClick={() => handleDeleteScreenshot(1)}
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
                        onClick={() => handleDeleteScreenshot(2)}
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

                </fieldset>

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
              href={isDesignerRole ? "/orders/studio" : "/orders"}
              className="px-4 py-2 text-xs font-medium border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
            >
              {isArchived ? "Kembali ke Daftar Pesanan" : isDesignerRole ? "Kembali ke Studio Desain" : "Kembali"}
            </Link>

            {!isLocked && !isDesignerRole && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
                >
                  Batalkan Pesanan
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2 rounded shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Menyimpan Perubahan..." : "Simpan Pembaruan Data"}
                </button>
              </>
            )}
          </div>
        </div>
</form>
      {/* MODAL PELACAKAN KONSUMEN & BERBAGI WHATSAPP */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-lg shadow-xl max-w-md w-full p-4 space-y-3.5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <Share2 className="h-4 w-4 text-emerald-600" />
                <span>Pelacakan Pesanan & Berbagi ke Konsumen</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowTrackingModal(false)} 
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Bagikan link pelacakan langsung (*live tracking*) kepada pemesan <strong className="text-zinc-900">{customerName}</strong> ({orderTitle || orderNumber}) agar konsumen dapat melihat progres tanpa membebani CS.
            </p>

            {/* Input Link & Salin */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-zinc-700">Link Pelacakan Konsumen:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={trackingUrl}
                  className="flex-1 px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-mono bg-zinc-50 text-zinc-800 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copiedLink ? "✓ Tersalin!" : "Salin Link"}</span>
                </button>
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 border border-zinc-300 rounded hover:bg-zinc-100 text-zinc-700 shrink-0"
                  title="Buka Tampilan Konsumen"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Kirim WhatsApp 1-Klik */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 space-y-2">
              <span className="text-xs font-bold text-emerald-950 block">Kirim Pesan Otomatis via WhatsApp</span>
              <div>
                <label className="block text-[10.5px] font-medium text-emerald-900 mb-0.5">
                  Nomor WhatsApp Konsumen (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="08xxxxxxxxxx (Boleh dikosongkan untuk pilih kontak manual)"
                  value={customerPhoneInput}
                  onChange={(e) => setCustomerPhoneInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded text-xs font-mono bg-white text-zinc-900 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSendWA}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold py-2 transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Kirim Link via WhatsApp</span>
              </button>
            </div>

            <div className="flex justify-end pt-1 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowTrackingModal(false)}
                className="px-3.5 py-1.5 border border-zinc-200 rounded text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIALOG KONFIRMASI PEMBATALAN PESANAN */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-lg shadow-xl max-w-sm w-full p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Konfirmasi Pembatalan Pesanan</span>
              </div>
              <button type="button" onClick={() => setShowCancelModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Pesanan <strong className="text-zinc-900 font-mono">{orderNumber}</strong> ({orderTitle || customerName}) akan dihentikan dan dikeluarkan dari papan produksi Kanban.
            </p>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-zinc-700">Alasan Pembatalan (Wajib):</label>
              <textarea
                rows={3}
                placeholder="Contoh: Konsumen membatalkan sepihak, DP Rp 300.000 hangus..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-red-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 border border-zinc-200 rounded text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancelOrder}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50 shadow-2xs"
              >
                {cancelling ? "Membatalkan..." : "Ya, Batalkan Pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
