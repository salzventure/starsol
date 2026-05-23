import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import crypto from "crypto";

// POST /api/devices — TV registers itself and gets a pairing code
const registerSchema = z.object({
  platform: z.enum(["google_tv", "fire_tv", "apple_tv", "roku"]),
  device_fingerprint: z.string().min(8),
  device_name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();

  // This endpoint is called from the TV before auth — it creates an unpaired device
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { platform, device_fingerprint, device_name } = parsed.data;

  // Generate a short human-readable pairing code
  const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Hash the fingerprint before storing
  const hashedFingerprint = crypto
    .createHash("sha256")
    .update(device_fingerprint)
    .digest("hex");

  const { data, error } = await supabaseAdmin
    .from("devices")
    .upsert(
      {
        platform,
        device_fingerprint: hashedFingerprint,
        device_name: device_name ?? `${platform.replace("_", " ")} TV`,
        pairing_code: pairingCode,
        pairing_expires_at: expiresAt.toISOString(),
        profile_id: null, // will be set when user pairs
      },
      { onConflict: "device_fingerprint" }
    )
    .select("id, pairing_code, pairing_expires_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
  }

  return NextResponse.json(data);
}
