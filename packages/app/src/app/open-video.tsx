import { useLingui } from '@lingui/react/macro';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { resolveVideoLink } from '@/lib/video-links';

export default function OpenVideoScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const open = async () => {
    if (!input.trim() || pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(false);
    try {
      const video = await resolveVideoLink(input);
      if (mounted.current)
        router.replace({
          pathname: '/video/[bvid]',
          params: { bvid: video.bvid, p: video.page, t: video.timestamp },
        });
    } catch {
      if (mounted.current) setError(true);
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Stack.Screen options={{ title: t`Open video link` }} />
      <ThemedText>{t`Paste a Bilibili video link, b23.tv short link, or BV/av ID.`}</ThemedText>
      <TextInput
        accessibilityLabel={t`Video link or ID`}
        placeholder={t`Video link or ID`}
        placeholderTextColor={theme.textSecondary}
        value={input}
        onChangeText={(value) => {
          setInput(value);
          setError(false);
        }}
        onSubmitEditing={() => void open()}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!loading}
        returnKeyType="go"
        style={{
          minHeight: 48,
          borderRadius: 12,
          padding: 12,
          color: theme.text,
          backgroundColor: theme.backgroundElement,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          disabled: loading || !input.trim(),
          busy: loading,
        }}
        disabled={loading || !input.trim()}
        onPress={() => void open()}
        style={{
          minHeight: 48,
          borderRadius: 12,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: loading || !input.trim() ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={{ color: '#fff', fontWeight: '700' }}>
            {error ? t`Try again` : t`Open video`}
          </ThemedText>
        )}
      </Pressable>
      {error ? (
        <View accessibilityLiveRegion="polite">
          <ThemedText>{t`Could not open this link. Use a regular Bilibili video link or BV/av ID, check your connection, and try again.`}</ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}
