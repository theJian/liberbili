import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useLingui } from '@lingui/react/macro';

import { MiniPlayer } from '@/components/mini-player';

export default function TabsLayout() {
  const { t } = useLingui();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t`Home`}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="playlists">
        <NativeTabs.Trigger.Label>{t`Playlists`}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="music.note.list" md="queue_music" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Label>{t`Downloads`}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.down.circle.fill" md="download" />
      </NativeTabs.Trigger>
      <NativeTabs.BottomAccessory><MiniPlayer /></NativeTabs.BottomAccessory>
    </NativeTabs>
  );
}
