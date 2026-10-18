import { FlashList } from '@shopify/flash-list';
import { useLingui } from '@lingui/react/macro';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  SearchDuration,
  SearchOrder,
  VideoSummary,
} from '@liberbili/api/types';

import '@/lib/bilibili';
import { bilibiliExtractorApi } from '@liberbili/api/extractor-api';
import { storage } from '@/storage';
import {
  readRecentSearches,
  rememberSearch,
  SEARCH_HISTORY_KEY,
  SearchSession,
} from '@/lib/search-session';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { VideoCard } from '@/components/video-card';
import { useTheme } from '@/hooks/use-theme';

export default function SearchScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<SearchOrder>('totalrank');
  const [duration, setDuration] = useState<SearchDuration>(0);
  const [history, setHistory] = useState(() =>
    readRecentSearches(storage.getString(SEARCH_HISTORY_KEY)),
  );
  const [session] = useState(
    () =>
      new SearchSession(async (selection, page) => {
        const result = await bilibiliExtractorApi.search(selection.query, {
          type: 'video',
          order: selection.order,
          duration: selection.duration,
          page,
        });
        return {
          ...result,
          items: result.items.filter(
            (item): item is VideoSummary => item.type !== 'channel',
          ),
        };
      }),
  );
  const { items, loading, error, selection } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    storage.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }, [history]);
  const search = (text = query, nextOrder = order, nextDuration = duration) => {
    if (!text.trim()) return;
    setQuery(text.trim());
    setHistory((current) => rememberSearch(current, text));
    void session.submit({
      query: text,
      order: nextOrder,
      duration: nextDuration,
    });
  };
  const orders: [SearchOrder, string][] = [
    ['totalrank', t`Relevance`],
    ['click', t`Most viewed`],
    ['pubdate', t`Newest`],
    ['stow', t`Most saved`],
  ];
  const durations: [SearchDuration, string][] = [
    [0, t`Any duration`],
    [1, t`Under 10 minutes`],
    [2, t`10–30 minutes`],
    [3, t`30–60 minutes`],
    [4, t`Over 60 minutes`],
  ];
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
          onSubmitEditing={() => search()}
          placeholder={t`Search Bilibili videos`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
          autoFocus
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t`Search`}
          onPress={() => search()}
          style={[styles.submit, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={styles.submitText}>⌕</ThemedText>
        </Pressable>
      </View>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {orders.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: order === value }}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    order === value
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                },
              ]}
              onPress={() => {
                setOrder(value);
                if (selection) search(selection.query, value, duration);
              }}
            >
              <ThemedText>{label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {durations.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: duration === value }}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    duration === value
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                },
              ]}
              onPress={() => {
                setDuration(value);
                if (selection) search(selection.query, order, value);
              }}
            >
              <ThemedText>{label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {history.length > 0 ? (
        <View style={styles.history}>
          <View style={styles.historyHeading}>
            <ThemedText>{t`Recent searches`}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setHistory([])}
            >
              <ThemedText>{t`Clear searches`}</ThemedText>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {history.map((text) => (
              <View
                key={text}
                style={[
                  styles.historyItem,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => search(text)}
                  style={styles.historyQuery}
                >
                  <ThemedText>{text}</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t`Remove search: ${text}`}
                  style={styles.remove}
                  onPress={() =>
                    setHistory((current) =>
                      current.filter((item) => item !== text),
                    )
                  }
                >
                  <ThemedText>×</ThemedText>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.bvid}
        onEndReached={() => void session.more()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <ScreenState
            loading={loading}
            error={error}
            empty={!loading && !error && Boolean(selection)}
            onRetry={() => void session.retry()}
          />
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator style={styles.footer} color={theme.accent} />
          ) : items.length && error ? (
            <ScreenState error={error} onRetry={() => void session.retry()} />
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
  filters: { gap: 8, paddingHorizontal: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 8,
  },
  history: { margin: 12, gap: 8 },
  historyHeading: { flexDirection: 'row', justifyContent: 'space-between' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginRight: 8,
  },
  historyQuery: { padding: 12 },
  remove: { padding: 12 },
});
