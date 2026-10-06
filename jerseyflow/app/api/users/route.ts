import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { email, password, fullName, role } = await req.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Semua kolom wajib diisi." }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!serviceRoleKey) {
      return NextResponse.json({ 
        error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di .env.local server." 
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role.toUpperCase() }
    })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    if (userData?.user) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userData.user.id,
          full_name: fullName,
          role: role.toUpperCase()
        })

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, user: userData.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
