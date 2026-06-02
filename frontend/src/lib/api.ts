const jsonHeaders = { "Content-Type": "application/json" } as const;

/** HTTP status code → 日本語フォールバック (only used when server returned no body). */
const STATUS_JP: Record<number, string> = {
  400: "リクエストの内容に誤りがあります",
  401: "ログインが必要です",
  403: "この操作を実行する権限がありません",
  404: "対象が見つかりませんでした",
  408: "通信がタイムアウトしました",
  409: "他の操作と競合しました。再読み込みしてください",
  413: "送信データが大きすぎます",
  422: "入力内容に誤りがあります",
  429: "短時間に多くのリクエストがあります。少し待って再試行してください",
  500: "サーバーで予期しないエラーが発生しました",
  502: "サーバーに接続できません",
  503: "現在サービスをご利用いただけません",
  504: "サーバーの応答が遅延しています",
};

async function parseApiError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  const body = err as { error?: string; message?: string | string[] };
  if (Array.isArray(body.message)) return body.message.join(" ");
  if (typeof body.message === "string") return body.message;
  if (body.error) return body.error;
  return STATUS_JP[res.status] ?? `通信エラーが発生しました (HTTP ${res.status})`;
}

/** Network-level errors (offline, DNS, TLS) → friendly Japanese message. */
function networkError(e: unknown): Error {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new Error("オフラインです。ネットワーク接続を確認してください");
  }
  if (e instanceof Error && /aborted|timeout/i.test(e.message)) {
    return new Error("通信がタイムアウトしました。再試行してください");
  }
  return new Error("サーバーに接続できませんでした");
}

function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    throw networkError(e);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await safeFetch(apiUrl(path), { credentials: "include" });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await safeFetch(apiUrl(path), {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function apiPostEmpty(path: string): Promise<void> {
  const res = await safeFetch(apiUrl(path), { method: "POST", credentials: "include" });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
}

export async function apiPatch<T>(path: string, body: object): Promise<T> {
  const res = await safeFetch(apiUrl(path), {
    method: "PATCH",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function apiDelete<T = { ok: true }>(path: string): Promise<T> {
  const res = await safeFetch(apiUrl(path), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<T>;
}

/** Download a CSV (or other binary) response as a file. */
export async function apiDownload(path: string, fallbackName = "export.csv"): Promise<void> {
  const res = await safeFetch(apiUrl(path), { credentials: "include" });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
