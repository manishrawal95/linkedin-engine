import { proxyToBackend } from "@/lib/api";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  return proxyToBackend(`/mood-board${search ? `?${search}` : ""}`, request);
}

export async function POST(request: NextRequest) {
  return proxyToBackend("/mood-board", request);
}
