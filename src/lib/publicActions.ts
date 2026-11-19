const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-actions`;

export async function callPublicAction<T>(body: Record<string, unknown>, fallbackError: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(err);
    throw new Error(fallbackError);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    console.error(payload);
    throw new Error(typeof payload?.error === 'string' && payload.error ? payload.error : fallbackError);
  }
  return payload as T;
}
