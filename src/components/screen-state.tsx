import { useLingui } from '@lingui/react/macro';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BilibiliError } from '@/api/types';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export function ScreenState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: Error;
  empty?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  if (!loading && !error && !empty) return null;
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color={theme.accent} size="large" /> : null}
      {error ? (
        <ThemedText style={styles.message}>
          {error instanceof BilibiliError
            ? error.kind === 'antiBot'
              ? t`Bilibili blocked this request. Please retry.`
              : error.kind === 'unavailable'
                ? t`This video is unavailable.`
                : error.kind === 'restricted'
                  ? t`This video is not available in your region.`
                  : error.kind === 'loginRequired'
                    ? t`This content requires a Bilibili account.`
                    : error.kind === 'invalidResponse'
                      ? t`Bilibili returned an unexpected response.`
                      : t`Unable to reach Bilibili.`
            : error.message || t`Unable to reach Bilibili.`}
        </ThemedText>
      ) : null}
      {empty ? (
        <ThemedText themeColor="textSecondary">{t`Nothing here yet`}</ThemedText>
      ) : null}
      {error && onRetry ? (
        <Pressable
          onPress={onRetry}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={styles.buttonText}>{t`Try again`}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  message: { textAlign: 'center' },
  button: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
