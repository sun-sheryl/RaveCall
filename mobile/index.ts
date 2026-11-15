// App entry. LiveKit's globals must be registered before anything else loads,
// so this runs first, then hands off to Expo Router.
import './src/livekit/setup';
import 'expo-router/entry';
