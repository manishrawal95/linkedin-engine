import { proxyToBackend } from "@/lib/api";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const postId = url.searchParams.get("post_id") || "";
  return proxyToBackend(`/drafts/${id}/mark-posted?post_id=${postId}`, request);
}
