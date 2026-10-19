"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { 
  Inbox,
  Menu, 
  X, 
  Plus, 
  KanbanSquare, 
  ClipboardList, 
  QrCode, 
  Users2, 
  TrendingUp,
  Settings,
  LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState("ADMIN")
  const [inboxCount, setInboxCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    async function fetchRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()
        if (data?.role) {
          setUserRole(data.role.toUpperCase())
        }
      }

      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("current_status", "ORDER_INBOX")
      if (count !== null) setInboxCount(count)
    }
    fetchRole()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (pathname.startsWith("/track") || pathname === "/login") {
    return null
  }

  const isOperator = 
    userRole.includes("OPERATOR") || 
    userRole === "SEWING_SUPERVISOR" || 
    userRole === "QC"

  const navigation = [
    ...(!isOperator ? [
      { 
      name: "Order Masuk", 
      href: "/orders/inbox", 
      icon: Inbox,
      badge: inboxCount > 0 ? inboxCount : null
    },
      { name: "Antrean Produksi", href: "/", icon: KanbanSquare },
      { name: "Daftar Pesanan", href: "/orders", icon: ClipboardList },
    ] : []),
    { name: "Scan SPK Produksi", href: "/kiosk", icon: QrCode },
    ...(!isOperator ? [
      { name: "Partner Makloon", href: "/makloon", icon: Users2 },
    ] : []),
    ...(userRole === "OWNER" ? [
      { name: "Laporan & Evaluasi", href: "/analytics", icon: TrendingUp },
      { name: "Pengaturan Sistem", href: "/settings", icon: Settings },
    ] : []),
  ]

  const getPageTitle = () => {
    if (pathname === "/") return "Pipeline Antrean Produksi"
    if (pathname.startsWith("/orders")) return "Daftar & Detail Pesanan"
    if (pathname === "/kiosk") return "Scan SPK Produksi"
    if (pathname === "/makloon") return "Partner Makloon Luar"
    if (pathname === "/analytics") return "Laporan & Evaluasi"
    if (pathname.startsWith("/settings")) return "Pengaturan Sistem"
    return "Dashboard"
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-16 border-b border-zinc-200/80 bg-white/95 backdrop-blur px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden p-1.5 text-zinc-600 hover:text-zinc-900 rounded hover:bg-zinc-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 font-mono uppercase text-[10px]">Pos:</span>
            <span className="font-bold text-zinc-900">
              {getPageTitle()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!isOperator && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Order Baru</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="lg:hidden p-1.5 text-zinc-500 hover:text-red-600 rounded"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm font-bold text-zinc-900">Manayra OS</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded text-xs font-medium",
                      isActive ? "bg-zinc-900 text-white font-semibold" : "text-zinc-700 hover:bg-zinc-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </div>
                    {(item as any).badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white">
                        {(item as any).badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
