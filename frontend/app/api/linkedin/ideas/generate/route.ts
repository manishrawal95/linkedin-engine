import { backendFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams.toString();
    const backendUrl = `/ideas/generate${params ? `?${params}` : ""}`;
    const res = await backendFetch(backendUrl, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("POST /api/linkedin/ideas/generate:", err);
    return NextResponse.json(
      { detail: "Failed to generate ideas" },
      { status: 502 }
    );
  }
}
