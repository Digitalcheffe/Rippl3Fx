type FetchOptions = RequestInit & { body?: any };

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/csrf-token', { credentials: 'include' });
  const data = await res.json();
  csrfToken = data.token;
  return csrfToken!;
}

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers, method, ...rest } = options;
  const isMutation = method && !['GET', 'HEAD', 'OPTIONS'].includes(method);

  // Get CSRF token for mutation requests
  const csrfHeaders: Record<string, string> = {};
  if (isMutation) {
    csrfHeaders['x-csrf-token'] = await getCsrfToken();
  }

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    method,
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }

  // If CSRF token was rejected, refresh and retry once
  if (res.status === 403 && isMutation) {
    csrfToken = null;
    csrfHeaders['x-csrf-token'] = await getCsrfToken();
    const retry = await fetch(`/api${path}`, {
      credentials: 'include',
      method,
      headers: {
        'Content-Type': 'application/json',
        ...csrfHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    });
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({ error: retry.statusText }));
      throw new Error(err.error || retry.statusText);
    }
    return retry.json();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json();
}

export function apiGet<T = any>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export function apiPost<T = any>(path: string, body?: any): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body });
}

export function apiPut<T = any>(path: string, body?: any): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body });
}

export function apiDelete(path: string): Promise<{ success: boolean }> {
  return apiFetch(path, { method: 'DELETE' });
}
