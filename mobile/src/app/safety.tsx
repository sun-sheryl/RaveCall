// Safety tab (web: section#safety)

import Slider from '@react-native-community/slider';
import { Text, View } from 'react-native';
import { useRaveCall } from '@/state/RaveCallContext';
import { Btn, Card, H2, Mut, Screen, Toggle, styles, useTheme } from '@/components/ui';

export default function SafetyScreen() {
  const t = useTheme();
  const s = useRaveCall();
  return (
    <Screen title="Safety" right={s.eventName ? `${s.eventName} · live` : 'Not joined'} banner={s.banner}>
      <Card>
        <H2>Protection settings</H2>
        <View style={styles.row}>
          <Text style={{ color: t.ink, fontSize: 16 }}>Maximum level</Text>
          <Text style={{ color: t.ink, fontWeight: '700' }}>{s.cap} dB</Text>
        </View>
        <Slider
          value={s.cap}
          onValueChange={(v) => s.setCap(Math.round(v))}
          minimumValue={75}
          maximumValue={100}
          step={1}
          minimumTrackTintColor={t.uv}
          maximumTrackTintColor={t.line}
          thumbTintColor={t.uv}
          accessibilityLabel="Maximum level in decibels"
          style={{ height: 40 }}
        />
        <Toggle
          value={s.autoEase}
          onChange={s.setAutoEase}
          title="Ease volume down automatically"
          detail="If your dose passes 100%, the level drops 6 dB."
        />
        <Toggle
          value={s.restRemind}
          onChange={s.setRestRemind}
          title="Remind me to rest my ears"
          detail="A prompt appears at 80% dose."
        />
      </Card>

      <Card>
        <H2>How levels are estimated</H2>
        <Mut>
          Your volume maps to a level between 60 and 105 dB at the ear, then the cap holds it down.
          Real hearing devices report their own output, so a shipping app would read that value and
          calibrate to it. Dose follows the NIOSH 85 dB / 3 dB rule.
        </Mut>
      </Card>

      <Card>
        <Btn label="Reset today's dose" alt onPress={s.resetDose} />
      </Card>
    </Screen>
  );
}
