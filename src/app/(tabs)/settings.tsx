import { useLingui } from '@lingui/react/macro';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { setLocale, type Locale } from '@/i18n';

export default function SettingsScreen() {
  const { i18n, t } = useLingui();
  const theme = useTheme();
  const locale = i18n.locale as Locale;
  const languages: { label: string; locale: Locale }[] = [
    { label: 'English', locale: 'en' },
    { label: '简体中文', locale: 'zh-Hans' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ThemedText style={styles.title}>{t`Settings`}</ThemedText>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>{t`Language`}</ThemedText>
      <View style={[styles.group, { backgroundColor: theme.backgroundElement }]}>
        {languages.map((language, index) => (
          <Pressable
            key={language.locale}
            accessibilityRole="radio"
            accessibilityState={{ checked: locale === language.locale }}
            onPress={() => setLocale(language.locale)}
            style={[styles.row, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <ThemedText style={styles.language}>{language.label}</ThemedText>
            {locale === language.locale ? <ThemedText style={{ color: theme.accent }}>✓</ThemedText> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', padding: 16 },
  sectionTitle: { paddingHorizontal: 20, paddingBottom: 8, textTransform: 'uppercase' },
  group: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  language: { flex: 1 },
});
