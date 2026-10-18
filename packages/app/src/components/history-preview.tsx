import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { resumePosition } from '@/lib/watch-history';
import { useHistory } from '@/state/history';

export function HistoryPreview() {
  const { t } = useLingui();
  const { entries } = useHistory();
  const latest = entries.find(
    (entry) => resumePosition(entry, entry.duration) > 0,
  );
  if (!latest) return null;
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <ThemedText type="smallBold">{t`Continue watching`}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/history')}
        style={{ paddingVertical: 8 }}
      >
        <ThemedText numberOfLines={2}>{latest.video.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {latest.part.title}
        </ThemedText>
      </Pressable>
    </View>
  );
}
