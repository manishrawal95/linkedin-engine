import { backendFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await backendFetch("/profile");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET /api/linkedin/profile:", err);
    return NextResponse.json(
      { detail: "Failed to fetch profile" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.text();
    const res = await backendFetch("/profile", {
      method: "PUT",
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("PUT /api/linkedin/profile:", err);
    return NextResponse.json(
      { detail: "Failed to save profile" },
      { status: 502 }
    );
  }
}
