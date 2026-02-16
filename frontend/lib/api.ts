const BACKEND_URL = process.env.LINKEDIN_BACKEND_URL || "http://127.0.0.1:8200";

export async function backendFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function proxyToBackend(
  path: string,
  request: Request
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      // no body
    }
  }

  const resp = await fetch(url, {
    method: request.method,
    headers,
    body,
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
