import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { I18nProvider } from '@/i18n';
import { DownloadProvider } from '@/state/downloads';
import { PlayerProvider } from '@/state/player';
import { PlaylistProvider } from '@/state/playlists';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <I18nProvider>
      <PlaylistProvider>
        <DownloadProvider>
          <PlayerProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="search" options={{ presentation: 'modal' }} />
                <Stack.Screen name="video/[bvid]" options={{ title: '' }} />
                <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
              </Stack>
            </ThemeProvider>
          </PlayerProvider>
        </DownloadProvider>
      </PlaylistProvider>
    </I18nProvider>
  );
}
