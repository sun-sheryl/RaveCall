import { Platform } from 'react-native';
import { registerGlobals } from '@livekit/react-native';

// Sets up WebRTC for LiveKit. Must run before any LiveKit code (see index.ts).
if (Platform.OS !== 'web') {
  registerGlobals();
}
