import { useLingui } from '@lingui/react/macro';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { PlaybackStatus } from '@/components/playback-status';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { PLAYBACK_SPEEDS, usePlayer, VideoView } from '@/state/player';
import type { RepeatMode } from '@/lib/playback';

export default function PlaybackScreen() {
  const { t, i18n } = useLingui();
  const theme = useTheme();
  const playback = usePlayer();
  const repeatLabels: Record<RepeatMode, string> = {
    off: t`Repeat off`,
    one: t`Repeat one`,
    all: t`Repeat all`,
  };
  const button = {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.backgroundElement,
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, gap: 20 }}
    >
      <Stack.Screen options={{ title: t`Playback and queue` }} />
      {playback.current ? (
        <View style={{ gap: 10 }}>
          <VideoView
            player={playback.player}
            nativeControls
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              backgroundColor: '#000',
            }}
            fullscreenOptions={{ enable: true }}
          />
          <ThemedText type="smallBold">{playback.current.title}</ThemedText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t`Previous`}
              disabled={playback.index <= 0}
              onPress={playback.previous}
              style={button}
            >
              <ThemedText>{t`Previous`}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={playback.loading}
              onPress={playback.toggle}
              style={button}
            >
              <ThemedText>{playback.isPlaying ? t`Pause` : t`Play`}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={playback.index >= playback.queue.length - 1}
              onPress={playback.next}
              style={button}
            >
              <ThemedText>{t`Next`}</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
      <PlaybackStatus />
      <View style={{ gap: 10 }}>
        <ThemedText type="smallBold">{t`Playback speed`}</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PLAYBACK_SPEEDS.map((speed) => (
            <Pressable
              key={speed}
              accessibilityRole="radio"
              accessibilityState={{ checked: playback.speed === speed }}
              onPress={() => playback.setPreferences({ speed })}
              style={button}
            >
              <ThemedText
                style={{
                  color: playback.speed === speed ? theme.accent : theme.text,
                }}
              >
                {speed}×{playback.speed === speed ? ' ✓' : ''}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <ThemedText type="smallBold">{t`Repeat`}</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['off', 'one', 'all'] as const).map((repeat) => (
            <Pressable
              key={repeat}
              accessibilityRole="radio"
              accessibilityState={{ checked: playback.repeat === repeat }}
              onPress={() => playback.setPreferences({ repeat })}
              style={button}
            >
              <ThemedText>
                {repeatLabels[repeat]}
                {playback.repeat === repeat ? ' ✓' : ''}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ThemedText style={{ flex: 1 }}>{t`Autoplay queue`}</ThemedText>
          <Switch
            accessibilityLabel={t`Autoplay queue`}
            value={playback.autoplay}
            onValueChange={(autoplay) => playback.setPreferences({ autoplay })}
          />
        </View>
        <ThemedText
          type="small"
          themeColor="textSecondary"
        >{t`When autoplay is off, playback stops after the current video, including repeats.`}</ThemedText>
      </View>
      <View style={{ gap: 10 }}>
        <ThemedText type="smallBold">{t`Sleep timer`}</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[15, 30, 60].map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              onPress={() => playback.setSleepTimer(minutes)}
              style={button}
            >
              <ThemedText>{t`${minutes} minutes`}</ThemedText>
            </Pressable>
          ))}
        </View>
        {playback.sleepUntil ? (
          <View style={{ gap: 8 }}>
            <ThemedText>
              {t`Playback stops at`}{' '}
              {new Date(playback.sleepUntil).toLocaleTimeString(i18n.locale, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => playback.setSleepTimer()}
              style={button}
            >
              <ThemedText>{t`Cancel sleep timer`}</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ThemedText
            type="small"
            themeColor="textSecondary"
          >{t`Sleep timer is off`}</ThemedText>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <ThemedText type="smallBold">{t`Up next`}</ThemedText>
        {!playback.queue.length ? (
          <ThemedText>{t`Play a video or playlist to build your queue.`}</ThemedText>
        ) : null}
        {playback.queue.map((video, index) => (
          <View
            key={video.bvid}
            style={{
              gap: 8,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: index === playback.index }}
              onPress={() => playback.select(index)}
              style={{ paddingVertical: 8 }}
            >
              <ThemedText numberOfLines={2}>
                {index === playback.index ? '▶ ' : ''}
                {video.title}
              </ThemedText>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                disabled={index === 0}
                onPress={() => playback.move(index, index - 1)}
                style={button}
              >
                <ThemedText>{t`Move up`}</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={index === playback.queue.length - 1}
                onPress={() => playback.move(index, index + 1)}
                style={button}
              >
                <ThemedText>{t`Move down`}</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => playback.remove(index)}
                style={button}
              >
                <ThemedText>{t`Remove`}</ThemedText>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
