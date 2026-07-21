import { FlashList } from '@shopify/flash-list';
import { useLingui } from '@lingui/react/macro';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bilibiliApi } from '@/api/bilibili';
import { VideoSummary } from '@/api/types';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { VideoCard } from '@/components/video-card';
import { useTheme } from '@/hooks/use-theme';

export default function SearchScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<VideoSummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const search = useCallback(
    async (nextPage = 1) => {
      if (!query.trim() || loading) return;
      setLoading(true);
      setError(undefined);
      try {
        const result = await bilibiliApi.searchVideos(query.trim(), nextPage);
        setItems((current) =>
          nextPage === 1 ? result.items : [...current, ...result.items],
        );
        setPage(result.next ? Number(result.next) : 0);
      } catch (value) {
        setError(value as Error);
      } finally {
        setLoading(false);
      }
    },
    [loading, query],
  );
  const renderItem = useCallback(
    ({ item }: { item: VideoSummary }) => <VideoCard video={item} />,
    [],
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title: t`Search` }} />
      <View
        style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search(1)}
          placeholder={t`Search Bilibili videos`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
          autoFocus
        />
        <Pressable
          onPress={() => void search(1)}
          style={[styles.submit, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={styles.submitText}>⌕</ThemedText>
        </Pressable>
      </View>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.bvid}
        onEndReached={() => page > 0 && void search(page)}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <ScreenState
            loading={loading}
            error={error}
            empty={!loading && !error && query.length > 0}
            onRetry={() => void search(1)}
          />
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator style={styles.footer} color={theme.accent} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    margin: 12,
    borderRadius: 14,
    flexDirection: 'row',
    paddingLeft: 14,
    overflow: 'hidden',
  },
  input: { flex: 1, height: 48, fontSize: 16 },
  submit: { width: 54, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 24, textAlign: 'center' },
  footer: { padding: 20 },
});
