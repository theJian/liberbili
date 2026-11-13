/**
 * Expo Router's root layout supplies app-wide state, localization, theme, and
 * navigation. Route files render inside this provider tree and stack, with the
 * splash overlay covering startup. HistoryProvider encloses PlayerProvider
 * because playback reads saved positions and records progress through useHistory.
 * IconProvider supplies the default size and theme color for every icon.
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { I18nProvider } from '@lingui/react';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-splash-overlay';
import { IconProvider } from '@/components/icon-provider';
import { i18n } from '@lingui/core';
import { DownloadProvider } from '@/state/downloads';
import { HistoryProvider } from '@/state/history';
import { PlayerProvider } from '@/state/player';
import { PlaylistProvider } from '@/state/playlists';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <I18nProvider i18n={i18n}>
      <IconProvider>
        <PlaylistProvider>
          <DownloadProvider>
            <HistoryProvider>
              <PlayerProvider>
                <ThemeProvider
                  value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
                >
                  <AnimatedSplashOverlay />
                  <Stack
                    screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}
                  >
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="search"
                      options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen
                      name="video/[bvid]"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="open-video"
                      options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen
                      name="playlist/[id]"
                      options={{ title: '' }}
                    />
                  </Stack>
                </ThemeProvider>
              </PlayerProvider>
            </HistoryProvider>
          </DownloadProvider>
        </PlaylistProvider>
      </IconProvider>
    </I18nProvider>
  );
}
