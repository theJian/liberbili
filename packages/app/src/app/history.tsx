import { useLingui } from '@lingui/react/macro';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Switch, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/i18n';
import { historyKey, type HistoryEntry } from '@/lib/watch-history';
import { useHistory } from '@/state/history';
import { usePlayer } from '@/state/player';

export default function HistoryScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const { entries, paused, setPaused, remove, clear } = useHistory();
  const { playPart } = usePlayer();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const open = async (entry: HistoryEntry) => {
    if (opening) return;
    setOpening(true);
    setError(undefined);
    try {
      await playPart(entry.video, entry.part);
      router.push({
        pathname: '/video/[bvid]',
        params: { bvid: entry.video.bvid },
      });
    } catch {
      setError(t`Unable to resume this video. Try again.`);
    } finally {
      setOpening(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: t`Watch history` }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        data={entries}
        keyExtractor={historyKey}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <ThemedText
                style={{ flex: 1 }}
              >{t`Pause watch history`}</ThemedText>
              <Switch
                accessibilityLabel={t`Pause watch history`}
                value={paused}
                onValueChange={setPaused}
              />
            </View>
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >{t`History is stored on this device. Downloaded videos do not update history.`}</ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={!entries.length}
              onPress={() =>
                Alert.alert(
                  t`Clear watch history?`,
                  t`This removes saved playback positions on this device.`,
                  [
                    { text: t`Cancel`, style: 'cancel' },
                    {
                      text: t`Clear history`,
                      style: 'destructive',
                      onPress: clear,
                    },
                  ],
                )
              }
              style={{ paddingVertical: 8 }}
            >
              <ThemedText>{t`Clear history`}</ThemedText>
            </Pressable>
            {error ? (
              <ThemedText accessibilityRole="alert">{error}</ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary">{t`Videos you watch will appear here.`}</ThemedText>
        }
        renderItem={({ item }) => (
          <View
            style={{
              gap: 8,
              borderBottomWidth: 1,
              borderColor: theme.border,
              paddingBottom: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              disabled={opening}
              onPress={() => void open(item)}
              style={{ gap: 4, paddingVertical: 8 }}
            >
              <ThemedText numberOfLines={2}>{item.video.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                P{item.part.page} · {item.part.title}
              </ThemedText>
              <ThemedText type="small">
                {item.completed
                  ? t`Completed`
                  : `${formatDuration(item.position)} / ${formatDuration(item.duration)}`}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t`Remove from watch history`}
              onPress={() => remove(historyKey(item))}
              style={{ paddingVertical: 8 }}
            >
              <ThemedText type="small">{t`Remove from watch history`}</ThemedText>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
