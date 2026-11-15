// ===================== RaveCall settings =====================
//
// EVENT CODES: the app only connects to these codes (exact match).
// To add or change an event, edit this list, keeping the same format:
//   CODE: 'Event name shown in the app'
export const EVENTS: Record<string, string> = {
  NEON24: 'Neon Warehouse',
  SUNRISE: 'Sunrise Fields',
};

// LiveKit Cloud development token server ID
// (LiveKit Cloud → project Settings → Development token server).
// DEVELOPMENT ONLY. For a real launch, get tokens from server.js instead,
// which also checks event codes on the server.
export const TOKEN_SERVER_ID = 'ravecall-1b496s';

// ==============================================================

/** Room names match server.js, so the booth and web app use the same rooms. */
export const eventRoomName = (code: string) => `event-${code}`;
export const voiceRoomName = (voiceCode: string) => `voice-${voiceCode}`;

/** The booth publishes as "soundboard" (see booth.html / server.js). */
export const isBooth = (identity: string) => identity.startsWith('soundboard');

/** Voice codes / identities: 4–12 lowercase letters or digits, like the web app. */
export const VOICE_CODE = /^[a-z0-9]{4,12}$/;

/** Normalize what someone typed into an event code: uppercase, no spaces or dashes. */
export const cleanEventCode = (s: string) => s.toUpperCase().replace(/[\s-]+/g, '');
