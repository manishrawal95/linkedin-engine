import { backendFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await backendFetch("/ideas");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET /api/linkedin/ideas:", err);
    return NextResponse.json(
      { detail: "Failed to fetch ideas" },
      { status: 502 }
    );
  }
}
