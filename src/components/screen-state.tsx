import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BilibiliError } from '@/api/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export function ScreenState({ loading, error, empty, onRetry }: { loading?: boolean; error?: Error; empty?: boolean; onRetry?: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  if (!loading && !error && !empty) return null;
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color={theme.accent} size="large" /> : null}
      {error ? <ThemedText style={styles.message}>{error instanceof BilibiliError ? t(error.kind) : error.message || t('network')}</ThemedText> : null}
      {empty ? <ThemedText themeColor="textSecondary">{t('noResults')}</ThemedText> : null}
      {error && onRetry ? <Pressable onPress={onRetry} style={[styles.button, { backgroundColor: theme.accent }]}><ThemedText style={styles.buttonText}>{t('retry')}</ThemedText></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { textAlign: 'center' },
  button: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
