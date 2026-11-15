import { type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Same palette as the web app (light + dark).
const light = {
  bg: '#f3effc',
  card: '#ffffff',
  ink: '#1d1533',
  mut: '#6d6488',
  uv: '#6a43ff',
  ok: '#0f9d7a',
  warn: '#c77700',
  bad: '#d1263f',
  line: '#ddd5f3',
};
const dark: typeof light = {
  bg: '#150e2a',
  card: '#201740',
  ink: '#efeaff',
  mut: '#a79fc6',
  uv: '#9a7dff',
  ok: '#3fd6b0',
  warn: '#ffb23e',
  bad: '#ff5f78',
  line: '#33275c',
};
export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function Screen({
  title,
  right,
  banner,
  children,
}: {
  title: string;
  right?: string;
  banner?: string | null;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.row}>
        <Text style={[styles.h1, { color: t.ink }]}>{title}</Text>
        {right ? <Text style={[styles.mut, { color: t.mut }]}>{right}</Text> : null}
      </View>
      {banner ? (
        <View
          accessibilityRole="alert"
          style={[styles.banner, { borderColor: t.warn, backgroundColor: t.card }]}
        >
          <Text style={{ color: t.ink }}>{banner}</Text>
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }, style]}>
      {children}
    </View>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.h2, { color: t.ink }]}>{children}</Text>;
}

export function Mut({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.mut, { color: t.mut }, style]}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  alt,
  small,
  disabled,
}: {
  label: string;
  onPress: () => void;
  alt?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSm,
        alt
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.line }
          : { backgroundColor: t.uv },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.btnText, small && { fontSize: 14 }, { color: alt ? t.ink : '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Switch with a title and a grey description, like the web app's checkboxes. */
export function Toggle({
  value,
  onChange,
  title,
  detail,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { alignItems: 'flex-start', marginVertical: 6 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: t.ink, fontSize: 16 }}>{title}</Text>
        {detail ? <Mut>{detail}</Mut> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.line, true: t.uv }}
        thumbColor="#ffffff"
        accessibilityLabel={title}
      />
    </View>
  );
}

/** Horizontal meter bar (0..1). */
export function Meter({ value, color }: { value: number; color: string }) {
  const t = useTheme();
  return (
    <View style={[styles.meter, { backgroundColor: t.line }]}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 18, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  mut: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  banner: { borderWidth: 1, borderRadius: 14, padding: 12 },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  btnSm: { paddingVertical: 7, paddingHorizontal: 12 },
  btnText: { fontWeight: '700', fontSize: 16 },
  meter: { height: 12, borderRadius: 8, overflow: 'hidden', marginVertical: 8 },
  code: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2.4,
    textAlign: 'center',
    padding: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
