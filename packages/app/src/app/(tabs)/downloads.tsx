import { AppIcon } from '@/components/app-icon';
import { FlashList } from '@shopify/flash-list';
import { useLingui } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { DownloadItem, useDownloads } from '@/state/downloads';
import { usePlayer } from '@/state/player';
import { useTheme } from '@/hooks/use-theme';

export default function DownloadsScreen() {
  const { downloads, pause, resume, remove } = useDownloads();
  const { t } = useLingui();
  const theme = useTheme();
  const { playLocal } = usePlayer();
  const renderItem = useCallback(
    ({ item }: { item: DownloadItem }) => (
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <Pressable
          disabled={!item.fileUri}
          onPress={() =>
            item.fileUri &&
            void playLocal(
              {
                ...item.video,
                thumbnail: item.thumbnailUri ?? item.video.thumbnail,
              },
              item.fileUri,
            )
          }
        >
          <Image
            source={{ uri: item.thumbnailUri ?? item.video.thumbnail }}
            style={styles.image}
            contentFit="cover"
          />
        </Pressable>
        <View style={styles.content}>
          <ThemedText numberOfLines={2} style={styles.name}>
            {item.video.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.status === 'completed'
              ? t`Downloaded`
              : item.status === 'downloading'
                ? t`Downloading`
                : item.status === 'paused'
                  ? t`Paused`
                  : item.status === 'interrupted'
                    ? t`Interrupted`
                    : t`Failed`}{' '}
            · {Math.round(item.progress * 100)}%
          </ThemedText>
          <View
            style={[styles.track, { backgroundColor: theme.backgroundElement }]}
          >
            <View
              style={[
                styles.progress,
                {
                  width: `${item.progress * 100}%`,
                  backgroundColor: theme.accent,
                },
              ]}
            />
          </View>
        </View>
        {item.status === 'downloading' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t`Pause download`}
            style={styles.control}
            onPress={() => void pause(item.id)}
          >
            <AppIcon name="pause" size={20} />
          </Pressable>
        ) : item.status !== 'completed' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t`Resume download`}
            style={styles.control}
            onPress={() => void resume(item.id)}
          >
            <AppIcon name="play" size={20} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t`Remove download`}
          style={styles.control}
          onPress={() => remove(item.id)}
        >
          <AppIcon name="close" size={20} themeColor="textSecondary" />
        </Pressable>
      </View>
    ),
    [pause, playLocal, remove, resume, t, theme],
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ThemedText style={styles.title}>{t`Downloads`}</ThemedText>
      <FlashList
        data={downloads}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<ScreenState empty />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  image: { width: 112, aspectRatio: 16 / 9, borderRadius: 8 },
  control: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 5 },
  name: { fontWeight: '600' },
  track: { height: 4, overflow: 'hidden', borderRadius: 2 },
  progress: { height: 4 },
});
