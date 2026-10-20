"use client"

import DisplayScaleWidget from "@/components/DisplayScaleWidget"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import "./globals.css"
import { Sidebar } from "@/components/Sidebar"
import { Header } from "@/components/Header"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  
  // Status otentikasi
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const isPrintPage = pathname.includes("/spk")
  const isPublicPage = pathname.startsWith("/track") || pathname === "/login"

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      // Halaman publik bebas akses langsung tanpa blocking loader
      if (isPublicPage) {
        if (isMounted) setIsAuthenticated(true)
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          if (isMounted) setIsAuthenticated(false)
          router.replace("/login")
          return
        }

        // Pengguna memiliki sesi aktif
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()

        const userRole = (profile?.role || "ADMIN").toUpperCase()
        const isDesigner = userRole.includes("DESIGN") || userRole === "OPERATOR_DESIGN" || userRole === "DESIGNER"
        const isOperatorRole =
          (userRole.includes("OPERATOR") && !isDesigner) ||
          userRole === "SEWING_SUPERVISOR" ||
          userRole === "QC"

        // Jika operator umum dilarang selain ke kiosk.
        // Jika desainer: izinkan akses studio (/orders/studio) dan detail/SPK order (/orders/[id]), 
        // tetapi larang akses ke list order CS (/orders), buat order baru (/orders/new), dan inbox (/orders/inbox).
        const isDesignerDetailOrSpk =
          pathname.startsWith("/orders/") &&
          !pathname.startsWith("/orders/new") &&
          !pathname.startsWith("/orders/inbox") &&
          pathname !== "/orders"

        const isDesignerAllowed = pathname.startsWith("/orders/studio") || isDesignerDetailOrSpk

        if (isDesigner && !isDesignerAllowed) {
          router.replace("/orders/studio")
          return
        }

        if (isOperatorRole && pathname !== "/kiosk") {
          router.replace("/kiosk")
          return
        }

        if (isMounted) setIsAuthenticated(true)
      } catch (err) {
        console.error("Auth check error:", err)
        if (isMounted) setIsAuthenticated(false)
        router.replace("/login")
      }
    }

    checkSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !isPublicPage) {
        setIsAuthenticated(false)
        router.replace("/login")
      } else if (event === "SIGNED_IN") {
        setIsAuthenticated(true)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [pathname, isPublicPage, router])

  return (
    <html lang="id">
      <body className="bg-zinc-50 text-zinc-900 font-sans antialiased m-0 p-0">
        {/* JIKA BUKAN HALAMAN PUBLIK & BELUM TEROTENTIKASI: TAHAN RENDER AGAR TIDAK FLICKER */}
        {!isPublicPage && isAuthenticated !== true ? (
          <div className="flex h-screen w-screen items-center justify-center bg-white text-zinc-600 font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-zinc-500 font-medium">Memverifikasi sesi sistem...</span>
            </div>
          </div>
        ) : isPrintPage ? (
          <div className="bg-white text-black min-h-screen">
            {children}
          </div>
        ) : isPublicPage ? (
          <div className="min-h-screen">
            {children}
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <div className="print:hidden">
              <Sidebar />
            </div>
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="print:hidden">
                <Header />
              </div>
              <main className="flex-1 overflow-y-auto p-3 md:p-4 print:p-0 print:m-0 print:overflow-visible">
                {children}
              </main>
            </div>
          </div>
        )}
              <DisplayScaleWidget />
      </body>
    </html>
  )
}