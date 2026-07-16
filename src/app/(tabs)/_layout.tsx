import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { MiniPlayer } from '@/components/mini-player';
import { useI18n } from '@/i18n/i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="playlists">
        <NativeTabs.Trigger.Label>{t('playlists')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="music.note.list" md="queue_music" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Label>{t('downloads')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.down.circle.fill" md="download" />
      </NativeTabs.Trigger>
      <NativeTabs.BottomAccessory><MiniPlayer /></NativeTabs.BottomAccessory>
    </NativeTabs>
  );
}
