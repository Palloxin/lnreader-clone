import { getExpoHostThemeProps, getSegmentedButtonColors } from '../theme';
import type { ThemeColors } from '@theme/types';

const baseTheme = {
  isDark: false,
  primary: 'rgb(0, 87, 206)',
  secondaryContainer: 'rgb(220, 226, 249)',
  onSecondaryContainer: 'rgb(21, 27, 44)',
  onSurface: 'rgb(27, 27, 31)',
  outline: 'rgb(117, 119, 128)',
  surfaceDisabled: 'rgba(27, 27, 31, 0.12)',
  onSurfaceDisabled: 'rgba(27, 27, 31, 0.38)',
} as ThemeColors;

describe('getExpoHostThemeProps', () => {
  it('maps a light theme to a light colorScheme and its primary as seedColor', () => {
    expect(getExpoHostThemeProps(baseTheme)).toEqual({
      colorScheme: 'light',
      seedColor: baseTheme.primary,
    });
  });

  it('maps a dark theme to a dark colorScheme', () => {
    expect(
      getExpoHostThemeProps({ ...baseTheme, isDark: true } as ThemeColors),
    ).toEqual({
      colorScheme: 'dark',
      seedColor: baseTheme.primary,
    });
  });

  it('reflects custom theme accent colors so non-default themes stay in seed', () => {
    const customTheme = {
      ...baseTheme,
      primary: 'rgb(250, 128, 114)',
    } as ThemeColors;

    expect(getExpoHostThemeProps(customTheme).seedColor).toBe(
      'rgb(250, 128, 114)',
    );
  });
});

describe('getSegmentedButtonColors', () => {
  it('maps the selected segment to secondaryContainer/onSecondaryContainer', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.activeContainerColor).toBe(baseTheme.secondaryContainer);
    expect(colors.activeContentColor).toBe(baseTheme.onSecondaryContainer);
  });

  it('maps the unselected segment to a transparent container and onSurface text', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.inactiveContainerColor).toBe('transparent');
    expect(colors.inactiveContentColor).toBe(baseTheme.onSurface);
  });

  it('uses the theme outline color for borders in every state', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.activeBorderColor).toBe(baseTheme.outline);
    expect(colors.inactiveBorderColor).toBe(baseTheme.outline);
    expect(colors.disabledActiveBorderColor).toBe(baseTheme.outline);
    expect(colors.disabledInactiveBorderColor).toBe(baseTheme.outline);
  });

  it('maps disabled states to surfaceDisabled/onSurfaceDisabled', () => {
    const colors = getSegmentedButtonColors(baseTheme);

    expect(colors.disabledActiveContainerColor).toBe(baseTheme.surfaceDisabled);
    expect(colors.disabledActiveContentColor).toBe(baseTheme.onSurfaceDisabled);
    expect(colors.disabledInactiveContentColor).toBe(
      baseTheme.onSurfaceDisabled,
    );
  });
});
