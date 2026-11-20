import { GoogleSignin } from '@react-native-google-signin/google-signin';

export class GoogleApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Google REST call with Bearer token; retry once with a refreshed token on 401. */
export async function googleGet<T>(url: string): Promise<T> {
  const call = async (token: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new GoogleApiError(res.status, await res.text());
    return (await res.json()) as T;
  };
  let { accessToken } = await GoogleSignin.getTokens();
  try {
    return await call(accessToken);
  } catch (e: any) {
    if (e instanceof GoogleApiError && e.status === 401) {
      await GoogleSignin.clearCachedAccessToken(accessToken).catch(() => undefined);
      ({ accessToken } = await GoogleSignin.getTokens());
      return call(accessToken);
    }
    throw e;
  }
}
