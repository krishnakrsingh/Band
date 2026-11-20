import { googleGet } from './googleApi';

export type GEvent = {
  id: string; summary?: string; location?: string;
  startAt: number; endAt?: number; allDay: boolean; calendarId?: string;
};

/** Google Calendar — the first of many APIs reachable with the SAME login + token. */
export async function fetchCalendarEvents(days = 7): Promise<GEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 864e5).toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
  });
  type Raw = { id: string; summary?: string; location?: string;
    start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
  const json = await googleGet<{ items?: Raw[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`);
  return (json.items ?? []).map(e => {
    const allDay = !e.start?.dateTime && !!e.start?.date;
    return {
      id: e.id, summary: e.summary ?? '(no title)', location: e.location,
      allDay,
      startAt: new Date(e.start?.dateTime ?? e.start?.date ?? now.toISOString()).getTime(),
      endAt: e.end ? new Date(e.end.dateTime ?? e.end.date!).getTime() : undefined,
      calendarId: 'primary',
    };
  });
}

/** Tasks API — same token, just a new scope + URL (enable via enableMoreScopes). */
export async function fetchTasks(): Promise<Array<{ id: string; title: string; due?: string; status: string }>> {
  const json = await googleGet<{ items?: Array<{ id: string; title: string; due?: string; status: string }> }>(
    'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50');
  return json.items ?? [];
}

/** People API — same token, own profile. */
export async function fetchProfile(): Promise<{ name?: string; email?: string }> {
  const json = await googleGet<{ names?: Array<{ displayName: string }>; emailAddresses?: Array<{ value: string }> }>(
    'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses');
  return { name: json.names?.[0]?.displayName, email: json.emailAddresses?.[0]?.value };
}

// Future, same pattern — just add a scope + endpoint, no new integration plumbing:
// Fit:   https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate
// Gmail: https://gmail.googleapis.com/gmail/v1/users/me/messages?...
