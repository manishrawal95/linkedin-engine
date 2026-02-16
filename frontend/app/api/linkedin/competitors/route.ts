import { proxyToBackend } from "@/lib/api";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return proxyToBackend("/competitors", request);
}

export async function POST(request: NextRequest) {
  return proxyToBackend("/competitors", request);
}
