import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.LINKEDIN_BACKEND_URL || "http://127.0.0.1:8200";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { detail: "No file provided" },
        { status: 400 }
      );
    }

    // Forward the file as multipart/form-data to the backend
    const backendForm = new FormData();
    backendForm.append("file", file);

    const resp = await fetch(`${BACKEND_URL}/posts/import-metrics`, {
      method: "POST",
      body: backendForm,
      // Let fetch set the Content-Type with boundary automatically
    });

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      "POST /api/linkedin/posts/import-metrics: proxy failed:",
      error
    );
    return NextResponse.json(
      { detail: "Failed to forward file to backend. Is the backend running?" },
      { status: 502 }
    );
  }
}
