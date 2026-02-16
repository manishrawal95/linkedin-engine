import { proxyToBackend } from "@/lib/api";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  return proxyToBackend(`/analyze/${postId}`, request);
}
