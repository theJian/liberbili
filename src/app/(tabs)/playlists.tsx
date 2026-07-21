import { FlashList } from '@shopify/flash-list';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
          <ThemedText style={styles.artIcon}>♫</ThemedText>
        </View>
        <View style={styles.rowText}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plural(item.items.length, { one: '# video', other: '# videos' })}
          </ThemedText>
        </View>
        <ThemedText>›</ThemedText>
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
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder={t`Playlist name`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          onPress={submit}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={styles.buttonText}>＋</ThemedText>
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
  buttonText: { color: '#fff', fontSize: 24 },
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
  artIcon: { fontSize: 24 },
  rowText: { flex: 1, gap: 3 },
  name: { fontWeight: '700' },
});
