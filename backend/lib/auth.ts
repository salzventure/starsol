import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "./supabase";
import { NextResponse } from "next/server";

// Get the current user's StarSol profile (creates it if missing)
export async function getProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("*, subscriptions(*)")
    .eq("clerk_user_id", userId)
    .single();

  return data;
}

// Require auth in API routes — returns 401 if not signed in
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    return {
      profile: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getProfile();
  return { profile, error: null };
}

// Check if a profile has access to a given content tier
export function hasAccess(
  profileTier: string | null,
  requiredTier: string
): boolean {
  const order = ["free", "explorer", "observer", "institutional"];
  const profileIdx = order.indexOf(profileTier ?? "free");
  const requiredIdx = order.indexOf(requiredTier);
  return profileIdx >= requiredIdx;
}
