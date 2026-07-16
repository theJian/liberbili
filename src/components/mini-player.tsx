import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n/i18n';
import { usePlayer } from '@/state/player';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export function MiniPlayer() {
  const { current, isPlaying, toggle, next } = usePlayer();
  const { t } = useI18n();
  const theme = useTheme();
  if (!current) return null;
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border }]}>
      <Pressable style={styles.main} onPress={() => router.push({ pathname: '/video/[bvid]', params: { bvid: current.bvid } })}>
        <Image source={{ uri: current.thumbnail }} style={styles.image} contentFit="cover" />
        <View style={styles.text}><ThemedText numberOfLines={1} style={styles.title}>{current.title}</ThemedText><ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{current.uploader}</ThemedText></View>
      </Pressable>
      <Pressable onPress={toggle} accessibilityLabel={isPlaying ? t('pause') : t('play')} style={styles.control}><ThemedText style={styles.icon}>{isPlaying ? 'Ⅱ' : '▶'}</ThemedText></Pressable>
      <Pressable onPress={next} accessibilityLabel={t('next')} style={styles.control}><ThemedText style={styles.icon}>▶|</ThemedText></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  image: { width: 92, height: 52, marginLeft: 6, borderRadius: 7 },
  text: { flex: 1 }, title: { fontWeight: '600' }, control: { width: 48, alignItems: 'center', justifyContent: 'center', height: 56 }, icon: { fontWeight: '800' },
});

