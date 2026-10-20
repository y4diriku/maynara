export const FABRIC_OPTIONS = [
  "Milano",
  "Brazil",
  "Embosh Topo",
  "Airwalk Biasa",
  "Airwalk Finis",
  "Polimes Biasa",
  "Polimesh Finis",
  "Serena",
  "Spandex Lycra",
  "Jaguard Timnas",
  "Smash",
  "Embosh Straw",
  "Benzema",
]

export const COLLAR_OPTIONS = [
  "O Neck",
  "V Neck",
  "V Neck (Tumpul)",
  "V Neck Tumpang",
  "V Neck Tumpang (Tumpul)",
  "Kerah Shanghai",
  "V Neck Wangki",
  "V Neck (Tumpul) Wangki",
  "Wangki Tali",
  "Wangki Sleting",
  "Wangki Kancing",
]

export const CUSTOM_OPTION_VALUE = "__CUSTOM__"

export const INK_PROFILES = {
  ORI: ["952", "2 PAS"],
  CINA: ["2 PAS", "2 PAS BARU"],
} as const

export const ADULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"]
export const KID_SIZES = ["S Anak", "M Anak", "L Anak", "XL Anak"]

export interface PresetModelItem {
  key: string
  label: string
  category: "jersey" | "jaket" | "celana"
}

export const PRESET_MODELS: PresetModelItem[] = [
  { key: "Lengan Pendek", label: "Lengan Pendek", category: "jersey" },
  { key: "Lengan Panjang", label: "Lengan Panjang", category: "jersey" },
  { key: "Raglan Pendek", label: "Raglan Pendek", category: "jersey" },
  { key: "Raglan Panjang", label: "Raglan Panjang", category: "jersey" },
  { key: "Jaket Oblong", label: "Jaket Oblong", category: "jaket" },
  { key: "Jaket Oblong (+Kupluk)", label: "Jaket Oblong (+Kupluk)", category: "jaket" },
  { key: "Jaket Raglan", label: "Jaket Raglan", category: "jaket" },
  { key: "Jaket Raglan (+Kupluk)", label: "Jaket Raglan (+Kupluk)", category: "jaket" },
  { key: "Celana Pendek", label: "Celana Pendek", category: "celana" },
  { key: "Celana Training", label: "Celana Training", category: "celana" },
]
