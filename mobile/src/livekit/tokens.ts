import { TokenSource } from 'livekit-client';
import { TOKEN_SERVER_ID } from '@/config';

/** Get a server URL + token for a LiveKit room from the development token server. */
export async function getToken(roomName: string, identity: string) {
  // A fresh source per request, since a token source caches one response at a time.
  const source = TokenSource.developmentTokenServer(TOKEN_SERVER_ID);
  const res = await source.fetch({
    roomName,
    participantIdentity: identity,
    participantName: identity,
  });
  return { url: res.serverUrl, token: res.participantToken };
}
