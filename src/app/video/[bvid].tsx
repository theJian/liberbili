import { FlashList } from '@shopify/flash-list';
import { useLingui } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { bilibiliApi } from '@/api/bilibili';
import { Comment, VideoPart, VideoSummary } from '@/api/types';
import { CommentCard } from '@/components/comment-card';
import { ScreenState } from '@/components/screen-state';
import { ThemedText } from '@/components/themed-text';
import { useResource } from '@/hooks/use-resource';
import { formatCount, formatDuration } from '@/i18n';
import { useDownloads } from '@/state/downloads';
import { usePlayer, VideoView } from '@/state/player';
import { usePlaylists } from '@/state/playlists';
import { useTheme } from '@/hooks/use-theme';

export default function VideoScreen() {
  const { bvid } = useLocalSearchParams<{ bvid: string }>();
  const detailResource = useResource(() => bilibiliApi.getVideo(bvid), [bvid]);
  const detail = detailResource.data;
  const { i18n, t } = useLingui();
  const theme = useTheme();
  const { player, current, play, playPart } = usePlayer();
  const { start } = useDownloads();
  const { playlists, add } = usePlaylists();
  const initialComments = useResource(
    () =>
      detail
        ? bilibiliApi.getComments(detail.aid)
        : Promise.resolve({ items: [] }),
    [detail?.aid],
  );
  const [moreComments, setMoreComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [commentLoading, setCommentLoading] = useState(false);
  const [choosingPlaylist, setChoosingPlaylist] = useState(false);
  const summary = useMemo<VideoSummary | undefined>(
    () =>
      detail && {
        bvid: detail.bvid,
        aid: detail.aid,
        title: detail.title,
        thumbnail: detail.thumbnail,
        uploader: detail.uploader,
        uploaderAvatar: detail.uploaderAvatar,
        duration: detail.duration,
        views: detail.views,
        publishedAt: detail.publishedAt,
      },
    [detail],
  );
  useEffect(() => {
    if (summary && current?.bvid !== summary.bvid) void play(summary);
  }, [current?.bvid, play, summary]);
  const loadComments = useCallback(async () => {
    const cursor = nextCursor ?? initialComments.data?.next;
    if (!detail || commentLoading || !cursor) return;
    setCommentLoading(true);
    try {
      const result = await bilibiliApi.getComments(detail.aid, cursor);
      setMoreComments((all) => [...all, ...result.items]);
      setNextCursor(result.next ?? '');
    } finally {
      setCommentLoading(false);
    }
  }, [commentLoading, detail, initialComments.data?.next, nextCursor]);
  const renderComment = useCallback(
    ({ item }: { item: Comment }) => <CommentCard comment={item} />,
    [],
  );
  if (!detail || !summary)
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <ScreenState
          loading={detailResource.loading}
          error={detailResource.error}
          onRetry={detailResource.reload}
        />
      </View>
    );
  const header = (
    <View>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        fullscreenOptions={{ enable: true }}
      />
      <View style={styles.info}>
        <ThemedText style={styles.title}>{detail.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatCount(detail.views, i18n.locale)} {t`views`} ·{' '}
          {formatCount(detail.likes, i18n.locale)} {t`likes`} ·{' '}
          {formatCount(detail.comments, i18n.locale)} {t`Comments`}
        </ThemedText>
        <View style={styles.uploader}>
          {detail.uploaderAvatar ? (
            <Image
              source={{ uri: detail.uploaderAvatar }}
              style={styles.avatar}
            />
          ) : null}
          <ThemedText type="smallBold">{detail.uploader}</ThemedText>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => setChoosingPlaylist((value) => !value)}
            style={[
              styles.action,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText>＋ {t`Add to playlist`}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void start(summary)}
            style={[styles.action, { backgroundColor: theme.accent }]}
          >
            <ThemedText style={styles.actionPrimary}>
              ↓ {t`Download`}
            </ThemedText>
          </Pressable>
        </View>
        {choosingPlaylist ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlistChoices}
          >
            {playlists.length ? (
              playlists.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  onPress={() => {
                    add(playlist.id, summary);
                    setChoosingPlaylist(false);
                  }}
                  style={[styles.chip, { borderColor: theme.border }]}
                >
                  <ThemedText type="smallBold">{playlist.name}</ThemedText>
                </Pressable>
              ))
            ) : (
              <ThemedText themeColor="textSecondary">{t`Create a playlist first.`}</ThemedText>
            )}
          </ScrollView>
        ) : null}
        {detail.parts.length > 1 ? (
          <View>
            <ThemedText
              type="smallBold"
              style={styles.sectionLabel}
            >{t`Parts`}</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.parts}
            >
              {detail.parts.map((part: VideoPart) => (
                <Pressable
                  key={part.cid}
                  onPress={() => void playPart(summary, part)}
                  style={[
                    styles.part,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ThemedText type="smallBold">P{part.page}</ThemedText>
                  <ThemedText type="small" numberOfLines={1}>
                    {part.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDuration(part.duration)}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {detail.description ? (
          <View style={styles.description}>
            <ThemedText type="smallBold">{t`Description`}</ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.descriptionText}
            >
              {detail.description}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText style={styles.commentsTitle}>{t`All comments`}</ThemedText>
      </View>
    </View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: detail.title }} />
      <FlashList
        data={[...(initialComments.data?.items ?? []), ...moreComments]}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        onEndReached={loadComments}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          commentLoading || initialComments.loading ? (
            <ActivityIndicator style={styles.footer} color={theme.accent} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  info: { paddingVertical: 16, gap: 12 },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '700',
    paddingHorizontal: 16,
  },
  uploader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  action: { flex: 1, borderRadius: 999, padding: 11, alignItems: 'center' },
  actionPrimary: { color: '#fff', fontWeight: '700' },
  playlistChoices: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  sectionLabel: { paddingHorizontal: 16, marginBottom: 8 },
  parts: { paddingHorizontal: 16, gap: 8 },
  part: { width: 140, borderRadius: 10, padding: 10, gap: 3 },
  description: { paddingHorizontal: 16, gap: 5 },
  descriptionText: { lineHeight: 21 },
  commentsTitle: {
    fontSize: 19,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  footer: { padding: 20 },
});
