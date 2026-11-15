// Voices tab (web: section#voices)

import { useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRaveCall, type Friend } from '@/state/RaveCallContext';
import { Btn, Card, H2, Mut, Screen, Toggle, styles, useTheme } from '@/components/ui';

const QR_PREFIX = 'ravecall://voice/';

export default function VoicesScreen() {
  const t = useTheme();
  const s = useRaveCall();
  const [typed, setTyped] = useState('');
  const [scanMsg, setScanMsg] = useState('Scan a friend’s code with your camera, or type their code below.');
  const [scanning, setScanning] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();

  async function openScanner() {
    let p = perm;
    if (!p?.granted) p = await requestPerm();
    if (!p.granted) {
      setScanMsg('Camera access was blocked. Allow camera permission in Settings and try again.');
      return;
    }
    setScanning(true);
  }

  async function connect(id: string) {
    const ok = await s.addFriend(`Friend ${id.slice(0, 3)}`, id);
    if (ok) setScanMsg(`Connected. You’ll hear Friend ${id.slice(0, 3)} when they turn on Share my voice.`);
  }

  return (
    <Screen title="Voices" right={s.eventName ? `${s.eventName} · live` : 'Not joined'} banner={s.banner}>
      <Card>
        <H2>Your voice code</H2>
        <Mut>
          Friends scan this to hear you through their hearing devices. It works with or without an
          event. Your mic stays off unless you turn on Share my voice.
        </Mut>
        <View
          accessibilityLabel="Your voice QR code"
          style={{ alignSelf: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 14, marginVertical: 10 }}
        >
          <QRCode value={QR_PREFIX + s.myId} size={180} />
        </View>
        <View style={styles.row}>
          <Mut>Code {s.myId}</Mut>
          <Btn label="New code" alt small onPress={s.newCode} />
        </View>
        <Toggle
          value={s.share}
          onChange={s.setShare}
          title="Share my voice"
          detail="Turns your mic on so friends who scan your code can hear you. Off by default."
        />
      </Card>

      <Card>
        <H2>Hear a friend</H2>
        <Btn label="Scan a friend's code" onPress={openScanner} />
        <Mut style={{ marginVertical: 8 }}>{scanMsg}</Mut>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder="Or type their code, e.g. ab12cd"
          placeholderTextColor={t.mut}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Friend's voice code"
          style={[styles.code, { fontSize: 16, letterSpacing: 0, color: t.ink, backgroundColor: t.bg, borderColor: t.line }]}
        />
        <Btn
          label="Connect"
          alt
          disabled={!typed.trim()}
          onPress={() => {
            const v = typed.trim().toLowerCase();
            setTyped('');
            connect(v);
          }}
        />
      </Card>

      <Card>
        <H2>Connected</H2>
        {s.friends.length === 0 ? (
          <Mut>No one yet.</Mut>
        ) : (
          s.friends.map((f) => <FriendRow key={f.id} f={f} />)
        )}
        <Toggle
          value={s.duck}
          onChange={s.setDuck}
          title="Lower the music while a friend talks"
          detail="Their voice stays clear without turning everything up."
        />
      </Card>

      <Scanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onCode={(id) => {
          setScanning(false);
          connect(id);
        }}
      />
    </Screen>
  );
}

function FriendRow({ f }: { f: Friend }) {
  const t = useTheme();
  const s = useRaveCall();
  return (
    <View style={[styles.row, { paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line }]}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: f.talking ? t.ok : t.line,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>{f.name}</Text>
        <Mut>{f.muted ? 'Muted' : f.talking ? 'Talking' : 'Connected'}</Mut>
      </View>
      <Btn label={f.muted ? 'Unmute' : 'Mute'} alt small onPress={() => s.toggleFriendMute(f.id)} />
      <Btn label="Disconnect" alt small onPress={() => s.disconnectFriend(f.id)} />
    </View>
  );
}

function Scanner({
  visible,
  onClose,
  onCode,
}: {
  visible: boolean;
  onClose: () => void;
  onCode: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const done = useRef(false);
  const onScan = ({ data }: BarcodeScanningResult) => {
    if (done.current || !data.startsWith(QR_PREFIX)) return;
    done.current = true;
    onCode(data.slice(QR_PREFIX.length));
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        done.current = false;
      }}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={visible ? onScan : undefined}
        />
        <View style={{ position: 'absolute', top: insets.top + 16, left: 16, right: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Point the camera at a friend’s code.
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
            alignSelf: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingVertical: 12,
            paddingHorizontal: 28,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
