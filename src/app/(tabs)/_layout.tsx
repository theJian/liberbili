import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { MiniPlayer } from '@/components/mini-player';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="playlists">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="music.note.list" md="queue_music" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="arrow.down.circle.fill" md="download" />
      </NativeTabs.Trigger>
      <NativeTabs.BottomAccessory><MiniPlayer /></NativeTabs.BottomAccessory>
    </NativeTabs>
  );
}
