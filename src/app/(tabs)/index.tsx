import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bilibiliApi } from '@/api/bilibili';
import { VideoSummary } from '@/api/types';
import { ScreenState } from '@/components/screen-state';
import { VideoCard } from '@/components/video-card';
import { ThemedText } from '@/components/themed-text';
import { useResource } from '@/hooks/use-resource';
import { useI18n } from '@/i18n/i18n';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { data = [], loading, error, reload } = useResource(() => bilibiliApi.getRecommendations(), []);
  const { locale, setLocale, t } = useI18n();
  const theme = useTheme();
  const renderItem = useCallback(({ item }: { item: VideoSummary }) => <VideoCard video={item} />, []);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View><ThemedText style={styles.brand}>LiberBili</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('recommended')}</ThemedText></View>
        <Pressable onPress={() => router.push('/search')} style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={t('search')}><ThemedText style={styles.searchIcon}>⌕</ThemedText></Pressable>
        <Pressable onPress={() => setLocale(locale === 'en' ? 'zh-Hans' : 'en')} style={[styles.language, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">{locale === 'en' ? '中' : 'EN'}</ThemedText></Pressable>
      </View>
      <FlashList data={data} renderItem={renderItem} keyExtractor={(item) => item.bvid} refreshing={loading && data.length > 0} onRefresh={reload} contentContainerStyle={styles.list} ListEmptyComponent={<ScreenState loading={loading} error={error} empty={!loading && !error} onRetry={reload} />} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brand: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.7 }, roundButton: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { fontSize: 26, lineHeight: 28 }, language: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, list: { paddingBottom: 84 },
});

