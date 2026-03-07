import { backendFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await backendFetch("/memory");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET /api/linkedin/memory:", err);
    return NextResponse.json(
      { detail: "Failed to fetch creator memory" },
      { status: 502 }
    );
  }
}

export async function POST() {
  try {
    const res = await backendFetch("/memory/build", { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("POST /api/linkedin/memory:", err);
    return NextResponse.json(
      { detail: "Failed to build creator memory" },
      { status: 502 }
    );
  }
}
