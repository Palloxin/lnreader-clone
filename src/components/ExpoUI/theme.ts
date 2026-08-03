import { type ColorSchemeName, type ColorValue } from 'react-native';
import type { SegmentedButtonColors } from '@expo/ui/jetpack-compose';
import { ThemeColors } from '@theme/types';

export interface ExpoHostThemeProps {
  colorScheme: ColorSchemeName;
  seedColor: ColorValue;
}

/**
 * Maps an LNReader theme to the Host props that seed Compose's Material You
 * palette. `seedColor` keeps the generated palette in the theme's hue even on
 * pre-Android-12 devices where dynamic color isn't otherwise available.
 * Components that need exact parity with LNReader's custom themes (e.g.
 * catppuccin, tako) should still pass explicit colors rather than relying on
 * the seed-generated palette alone.
 */
export function getExpoHostThemeProps(theme: ThemeColors): ExpoHostThemeProps {
  return {
    colorScheme: theme.isDark ? 'dark' : 'light',
    seedColor: theme.primary,
  };
}

/**
 * Maps LNReader's segmented-control color roles onto Compose's
 * `SegmentedButtonColors`, mirroring the previous RN implementation
 * (`secondaryContainer`/`onSecondaryContainer` for the selected segment).
 */
export function getSegmentedButtonColors(
  theme: ThemeColors,
): SegmentedButtonColors {
  return {
    activeContainerColor: theme.secondaryContainer,
    activeContentColor: theme.onSecondaryContainer,
    activeBorderColor: theme.outline,
    inactiveContainerColor: 'transparent',
    inactiveContentColor: theme.onSurface,
    inactiveBorderColor: theme.outline,
    disabledActiveContainerColor: theme.surfaceDisabled,
    disabledActiveContentColor: theme.onSurfaceDisabled,
    disabledActiveBorderColor: theme.outline,
    disabledInactiveContainerColor: 'transparent',
    disabledInactiveContentColor: theme.onSurfaceDisabled,
    disabledInactiveBorderColor: theme.outline,
  };
}
