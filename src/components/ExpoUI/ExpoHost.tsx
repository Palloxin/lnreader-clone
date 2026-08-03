import { Host, type HostProps } from '@expo/ui/jetpack-compose';
import { ThemeColors } from '@theme/types';
import { getExpoHostThemeProps } from './theme';

export interface ExpoHostProps
  extends Omit<HostProps, 'colorScheme' | 'seedColor'> {
  /** LNReader theme used to derive the Host's colorScheme and seedColor. */
  theme: ThemeColors;
}

/**
 * LNReader's reusable entry point into a Jetpack Compose subtree. Screens and
 * other components should render Compose primitives through this wrapper (or
 * one built on it) instead of importing `@expo/ui` directly, so the
 * colorScheme/seedColor mapping stays centralized in one place.
 */
export function ExpoHost({ theme, children, ...rest }: ExpoHostProps) {
  const { colorScheme, seedColor } = getExpoHostThemeProps(theme);

  return (
    <Host colorScheme={colorScheme} seedColor={seedColor} {...rest}>
      {children}
    </Host>
  );
}
