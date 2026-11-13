import { FlashList } from '@shopify/flash-list';
import { ChevronsRight, FolderAdd, List } from '@doodle-icons/react-native';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLAYLIST_NAME_LIMIT } from '@/lib/playlist-data';
import { ThemedText } from '@/components/themed-text';
import { ScreenState } from '@/components/screen-state';
import { Playlist, usePlaylists } from '@/state/playlists';
import { useTheme } from '@/hooks/use-theme';

export default function PlaylistsScreen() {
  const { playlists, create } = usePlaylists();
  const { t } = useLingui();
  const theme = useTheme();
  const [name, setName] = useState('');
  const submit = useCallback(() => {
    if (name.trim()) {
      create(name);
      setName('');
    }
  }, [create, name]);
  const renderItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <Pressable
        onPress={() =>
          router.push({ pathname: '/playlist/[id]', params: { id: item.id } })
        }
        style={[styles.row, { borderBottomColor: theme.border }]}
      >
        <View
          style={[styles.art, { backgroundColor: theme.backgroundElement }]}
        >
          <List />
        </View>
        <View style={styles.rowText}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plural(item.items.length, { one: '# video', other: '# videos' })}
          </ThemedText>
        </View>
        <ChevronsRight size={18} />
      </Pressable>
    ),
    [theme],
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ThemedText style={styles.title}>{t`Playlists`}</ThemedText>
      <View
        style={[styles.create, { backgroundColor: theme.backgroundElement }]}
      >
        <TextInput
          value={name}
          maxLength={PLAYLIST_NAME_LIMIT}
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder={t`Playlist name`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel={t`Create playlist`}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <FolderAdd color="#fff" />
        </Pressable>
      </View>
      <FlashList
        data={playlists}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<ScreenState empty />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', padding: 16 },
  create: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    paddingLeft: 14,
  },
  input: { flex: 1, height: 48 },
  button: { width: 52, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  art: {
    width: 54,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3 },
  name: { fontWeight: '700' },
});
