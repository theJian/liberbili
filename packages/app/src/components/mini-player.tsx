/**
 * MiniPlayer presents the shared selection and transport controls from usePlayer,
 * hiding when no video is selected. Opening it navigates to `/playback`;
 * PlayerProvider handles loading, retrying, and advancing the queue.
 */
import { Image } from 'expo-image';
import { Forward, Pause, Play } from '@doodle-icons/react-native';
import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlayer } from '@/state/player';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export function MiniPlayer() {
  const { current, isPlaying, toggle, next, index, queue, loading, error } =
    usePlayer();
  const { t } = useLingui();
  const theme = useTheme();
  if (!current) return null;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
        },
      ]}
    >
      <Pressable style={styles.main} onPress={() => router.push('/playback')}>
        <Image
          source={{ uri: current.thumbnail }}
          style={styles.image}
          contentFit="cover"
        />
        <View style={styles.text}>
          <ThemedText numberOfLines={1} style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
            {current.uploader}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        disabled={loading}
        accessibilityLabel={
          error ? t`Retry playback` : isPlaying ? t`Pause` : t`Play`
        }
        style={styles.control}
      >
        {loading || error ? (
          <ThemedText>{loading ? '…' : '↻'}</ThemedText>
        ) : isPlaying ? (
          <Pause />
        ) : (
          <Play />
        )}
      </Pressable>
      <Pressable
        onPress={next}
        accessibilityRole="button"
        disabled={index >= queue.length - 1}
        accessibilityLabel={t`Next`}
        style={styles.control}
      >
        <Forward />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  image: { width: 92, height: 52, marginLeft: 6, borderRadius: 7 },
  text: { flex: 1 },
  title: { fontWeight: '600' },
  control: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
});
