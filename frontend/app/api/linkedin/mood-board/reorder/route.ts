import { proxyToBackend } from "@/lib/api";
import { NextRequest } from "next/server";

export async function PUT(request: NextRequest) {
  return proxyToBackend("/mood-board/reorder", request);
}
