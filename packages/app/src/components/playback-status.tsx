import { useLingui } from '@lingui/react/macro';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { usePlayer } from '@/state/player';

export function PlaybackStatus() {
  const { t } = useLingui();
  const { error, loading, retry } = usePlayer();
  if (loading)
    return (
      <ActivityIndicator
        accessibilityLabel={t`Loading video`}
        style={{ padding: 12 }}
      />
    );
  if (!error) return null;
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <ThemedText accessibilityRole="alert">{t`Unable to play this video. Check your connection and try again.`}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{ paddingVertical: 8 }}
      >
        <ThemedText>{t`Retry playback`}</ThemedText>
      </Pressable>
    </View>
  );
}
