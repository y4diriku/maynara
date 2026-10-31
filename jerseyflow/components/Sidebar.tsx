"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  Inbox,
  Palette,
  KanbanSquare, 
  ClipboardList, 
  QrCode, 
  Users2, 
  TrendingUp, 
  LogOut,
  UserCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null)
  const [brandName, setBrandName] = useState("Manayra")
  const [brandTagline, setBrandTagline] = useState("Workshop OS")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [inboxCount, setInboxCount] = useState(0)
  const [designTaskCount, setDesignTaskCount] = useState(0)

    useEffect(() => {
    const savedState = localStorage.getItem("sidebar_collapsed")
    if (savedState !== null) {
      setIsCollapsed(savedState === "true")
    }

    let currentUserId = ""
    let currentUserRole = ""

    async function fetchDesignTaskCount(uid: string, uRole: string) {
      if (!uid) return
      const r = uRole.toUpperCase()
      const isDes = r.includes("DESIGN") || r === "OPERATOR_DESIGN" || r === "DESIGNER"
      if (!isDes) return

      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("current_status", "DESIGN_QUEUE")
        .eq("assigned_designer_id", uid)

      if (count !== null) setDesignTaskCount(count)
    }

    async function fetchInboxCount() {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("current_status", "ORDER_INBOX")
      if (count !== null) setInboxCount(count)
    }

    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .single()

        if (data) {
          const uRole = (data.role || "ADMIN").toUpperCase()
          currentUserId = session.user.id
          currentUserRole = uRole

          setProfile({
            full_name: data.full_name || session.user.email?.split("@")[0] || "Staf",
            role: uRole
          })

          fetchDesignTaskCount(session.user.id, uRole)
        }
      }

      const { data: settings } = await supabase.from("system_settings").select("*")
      if (settings) {
        settings.forEach((s) => {
          if (s.key === "brand_name" && s.value) setBrandName(s.value)
          if (s.key === "brand_tagline" && s.value) setBrandTagline(s.value)
          if (s.key === "brand_logo_url" && s.value) setLogoUrl(s.value)
        })
      }
    }

    loadData()
    fetchInboxCount()

    const ordersChan = supabase
      .channel("sidebar_realtime_counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchInboxCount()
        if (currentUserId) fetchDesignTaskCount(currentUserId, currentUserRole)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChan)
    }
  }, [])

  const toggleSidebar = () => {
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
    localStorage.setItem("sidebar_collapsed", String(nextState))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (pathname.startsWith("/track") || pathname === "/login") {
    return null
  }

  const role = (profile?.role || "ADMIN").toUpperCase()

  const isDesigner = role === "OPERATOR_DESIGN" || role === "DESIGNER"

  const navigation = [
    ...(isDesigner ? [
      { 
        name: "Tugas Desain Saya", 
        href: "/orders/studio", 
        icon: Palette,
        badge: designTaskCount > 0 ? designTaskCount : null
      },
    ] : []),
    ...(role === "OWNER" || role === "ADMIN" ? [
      { 
        name: "Order Masuk", 
        href: "/orders/inbox", 
        icon: Inbox,
        badge: inboxCount > 0 ? inboxCount : null
      },
      { name: "Antrean Produksi", href: "/", icon: KanbanSquare },
      { name: "Daftar Pesanan", href: "/orders", icon: ClipboardList },
    ] : []),
    ...(!isDesigner ? [
      { name: "Scan SPK Produksi", href: "/kiosk", icon: QrCode },
    ] : []),
    ...(role === "OWNER" || role === "ADMIN" ? [
      { name: "Distribusi Jahit", href: "/makloon", icon: Users2 },
    ] : []),
    ...(role === "OWNER" ? [
      { name: "Laporan & Evaluasi", href: "/analytics", icon: TrendingUp },
      { name: "Pengaturan Sistem", href: "/settings", icon: Settings },
    ] : []),
  ]

  return (
    <aside 
      className={cn(
        "hidden lg:flex flex-col border-r border-zinc-200 bg-white h-screen select-none transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn(
        "h-16 border-b border-zinc-200/80 flex items-center transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "px-4 gap-3"
      )}>
        <div className="h-10 w-10 flex items-center justify-center shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-zinc-900 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-sm">
              MNR
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div className="min-w-0 overflow-hidden">
            <h1 className="text-sm font-black tracking-tight text-zinc-900 leading-tight truncate">
              {brandName}
            </h1>
            <span className="text-[11px] text-zinc-500 font-medium leading-none block truncate mt-0.5">
              {brandTagline}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {!isCollapsed && (
          <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Pos Kerja
          </div>
        )}
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "group flex items-center rounded transition-colors text-xs font-medium relative",
                isCollapsed 
                  ? "justify-center h-10 w-10 mx-auto" 
                  : "gap-2.5 px-3 py-2",
                isActive
                  ? "bg-zinc-900 text-white font-semibold shadow-2xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-900")} />
              
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{item.name}</span>
                  {(item as any).badge && (
                    <span className={cn(
                      "ml-auto px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold text-white",
                      item.href === "/orders/studio" ? "bg-blue-600" : "bg-amber-500"
                    )}>
                      {(item as any).badge}
                    </span>
                  )}
                </div>
              )}

              {/* Badge kecil saat sidebar ditutup (collapsed) */}
              {isCollapsed && (item as any).badge && (
                <span className={cn(
                  "absolute top-1 right-1 h-4 w-4 rounded-full text-white text-[8px] font-mono font-bold flex items-center justify-center shadow-xs",
                  item.href === "/orders/studio" ? "bg-blue-600" : "bg-amber-500"
                )}>
                  {(item as any).badge}
                </span>
              )}

              {isCollapsed && (
                <div className="absolute left-full ml-2 hidden group-hover:flex items-center px-2 py-1 bg-zinc-900 text-white text-[11px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                  {item.name}
                </div>
              )}
            </Link>
          )
        })}

        <div className="pt-2 mt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={toggleSidebar}
            title={isCollapsed ? "Buka Sidebar" : undefined}
            className={cn(
              "group flex items-center rounded transition-colors text-xs font-medium w-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              isCollapsed ? "justify-center h-10 w-10 mx-auto relative" : "gap-2.5 px-3 py-2"
            )}
          >
            {isCollapsed ? (
              <>
                <PanelLeftOpen className="h-4 w-4 shrink-0" />
                <div className="absolute left-full ml-2 hidden group-hover:flex items-center px-2 py-1 bg-zinc-900 text-white text-[11px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                  Buka Sidebar
                </div>
              </>
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="truncate">Tutup Sidebar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className={cn(
        "border-t border-zinc-200 bg-zinc-50/70 transition-all duration-300",
        isCollapsed ? "p-2 space-y-2 flex flex-col items-center" : "p-3 space-y-2"
      )}>
        <div className={cn("flex items-center justify-between w-full", isCollapsed && "flex-col gap-2")}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-700 shrink-0 shadow-2xs">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-800 leading-tight truncate">
                  {profile?.full_name || "Staf Workshop"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono leading-tight font-bold">
                  {role}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Keluar / Logout"
            className="text-zinc-500 hover:text-red-600 p-1.5 rounded hover:bg-zinc-200/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {!isCollapsed ? (
          <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 text-[10px] text-zinc-500 font-mono">
            <span>Status Sistem:</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>
        ) : (
          <div className="pt-1 border-t border-zinc-200 w-full flex justify-center" title="Sistem Online">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        )}
      </div>
    </aside>
  )
}
export { Sidebar }
