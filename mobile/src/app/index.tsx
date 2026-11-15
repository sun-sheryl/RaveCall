// Listen tab (web: section#listen)

import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { Text, TextInput, View } from 'react-native';
import { stateFor, useRaveCall } from '@/state/RaveCallContext';
import { Btn, Card, H2, Meter, Mut, Screen, styles, useTheme } from '@/components/ui';

export default function ListenScreen() {
  const t = useTheme();
  const s = useRaveCall();
  const [code, setCode] = useState('');

  const [stateText, tone] = stateFor(s.db);
  const doseP = s.dose * 100;
  const doseColor = doseP >= 100 ? t.bad : doseP >= 80 ? t.warn : t.ok;

  return (
    <Screen title="RaveCall" right={s.eventName ? `${s.eventName} · live` : 'Not joined'} banner={s.banner}>
      <Card>
        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: t.ink, fontSize: 76, fontWeight: '800', lineHeight: 84 }}>
            {s.active ? Math.round(s.db) : '--'}
          </Text>
          <Mut style={{ fontSize: 15 }}>dB at your ear (estimate)</Mut>
          <Text style={{ fontWeight: '700', marginTop: 4, color: s.active ? t[tone] : t.ink }}>
            {s.active ? stateText : 'Join the channel to start'}
          </Text>
        </View>

        <Mut style={{ marginTop: 12 }}>Event code</Mut>
        <TextInput
          value={code}
          onChangeText={setCode}
          editable={!s.eventName && !s.joining}
          placeholder="ENTER CODE"
          placeholderTextColor={t.mut}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          onSubmitEditing={() => s.join(code)}
          returnKeyType="go"
          accessibilityLabel="Event code"
          style={[
            styles.code,
            { color: t.ink, backgroundColor: t.bg, borderColor: t.line, opacity: s.eventName ? 0.6 : 1 },
          ]}
        />
        <Text
          accessibilityRole="text"
          style={{ color: s.codeMsg.tone === 'bad' ? t.bad : t.mut, fontSize: 14, marginBottom: 10 }}
        >
          {s.codeMsg.text}
        </Text>
        <Btn
          label={s.eventName ? 'Leave channel' : 'Join main audio channel'}
          alt={!!s.eventName}
          disabled={s.joining}
          onPress={() => (s.eventName ? s.leaveEvent() : s.join(code))}
        />
      </Card>

      <Card>
        <View style={styles.row}>
          <H2>Your volume</H2>
          <Mut>{Math.round(s.vol * 100)}%</Mut>
        </View>
        <Slider
          value={s.vol}
          onValueChange={s.setVol}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          minimumTrackTintColor={t.uv}
          maximumTrackTintColor={t.line}
          thumbTintColor={t.uv}
          accessibilityLabel="Listening volume"
          style={{ height: 40 }}
        />
        <View style={styles.row}>
          <Mut>Quiet</Mut>
          <Mut>
            Capped at <Text style={{ fontWeight: '700' }}>{s.cap}</Text> dB
          </Mut>
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <H2>Today's hearing dose</H2>
          <Mut>{Math.round(doseP)}%</Mut>
        </View>
        <Meter value={s.dose} color={doseColor} />
        <Mut>At 85 dB you can safely listen for about 8 hours. Every 3 dB louder halves that.</Mut>
      </Card>
    </Screen>
  );
}
