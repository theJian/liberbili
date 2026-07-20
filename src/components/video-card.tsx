import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { VideoSummary } from '@/api/types';
import { formatCount, formatDuration, useI18n } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export const VideoCard = memo(function VideoCard({ video }: { video: VideoSummary }) {
  const theme = useTheme();
  const { locale, t } = useI18n();
  const open = useCallback(() => router.push({ pathname: '/video/[bvid]', params: { bvid: video.bvid } }), [video.bvid]);
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.container, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.thumbnailWrap}>
        <Image source={{ uri: video.thumbnail }} recyclingKey={video.bvid} cachePolicy="memory-disk" contentFit="cover" transition={150} style={styles.thumbnail} />
        <View style={styles.duration}><ThemedText style={styles.durationText}>{formatDuration(video.duration)}</ThemedText></View>
      </View>
      <View style={styles.content}>
        <ThemedText numberOfLines={2} style={styles.title}>{video.title}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">{video.uploader}</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">{formatCount(video.views, locale)} {t('views')}</ThemedText>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  pressed: { opacity: 0.68 },
  thumbnailWrap: { width: 156, aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: '#202124' },
  thumbnail: { width: '100%', height: '100%' },
  duration: { position: 'absolute', right: 5, bottom: 5, backgroundColor: 'rgba(0,0,0,.72)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  durationText: { color: '#fff', fontSize: 11, lineHeight: 14 },
  content: { flex: 1, gap: 4, paddingVertical: 2 },
  title: { fontWeight: '600', lineHeight: 20 },
  divider: { position: 'absolute', bottom: 0, left: 184, right: 16, height: StyleSheet.hairlineWidth },
});
