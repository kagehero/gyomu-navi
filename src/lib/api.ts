const jsonHeaders = { "Content-Type": "application/json" } as const;

function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPostEmpty(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: "POST", credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}
