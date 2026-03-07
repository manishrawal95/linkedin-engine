import { backendFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await backendFetch(`/ideas/${id}/approve`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`POST /api/linkedin/ideas/${id}/approve:`, err);
    return NextResponse.json(
      { detail: "Failed to approve idea" },
      { status: 502 }
    );
  }
}
