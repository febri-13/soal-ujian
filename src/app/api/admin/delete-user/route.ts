import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "psat" } }
)

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7)
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)
  if (!caller) return null

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin") return null
  return caller
}

export async function DELETE(req: NextRequest) {
  const caller = await verifyAdmin(req)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { userIds } = body as { userIds: string[] }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds wajib diisi" }, { status: 400 })
  }

  // Prevent admin from deleting themselves
  if (userIds.includes(caller.id)) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 })
  }

  const errors: string[] = []
  for (const uid of userIds) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (error) errors.push(`${uid}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Sebagian gagal dihapus", details: errors }, { status: 207 })
  }

  return NextResponse.json({ success: true, deleted: userIds.length })
}
