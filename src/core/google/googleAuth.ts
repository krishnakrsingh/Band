import {
  GoogleSignin, isSuccessResponse, statusCodes, isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { WEB_CLIENT_ID, SCOPES } from './config';

export type GoogleSession = { email: string; name: string | null; accessToken: string; photo?: string | null };
export type ConnectResult = { ok: true; session: GoogleSession } | { ok: false; error: string };

/** Call once at app startup before any sign-in. */
export function configureGoogle() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile', SCOPES.calendarRead],
    offlineAccess: false,
  });
}

export async function connectGoogle(): Promise<ConnectResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { ok: false, error: 'Sign-in cancelled' };
    const { accessToken } = await GoogleSignin.getTokens();
    const u = response.data.user;
    return { ok: true, session: { email: u.email, name: u.name, photo: u.photo, accessToken } };
  } catch (e: any) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) {
      return { ok: false, error: 'Sign-in already in progress' };
    }
    return { ok: false, error: e?.message ?? 'Google sign-in failed' };
  }
}

export async function restoreGoogleSession(): Promise<GoogleSession | null> {
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const response: any = await GoogleSignin.signInSilently();
    if (response?.type !== 'success') return null;
    const { accessToken } = await GoogleSignin.getTokens();
    return { email: response.data.user.email, name: response.data.user.name,
      photo: response.data.user.photo, accessToken };
  } catch { return null; }
}

export async function disconnectGoogle(): Promise<void> {
  await GoogleSignin.revokeAccess().catch(() => undefined);
  await GoogleSignin.signOut().catch(() => undefined);
}

/** Opt-in to more Google APIs later (Tasks/Fit/Gmail/etc.) with the same login. */
export async function enableMoreScopes(scopes: string[]): Promise<void> {
  await GoogleSignin.addScopes({ scopes });
}
