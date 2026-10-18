import { FlashList } from '@shopify/flash-list';
import { useLingui } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bilibiliExtractorApi } from '@liberbili/api/extractor-api';
import '@/lib/bilibili';
import { CreatorUploads, isCreatorId } from '@/lib/creator-uploads';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { VideoCard } from '@/components/video-card';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { formatCount } from '@/i18n';

export default function CreatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CreatorContent key={id} id={id} />;
}

function CreatorContent({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const theme = useTheme();
  const valid = isCreatorId(id);
  const profile = useResource(
    () =>
      valid
        ? bilibiliExtractorApi.getChannel(id)
        : Promise.reject(new Error(t`Invalid creator`)),
    [],
  );
  const [uploads] = useState(
    () =>
      new CreatorUploads((cursor, lastAid) =>
        bilibiliExtractorApi.getChannelVideosWithFallback(
          id,
          cursor ?? 1,
          lastAid,
        ),
      ),
  );
  const { items, loading, error, started } = useSyncExternalStore(
    uploads.subscribe,
    uploads.getSnapshot,
    uploads.getSnapshot,
  );
  useEffect(() => {
    if (valid) void uploads.load();
  }, [uploads, valid]);
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Stack.Screen options={{ title: profile.data?.name ?? t`Creator` }} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.bvid}
        renderItem={({ item }) => <VideoCard video={item} />}
        onEndReached={() => valid && void uploads.more()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            {profile.data ? (
              <View style={styles.profile}>
                {profile.data.banner ? (
                  <Image
                    source={{ uri: profile.data.banner }}
                    style={styles.banner}
                    contentFit="cover"
                  />
                ) : null}
                <Image
                  source={{ uri: profile.data.avatar }}
                  style={styles.avatar}
                />
                <ThemedText type="subtitle">{profile.data.name}</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {formatCount(profile.data.followers, i18n.locale)}{' '}
                  {t`followers`}
                </ThemedText>
                {profile.data.description ? (
                  <ThemedText>{profile.data.description}</ThemedText>
                ) : null}
              </View>
            ) : (
              <ScreenState
                loading={profile.loading}
                error={profile.error}
                onRetry={profile.reload}
              />
            )}
            {valid ? (
              <ThemedText style={styles.heading}>{t`Uploads`}</ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          valid ? (
            <ScreenState
              loading={loading}
              error={error}
              empty={started && !loading && !error}
              onRetry={() => void uploads.load()}
            />
          ) : null
        }
        ListFooterComponent={
          items.length ? (
            loading ? (
              <ActivityIndicator style={styles.footer} color={theme.accent} />
            ) : error ? (
              <ScreenState error={error} onRetry={() => void uploads.load()} />
            ) : null
          ) : null
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  profile: { padding: 16, gap: 10 },
  banner: { width: '100%', height: 100, borderRadius: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  heading: { fontSize: 20, fontWeight: '700', margin: 16 },
  footer: { padding: 20 },
});
