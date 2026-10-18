import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { bilibiliExtractorApi } from '@liberbili/api/extractor-api';
import '@/lib/bilibili';
import { useResource } from '@/hooks/use-resource';
import { ScreenState } from './screen-state';
import { ThemedText } from './themed-text';
import { VideoCard } from './video-card';

// The keyed child owns a single BV ID so its data never leaks across routes.
export function RelatedVideos({ bvid }: { bvid: string }) {
  return <RelatedContent key={bvid} bvid={bvid} />;
}
function RelatedContent({ bvid }: { bvid: string }) {
  const { t } = useLingui();
  const [expanded, setExpanded] = useState(false);
  const resource = useResource(() => bilibiliExtractorApi.getRelated(bvid), []);
  const items = [
    ...new Map(
      (resource.data ?? [])
        .filter((item) => item.bvid !== bvid)
        .map((item) => [item.bvid, item]),
    ).values(),
  ];
  return (
    <View>
      <ThemedText
        style={{
          fontSize: 19,
          fontWeight: '800',
          paddingHorizontal: 16,
          marginVertical: 12,
        }}
      >{t`Related videos`}</ThemedText>
      <ScreenState
        loading={resource.loading}
        error={resource.error}
        empty={
          Boolean(resource.data) &&
          !resource.loading &&
          !resource.error &&
          !items.length
        }
        onRetry={resource.reload}
      />
      {(expanded ? items : items.slice(0, 3)).map((item) => (
        <VideoCard key={item.bvid} video={item} />
      ))}
      {items.length > 3 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={{ padding: 16 }}
          onPress={() => setExpanded((value) => !value)}
        >
          <ThemedText>
            {expanded
              ? t`Show fewer related videos`
              : t`Show more related videos`}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}
