import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "starsol-api",
    timestamp: new Date().toISOString(),
  });
}
