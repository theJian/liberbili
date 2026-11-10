/**
 * Library tab route: opens watch history, playlists, and downloads through Expo
 * Router. Its HistoryPreview links unfinished playback to the history screen;
 * the root layout supplies the HistoryProvider required by that preview.
 */
import {
  ChevronsRight,
  Clock,
  Download,
  List,
  type DoodleIconProps,
} from '@doodle-icons/react-native';
import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HistoryPreview } from '@/components/history-preview';
import { useTheme } from '@/hooks/use-theme';

type IconComponent = ComponentType<DoodleIconProps>;

export default function LibraryScreen() {
  const { t } = useLingui();
  const theme = useTheme();
  const items: {
    title: string;
    icon: IconComponent;
    route: '/history' | '/(tabs)/playlists' | '/(tabs)/downloads';
  }[] = [
    {
      title: t`Watch history`,
      icon: Clock,
      route: '/history',
    },
    {
      title: t`Playlists`,
      icon: List,
      route: '/(tabs)/playlists',
    },
    {
      title: t`Downloads`,
      icon: Download,
      route: '/(tabs)/downloads',
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
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
              <item.icon />
            </View>
            <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
            <ChevronsRight size={18} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>
      <HistoryPreview />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', padding: 16 },
  list: { paddingHorizontal: 16, gap: 10 },
  row: {
    minHeight: 72,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flex: 1, fontWeight: '700' },
});
