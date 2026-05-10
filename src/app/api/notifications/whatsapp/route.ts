import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "psat" } }
)

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) return "62" + digits.slice(1)
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("8")) return "62" + digits
  return digits
}

async function sendWA(target: string, message: string) {
  const token = process.env.FONNTE_TOKEN
  if (!token || !target) return

  const cleaned = cleanPhone(target)
  if (!cleaned) return

  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target: cleaned, message }),
  })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bearerToken = authHeader.slice(7)
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(bearerToken)
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { type } = body

  try {
    if (type === "guru_submit") {
      // Guru kirim soal → kirim WA ke semua validator yang handle mapel ini
      const { mapelId, guruId } = body as { mapelId: string; guruId: string }

      // Ambil nama guru dan nama mapel
      const [{ data: guruProfile }, { data: mapelData }] = await Promise.all([
        supabaseAdmin.from("profiles").select("nama").eq("id", guruId).single(),
        supabaseAdmin
          .from("mata_pelajaran" as any)
          .select("nama")
          .eq("id", mapelId)
          .single(),
      ])

      const guruNama = guruProfile?.nama || "Guru"
      const mapelNama = (mapelData as any)?.nama || "mapel"

      // Cari semua validator untuk mapel ini beserta nomor WA-nya
      const { data: validatorRows } = await supabaseAdmin
        .from("psat_validator_mapel")
        .select("validator_id")
        .eq("mapel_id", mapelId)

      if (validatorRows && validatorRows.length > 0) {
        const validatorIds = validatorRows.map((r: any) => r.validator_id)

        const { data: validatorContacts } = await supabaseAdmin
          .from("psat_guru_data")
          .select("profile_id, whatsapp")
          .in("profile_id", validatorIds)

        const message =
          `Halo! Ada soal *${mapelNama}* dari *${guruNama}* yang menunggu validasi.\n\n` +
          `Silakan login ke sistem PSAT untuk memeriksa soal tersebut.`

        await Promise.all(
          (validatorContacts ?? [])
            .filter((v: any) => v.whatsapp)
            .map((v: any) => sendWA(v.whatsapp, message))
        )
      }

    } else if (type === "needs_revision") {
      // Validator kirim revisi → kirim WA ke guru pemilik soal
      const { guruId, mapelNama, catatanRevisi } = body as {
        guruId: string
        mapelNama: string
        catatanRevisi: string
      }

      const { data: guruContact } = await supabaseAdmin
        .from("psat_guru_data")
        .select("whatsapp")
        .eq("profile_id", guruId)
        .maybeSingle()

      const { data: guruProfile } = await supabaseAdmin
        .from("profiles")
        .select("nama")
        .eq("id", guruId)
        .single()

      const guruNama = guruProfile?.nama || "Guru"

      const message =
        `Halo *${guruNama}*! Soal *${mapelNama}* Anda memerlukan revisi.\n\n` +
        `📝 Catatan: ${catatanRevisi}\n\n` +
        `Silakan login ke sistem PSAT untuk melihat dan memperbaiki soal tersebut.`

      if (guruContact?.whatsapp) {
        await sendWA(guruContact.whatsapp, message)
      }

    } else if (type === "request_matrix_edit") {
      const { guruNama, mapelNama } = body as { guruNama: string; mapelNama: string }

      const message =
        `Halo Admin! *${guruNama}* (Mapel: *${mapelNama}*) ingin mengedit matrix.\n\n` +
        `Silakan login ke sistem PSAT untuk membuka kunci edit matrix guru tersebut.`

      // Kumpulkan nomor admin dari DB
      const targets = new Set<string>()

      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin")

      if (adminProfiles && adminProfiles.length > 0) {
        const adminIds = adminProfiles.map((a: any) => a.id)
        const { data: adminContacts } = await supabaseAdmin
          .from("psat_guru_data")
          .select("whatsapp")
          .in("profile_id", adminIds)
        ;(adminContacts ?? []).forEach((a: any) => { if (a.whatsapp) targets.add(cleanPhone(a.whatsapp)) })
      }

      // Fallback: nomor admin dari env var
      const envPhone = process.env.ADMIN_WHATSAPP
      if (envPhone) targets.add(cleanPhone(envPhone))

      await Promise.all([...targets].map(phone => sendWA(phone, message)))

    } else {
      return NextResponse.json({ error: "Unknown type" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    // Jangan gagalkan request utama karena notifikasi WA error
    console.error("WA notification error:", e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
