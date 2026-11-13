import { DoodleIconProvider } from '@doodle-icons/react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/hooks/use-theme';

/**
 * Decorative defaults for every glyph: the control that contains an icon owns
 * the accessible label, so the artwork itself stays out of the accessibility
 * tree and out of touch handling.
 *
 * These props reach the glyphs through a library internal. `DoodleIconProvider`
 * forwards unknown props into its context and each glyph spreads the rest onto
 * its `<Svg>`. The package is pinned to an exact version so an upgrade cannot
 * drop them silently; re-check this file when bumping it.
 */
const decorative = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

/** Supplies the default size and theme color for every icon in the app. */
export function IconProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <DoodleIconProvider size={24} color={theme.text} {...decorative}>
      {children}
    </DoodleIconProvider>
  );
}
