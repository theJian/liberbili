import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { MiniPlayer } from '@/components/mini-player';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" md="video_library" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label hidden />
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="playlists" hidden />
      <NativeTabs.Trigger name="downloads" hidden />
      <NativeTabs.BottomAccessory>
        <MiniPlayer />
      </NativeTabs.BottomAccessory>
    </NativeTabs>
  );
}
