import {
  ChevronsRight,
  Cross,
  Download,
  FolderAdd,
  Forward,
  Heart,
  List,
  Pause,
  Play,
  Search,
} from '@doodle-icons/react-native';
import type { ReactElement } from 'react';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const icons = {
  addPlaylist: FolderAdd,
  chevronRight: ChevronsRight,
  close: Cross,
  download: Download,
  heart: Heart,
  next: Forward,
  pause: Pause,
  play: Play,
  playlist: List,
  search: Search,
} as const;

export type AppIconName = keyof typeof icons;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  themeColor?: ThemeColor;
};

/** Decorative artwork; the containing control owns its accessible label. */
export function AppIcon({
  name,
  size = 24,
  color,
  themeColor = 'text',
}: AppIconProps): ReactElement {
  const theme = useTheme();
  const Icon = icons[name];
  return (
    <Icon
      size={size}
      color={color ?? theme[themeColor]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    />
  );
}
