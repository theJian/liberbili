import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { VideoSummary } from '@/api/types';
import { ScreenState } from '@/components/screen-state';
import { VideoCard } from '@/components/video-card';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/i18n/i18n';
import { usePlayer } from '@/state/player';
import { usePlaylists } from '@/state/playlists';
import { useTheme } from '@/hooks/use-theme';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playlists, removeItem, remove } = usePlaylists();
  const { play } = usePlayer();
  const { t } = useI18n();
  const theme = useTheme();
  const playlist = playlists.find((item) => item.id === id);
  const renderItem = useCallback(({ item }: { item: VideoSummary }) => <View><VideoCard video={item} /><Pressable onPress={() => removeItem(id, item.bvid)} style={styles.remove}><ThemedText type="small" themeColor="textSecondary">{t('remove')}</ThemedText></Pressable></View>, [id, removeItem, t]);
  if (!playlist) return <ScreenState empty />;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: playlist.name }} />
      <View style={styles.actions}><Pressable disabled={!playlist.items.length} onPress={() => void play(playlist.items[0], playlist.items)} style={[styles.play, { backgroundColor: theme.accent }]}><ThemedText style={styles.playText}>▶ {t('play')}</ThemedText></Pressable><Pressable onPress={() => { remove(playlist.id); router.back(); }}><ThemedText themeColor="textSecondary">{t('delete')}</ThemedText></Pressable></View>
      <FlashList data={playlist.items} renderItem={renderItem} keyExtractor={(item) => item.bvid} ListEmptyComponent={<ScreenState empty />} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, actions: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 20 }, play: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }, playText: { color: '#fff', fontWeight: '800' }, remove: { position: 'absolute', right: 16, bottom: 10, padding: 5 } });

