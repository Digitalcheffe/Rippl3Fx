type FetchOptions = RequestInit & { body?: any };

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
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
