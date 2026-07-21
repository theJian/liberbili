import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export default function LibraryScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const items = [
    { title: t`Playlists`, icon: '♫', route: '/(tabs)/playlists' as const },
    { title: t`Downloads`, icon: '↓', route: '/(tabs)/downloads' as const },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ThemedText style={styles.title}>{t`Library`}</ThemedText>
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            onPress={() => router.push(item.route)}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={[styles.icon, { backgroundColor: theme.background }]}>
              <ThemedText style={styles.iconText}>{item.icon}</ThemedText>
            </View>
            <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', padding: 16 },
  list: { paddingHorizontal: 16, gap: 10 },
  row: { minHeight: 72, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 24 },
  rowTitle: { flex: 1, fontWeight: '700' },
});
