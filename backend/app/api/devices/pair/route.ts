import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({
  pairing_code: z.string().length(6),
});

// POST /api/devices/pair — user enters code on phone/web to link TV to account
export async function POST(req: NextRequest) {
  const { profile, error: authError } = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const { pairing_code } = parsed.data;

  const { data: device, error } = await supabaseAdmin
    .from("devices")
    .select("id, pairing_expires_at, profile_id")
    .eq("pairing_code", pairing_code.toUpperCase())
    .single();

  if (error || !device) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }

  if (new Date(device.pairing_expires_at!) < new Date()) {
    return NextResponse.json({ error: "Code expired" }, { status: 410 });
  }

  if (device.profile_id && device.profile_id !== profile!.id) {
    return NextResponse.json({ error: "Device already paired to another account" }, { status: 409 });
  }

  await supabaseAdmin
    .from("devices")
    .update({
      profile_id: profile!.id,
      pairing_code: null,        // consume the code
      pairing_expires_at: null,
      paired_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  return NextResponse.json({ success: true, device_id: device.id });
}

// GET /api/devices/pair?code=ABC123 — TV polls this to know when it's been paired
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const { data: device } = await supabaseAdmin
    .from("devices")
    .select("id, profile_id, paired_at")
    .eq("pairing_code", code.toUpperCase())
    .single();

  if (!device) {
    // Code was consumed — check if it recently got paired
    return NextResponse.json({ paired: false });
  }

  const paired = !!device.profile_id && !device.paired_at === false;
  return NextResponse.json({ paired });
}
