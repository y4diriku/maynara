import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: "ID Pengguna wajib disertakan." }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Kunci rahasia SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di file .env.local" }, 
        { status: 500 }
      )
    }

    // Menggunakan kunci Service Role untuk bypass keamanan standar dan masuk sebagai Super Admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Menghapus akun login dari tabel auth.users
    // (Data di tabel 'profiles' akan ikut terhapus otomatis berkat relasi ON DELETE CASCADE di database)
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      throw error
    }

    return NextResponse.json({ message: "Akses staf berhasil dicabut permanen.", data })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
