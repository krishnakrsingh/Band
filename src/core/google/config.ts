/**
 * Google Cloud config.
 * ACTION REQUIRED: replace WEB_CLIENT_ID below with your Web OAuth Client ID
 * from Google Cloud Console (see GOOGLE_SETUP.md). It is public data — safe to ship.
 */
export const WEB_CLIENT_ID = '869322199353-e6aj5hu21ft3u9i3q3mq86nu78mu66gs.apps.googleusercontent.com';

/** Package + SHA-1s to register as Android OAuth clients (see GOOGLE_SETUP.md). */
export const ANDROID_PACKAGE = 'com.h59app';
export const SHA1_RELEASE = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';
export const SHA1_DEBUG_TEST = '49:30:2F:76:2B:F1:BA:AB:7F:91:17:20:35:79:29:01:E8:D6:2A:B8';

/** Minimal scopes. Request calendar now; add others when the user opts in. */
export const SCOPES = {
  calendarRead: 'https://www.googleapis.com/auth/calendar.readonly',
  tasksRead: 'https://www.googleapis.com/auth/tasks.readonly',
  fitActivity: 'https://www.googleapis.com/auth/fitness.activity.read',
  fitHeartRate: 'https://www.googleapis.com/auth/fitness.heart_rate.read',
  contactsRead: 'https://www.googleapis.com/auth/contacts.readonly',
  gmailMetadata: 'https://www.googleapis.com/auth/gmail.metadata',
} as const;
