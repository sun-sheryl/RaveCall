// App state, ported from public/index.html.
//
// Rooms (same names as server.js):
//   event-<CODE>   the venue mix, published by the booth as "soundboard"
//   voice-<myId>   your own voice room (you publish when "Share my voice" is on)
//   voice-<friend> one room per friend you connect to (you listen)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RemoteAudioTrack,
  Room,
  RoomEvent,
  type RemoteParticipant,
  type Participant,
} from 'livekit-client';
import { AudioSession } from '@livekit/react-native';
import {
  EVENTS,
  VOICE_CODE,
  cleanEventCode,
  eventRoomName,
  isBooth,
  voiceRoomName,
} from '@/config';
import { getToken } from '@/livekit/tokens';

export type Friend = { id: string; name: string; muted: boolean; talking: boolean };
type MsgTone = 'normal' | 'bad';

type State = {
  // identity / voice code
  myId: string;
  newCode: () => void;

  // Listen
  eventName: string | null;
  joining: boolean;
  codeMsg: { text: string; tone: MsgTone };
  join: (code: string) => void;
  leaveEvent: () => void;
  active: boolean; // audio is "on" (event joined or friends connected)
  vol: number; // 0..1
  setVol: (v: number) => void;
  cap: number; // dB
  setCap: (v: number) => void;
  db: number; // estimated dB at the ear
  dose: number; // 1 = 100%

  // Safety
  autoEase: boolean;
  setAutoEase: (v: boolean) => void;
  restRemind: boolean;
  setRestRemind: (v: boolean) => void;
  resetDose: () => void;

  // Voices
  share: boolean;
  setShare: (on: boolean) => void;
  friends: Friend[];
  addFriend: (name: string, id: string) => Promise<boolean>;
  toggleFriendMute: (id: string) => void;
  disconnectFriend: (id: string) => void;
  duck: boolean;
  setDuck: (v: boolean) => void;

  banner: string | null;
  showBanner: (text: string) => void;
};

const Ctx = createContext<State | null>(null);

const newId = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
const DOSE_KEY = 'ravecall-dose';
const today = () => new Date().toDateString();

/** Same level model as the web app: volume maps to 60–105 dB, held under the cap. */
export function levelDb(vol: number, cap: number, eased: boolean) {
  return Math.min(cap, 60 + 45 * vol) - (eased ? 6 : 0);
}

export function stateFor(db: number): [string, 'bad' | 'warn' | 'ok'] {
  if (db >= 100) return ['Dangerous. Turn down now', 'bad'];
  if (db >= 90) return ['Loud. Damage possible in under 2 hours', 'warn'];
  if (db >= 85) return ['At the safe limit', 'warn'];
  return ['Comfortable for hours', 'ok'];
}

async function micAllowed() {
  if (Platform.OS !== 'android') return true; // iOS asks on first use
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export function RaveCallProvider({ children }: { children: ReactNode }) {
  const [myId, setMyId] = useState(newId);

  // Listen
  const eventRoom = useRef<Room | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ text: string; tone: MsgTone }>({
    text: 'Enter the code from your event.',
    tone: 'normal',
  });
  const wrongTries = useRef({ count: 0, since: Date.now() });

  const [vol, setVol] = useState(0.4);
  const [cap, setCap] = useState(85);
  const [dose, setDose] = useState(0);
  const [eased, setEased] = useState(false);
  const [warned80, setWarned80] = useState(false);
  const [autoEase, setAutoEase] = useState(true);
  const [restRemind, setRestRemind] = useState(true);

  // Voices
  const voiceRoom = useRef<Room | null>(null);
  const friendRooms = useRef(new Map<string, Room>());
  const [share, setShareState] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [duck, setDuck] = useState(true);

  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showBanner = useCallback((text: string) => {
    setBanner(text);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 9000);
  }, []);

  // Re-apply volumes whenever tracks arrive.
  const [trackTick, setTrackTick] = useState(0);
  const bumpTracks = useCallback(() => setTrackTick((n) => n + 1), []);

  const active = !!eventName || friends.length > 0;

  // ---------- audio session ----------
  const audioOn = useRef(false);
  const startAudio = useCallback(async () => {
    if (audioOn.current || Platform.OS === 'web') return;
    audioOn.current = true;
    await AudioSession.startAudioSession();
  }, []);
  const stopAudioIfIdle = useCallback(() => {
    if (!audioOn.current) return;
    if (eventRoom.current || voiceRoom.current || friendRooms.current.size) return;
    audioOn.current = false;
    AudioSession.stopAudioSession();
  }, []);

  // ---------- saved dose ----------
  useEffect(() => {
    AsyncStorage.getItem(DOSE_KEY)
      .then((s) => {
        if (!s) return;
        const o = JSON.parse(s);
        if (o.day === today()) setDose(o.dose || 0);
      })
      .catch(() => {});
  }, []);

  // ---------- Listen: event channel ----------
  const subscribeBooth = useCallback((p: RemoteParticipant) => {
    if (!isBooth(p.identity)) return;
    p.audioTrackPublications.forEach((pub) => {
      if (!pub.isSubscribed) pub.setSubscribed(true);
    });
  }, []);

  const leaveEvent = useCallback(() => {
    const r = eventRoom.current;
    eventRoom.current = null;
    setEventName(null);
    setJoining(false);
    setCodeMsg({ text: 'Enter the code from your event.', tone: 'normal' });
    r?.disconnect().finally(stopAudioIfIdle);
  }, [stopAudioIfIdle]);

  const join = useCallback(
    async (typed: string) => {
      if (eventRoom.current) {
        leaveEvent();
        return;
      }
      // Wrong-guess limit, like server.js: 50 per 10 minutes.
      const w = wrongTries.current;
      if (Date.now() - w.since > 10 * 60 * 1000) wrongTries.current = { count: 0, since: Date.now() };
      if (wrongTries.current.count > 50) {
        setCodeMsg({ text: 'Too many wrong tries. Wait a few minutes.', tone: 'bad' });
        return;
      }
      const code = cleanEventCode(typed);
      const name = EVENTS[code];
      if (!name) {
        wrongTries.current.count++;
        setCodeMsg({
          text: 'That code isn’t valid. Check it with the event staff and try again.',
          tone: 'bad',
        });
        return;
      }

      setJoining(true);
      setCodeMsg({ text: 'Connecting…', tone: 'normal' });
      try {
        await startAudio();
        const info = await getToken(eventRoomName(code), myId);
        const room = new Room({ adaptiveStream: false, dynacast: false });
        room.on(RoomEvent.TrackSubscribed, (track, _pub, p) => {
          if (track.kind === 'audio' && isBooth(p.identity)) {
            setCodeMsg({ text: `Connected to ${name}. Booth audio is live.`, tone: 'normal' });
          }
          bumpTracks();
        });
        room.on(RoomEvent.TrackPublished, (_pub, p) => subscribeBooth(p));
        room.on(RoomEvent.ParticipantConnected, subscribeBooth);
        room.on(RoomEvent.TrackUnsubscribed, (_t, _pub, p) => {
          if (isBooth(p.identity))
            setCodeMsg({ text: `Connected to ${name}. Waiting for the booth audio…`, tone: 'normal' });
        });
        room.on(RoomEvent.Disconnected, () => {
          if (eventRoom.current === room) {
            eventRoom.current = null;
            setEventName(null);
            setCodeMsg({ text: 'Lost connection to the event. Join again.', tone: 'bad' });
            stopAudioIfIdle();
          }
        });
        await room.connect(info.url, info.token, { autoSubscribe: false });
        eventRoom.current = room;
        setEventName(name);
        setCodeMsg({ text: `Connected to ${name}. Waiting for the booth audio…`, tone: 'normal' });
        room.remoteParticipants.forEach(subscribeBooth);
      } catch {
        eventRoom.current = null;
        setCodeMsg({ text: 'Couldn’t reach the audio room. Try again.', tone: 'bad' });
        stopAudioIfIdle();
      } finally {
        setJoining(false);
      }
    },
    [bumpTracks, leaveEvent, myId, startAudio, stopAudioIfIdle, subscribeBooth],
  );

  // ---------- Voices: your own voice room ----------
  const setShare = useCallback(
    async (on: boolean) => {
      if (!on) {
        const r = voiceRoom.current;
        voiceRoom.current = null;
        setShareState(false);
        r?.disconnect().finally(stopAudioIfIdle);
        return;
      }
      setShareState(true);
      try {
        if (!(await micAllowed())) throw new Error('mic');
        await startAudio();
        const info = await getToken(voiceRoomName(myId), myId);
        const room = new Room();
        await room.connect(info.url, info.token);
        await room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
        });
        voiceRoom.current = room;
      } catch {
        voiceRoom.current?.disconnect();
        voiceRoom.current = null;
        setShareState(false);
        showBanner('Couldn’t turn on your mic. Allow microphone access and check your connection.');
        stopAudioIfIdle();
      }
    },
    [myId, showBanner, startAudio, stopAudioIfIdle],
  );

  const newCode = useCallback(() => {
    const wasSharing = !!voiceRoom.current;
    voiceRoom.current?.disconnect();
    voiceRoom.current = null;
    setMyId(newId());
    if (wasSharing) setShareState(false); // turned back on below once myId updates
    pendingReshare.current = wasSharing;
  }, []);
  const pendingReshare = useRef(false);
  useEffect(() => {
    if (pendingReshare.current) {
      pendingReshare.current = false;
      setShare(true);
    }
  }, [myId, setShare]);

  // ---------- Voices: friends ----------
  const updateFriend = useCallback((id: string, patch: Partial<Friend>) => {
    setFriends((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFriend = useCallback(
    async (name: string, rawId: string) => {
      const id = rawId.trim().toLowerCase();
      if (!VOICE_CODE.test(id)) {
        showBanner('That code doesn’t look right. Check it and try again.');
        return false;
      }
      if (id === myId) {
        showBanner('That’s your own code.');
        return false;
      }
      if (friendRooms.current.has(id)) return true;
      try {
        await startAudio();
        const info = await getToken(voiceRoomName(id), myId);
        const room = new Room();
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          updateFriend(id, { talking: speakers.some((s) => s.identity === id) });
        });
        room.on(RoomEvent.TrackSubscribed, bumpTracks);
        room.on(RoomEvent.Disconnected, () => {
          if (friendRooms.current.get(id) === room) {
            friendRooms.current.delete(id);
            setFriends((fs) => fs.filter((f) => f.id !== id));
            stopAudioIfIdle();
          }
        });
        await room.connect(info.url, info.token);
        friendRooms.current.set(id, room);
        setFriends((fs) => [...fs, { id, name, muted: false, talking: false }]);
        return true;
      } catch {
        showBanner('Couldn’t connect to that friend. Check the code and your connection.');
        stopAudioIfIdle();
        return false;
      }
    },
    [bumpTracks, myId, showBanner, startAudio, stopAudioIfIdle, updateFriend],
  );

  const toggleFriendMute = useCallback((id: string) => {
    setFriends((fs) =>
      fs.map((f) => {
        if (f.id !== id) return f;
        const muted = !f.muted;
        friendRooms.current
          .get(id)
          ?.remoteParticipants.forEach((p) =>
            p.audioTrackPublications.forEach((pub) => pub.setSubscribed(!muted)),
          );
        return { ...f, muted };
      }),
    );
  }, []);

  const disconnectFriend = useCallback(
    (id: string) => {
      const r = friendRooms.current.get(id);
      friendRooms.current.delete(id);
      setFriends((fs) => fs.filter((f) => f.id !== id));
      r?.disconnect().finally(stopAudioIfIdle);
    },
    [stopAudioIfIdle],
  );

  // ---------- levels, ducking, dose ----------
  const db = levelDb(vol, cap, eased);
  const friendTalking = friends.some((f) => f.talking && !f.muted);

  // Apply gains to the real tracks (same curve as the web app's master gain).
  useEffect(() => {
    const master = Math.pow(10, (db - 105) / 20) * 1.8;
    const music = master * (duck && friendTalking ? 0.35 : 1);
    const voice = master * 3;
    eventRoom.current?.remoteParticipants.forEach((p) =>
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track instanceof RemoteAudioTrack) pub.track.setVolume(music);
      }),
    );
    friendRooms.current.forEach((room) =>
      room.remoteParticipants.forEach((p) =>
        p.audioTrackPublications.forEach((pub) => {
          if (pub.track instanceof RemoteAudioTrack) pub.track.setVolume(voice);
        }),
      ),
    );
  }, [db, duck, friendTalking, trackTick, eventName, friends.length]);

  // Dose: NIOSH 85 dB / 3 dB exchange rate, counted once a second while audio is on.
  const doseRef = useRef(dose);
  doseRef.current = dose;
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const allowed = (8 * 3600) / Math.pow(2, (db - 85) / 3);
      const next = doseRef.current + dt / allowed;
      setDose(next);
      AsyncStorage.setItem(DOSE_KEY, JSON.stringify({ day: today(), dose: next })).catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, [active, db]);

  useEffect(() => {
    const p = dose * 100;
    if (p >= 80 && !warned80 && restRemind) {
      setWarned80(true);
      showBanner('You’ve used 80% of today’s safe listening. Step away from the speakers for a few minutes.');
    }
    if (p >= 100 && !eased && autoEase) {
      setEased(true);
      showBanner('Dose limit reached. Your volume was lowered 6 dB.');
    }
  }, [dose, warned80, restRemind, eased, autoEase, showBanner]);

  const resetDose = useCallback(() => {
    setDose(0);
    setWarned80(false);
    setEased(false);
    AsyncStorage.setItem(DOSE_KEY, JSON.stringify({ day: today(), dose: 0 })).catch(() => {});
  }, []);

  // Clean up rooms if the provider unmounts.
  useEffect(() => {
    const friendsMap = friendRooms.current;
    return () => {
      eventRoom.current?.disconnect();
      voiceRoom.current?.disconnect();
      friendsMap.forEach((r) => r.disconnect());
    };
  }, []);

  const value = useMemo<State>(
    () => ({
      myId,
      newCode,
      eventName,
      joining,
      codeMsg,
      join,
      leaveEvent,
      active,
      vol,
      setVol,
      cap,
      setCap,
      db,
      dose,
      autoEase,
      setAutoEase,
      restRemind,
      setRestRemind,
      resetDose,
      share,
      setShare,
      friends,
      addFriend,
      toggleFriendMute,
      disconnectFriend,
      duck,
      setDuck,
      banner,
      showBanner,
    }),
    [
      myId, newCode, eventName, joining, codeMsg, join, leaveEvent, active, vol, cap, db, dose,
      autoEase, restRemind, resetDose, share, setShare, friends, addFriend, toggleFriendMute,
      disconnectFriend, duck, banner, showBanner,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRaveCall() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRaveCall must be used inside <RaveCallProvider>');
  return v;
}
