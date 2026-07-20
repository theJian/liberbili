import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Comment } from '@/api/types';
import { formatCount, useI18n } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export const CommentCard = memo(function CommentCard({ comment }: { comment: Comment }) {
  const { locale, t } = useI18n();
  const theme = useTheme();
  return <View style={[styles.container, { borderBottomColor: theme.border }]}><Image source={{ uri: comment.avatar }} style={styles.avatar} /><View style={styles.content}><View style={styles.meta}><ThemedText type="smallBold">{comment.author}</ThemedText>{comment.pinned ? <ThemedText type="small" style={{ color: theme.accent }}>PIN</ThemedText> : null}</View><ThemedText style={styles.message}>{comment.message}</ThemedText>{comment.pictures.length ? <Image source={{ uri: comment.pictures[0] }} style={styles.picture} contentFit="cover" /> : null}<ThemedText type="small" themeColor="textSecondary">♡ {formatCount(comment.likes, locale)}{comment.replyCount ? ` · ${comment.replyCount} ${t('replies')}` : ''}</ThemedText>{comment.replies.slice(0, 2).map((reply) => <View key={reply.id} style={[styles.reply, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">{reply.author}</ThemedText><ThemedText type="small">{reply.message}</ThemedText></View>)}</View></View>;
});

const styles = StyleSheet.create({ container: { flexDirection: 'row', gap: 11, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth }, avatar: { width: 38, height: 38, borderRadius: 19 }, content: { flex: 1, gap: 8 }, meta: { flexDirection: 'row', gap: 8, alignItems: 'center' }, message: { lineHeight: 21 }, picture: { width: 180, height: 120, borderRadius: 9 }, reply: { borderRadius: 8, padding: 9, gap: 3 } });
