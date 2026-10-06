"use client"

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
  const [checkingAuth, setCheckingAuth] = useState(true)

  const isPrintPage = pathname.includes("/spk")
  const isPublicPage = pathname.startsWith("/track") || pathname === "/login"

  useEffect(() => {
    let isMounted = true

    async function verifyAuth() {
      if (isPublicPage) {
        if (isMounted) setCheckingAuth(false)
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.replace("/login")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()

        const userRole = (profile?.role || "ADMIN").toUpperCase()
        const isOperatorRole =
          userRole.includes("OPERATOR") ||
          userRole === "SEWING_SUPERVISOR" ||
          userRole === "QC"

        if (isOperatorRole && pathname !== "/kiosk") {
          router.replace("/kiosk")
          return
        }
      } catch (err) {
        console.error("Auth check error:", err)
      } finally {
        if (isMounted) setCheckingAuth(false)
      }
    }

    verifyAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !isPublicPage) {
        router.replace("/login")
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
        {checkingAuth && !isPublicPage ? (
          <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-xs">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              <span>Memverifikasi wewenang akses...</span>
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
              <main className="flex-1 overflow-y-auto p-4 md:p-5 print:p-0 print:m-0 print:overflow-visible">
                {children}
              </main>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}
