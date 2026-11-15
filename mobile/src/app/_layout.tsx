import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { RaveCallProvider } from '@/state/RaveCallContext';
import { useTheme } from '@/components/ui';

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <RaveCallProvider>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
          tabBarActiveTintColor: t.uv,
          tabBarInactiveTintColor: t.mut,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Listen', tabBarIcon: ({ focused }) => <Icon emoji="🎧" focused={focused} /> }}
        />
        <Tabs.Screen
          name="voices"
          options={{ title: 'Voices', tabBarIcon: ({ focused }) => <Icon emoji="🗣️" focused={focused} /> }}
        />
        <Tabs.Screen
          name="safety"
          options={{ title: 'Safety', tabBarIcon: ({ focused }) => <Icon emoji="🛡️" focused={focused} /> }}
        />
      </Tabs>
    </RaveCallProvider>
  );
}
