import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '../SegmentedControl';
import type { ThemeColors } from '@theme/types';

const mockTheme = {
  isDark: false,
  primary: 'rgb(0, 87, 206)',
  secondaryContainer: 'rgb(220, 226, 249)',
  onSecondaryContainer: 'rgb(21, 27, 44)',
  onSurface: 'rgb(27, 27, 31)',
  outline: 'rgb(117, 119, 128)',
  surfaceDisabled: 'rgba(27, 27, 31, 0.12)',
  onSurfaceDisabled: 'rgba(27, 27, 31, 0.38)',
  rippleColor: 'rgba(0, 87, 206, 0.12)',
} as ThemeColors;

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

describe('SegmentedControl (label-based, Compose path)', () => {
  it('renders every option as a radio-role segment', () => {
    render(
      <SegmentedControl
        options={options}
        value="system"
        onChange={() => {}}
        theme={mockTheme}
      />,
    );

    const segments = screen.getAllByRole('radio');
    expect(segments).toHaveLength(3);
  });

  it('marks only the selected option as checked', () => {
    render(
      <SegmentedControl
        options={options}
        value="light"
        onChange={() => {}}
        theme={mockTheme}
      />,
    );

    const segments = screen.getAllByRole('radio');
    expect(segments[0].props.accessibilityState.checked).toBe(false);
    expect(segments[1].props.accessibilityState.checked).toBe(true);
    expect(segments[2].props.accessibilityState.checked).toBe(false);
  });

  it('calls onChange with the pressed option value', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        options={options}
        value="system"
        onChange={onChange}
        theme={mockTheme}
      />,
    );

    fireEvent.press(screen.getAllByRole('radio')[2]);

    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('maps the selected segment to the theme secondaryContainer colors', () => {
    render(
      <SegmentedControl
        options={options}
        value="light"
        onChange={() => {}}
        theme={mockTheme}
      />,
    );

    const selected = screen.getAllByRole('radio')[1];
    expect(selected.props.colors).toMatchObject({
      activeContainerColor: mockTheme.secondaryContainer,
      activeContentColor: mockTheme.onSecondaryContainer,
    });
  });
});

describe('SegmentedControl (icon-only, React Native fallback)', () => {
  const iconOptions = [
    { value: 'left', label: 'Align left', icon: 'format-align-left' as const },
    {
      value: 'center',
      label: 'Align center',
      icon: 'format-align-center' as const,
    },
  ];

  it('keeps the Pressable-based implementation for icon-only controls', () => {
    render(
      <SegmentedControl
        options={iconOptions}
        value="left"
        onChange={() => {}}
        showCheckIcon={false}
        showLabels={false}
        theme={mockTheme}
      />,
    );

    // The RN fallback renders labels as an accessibilityLabel, not visible text.
    expect(screen.queryByText('Align left')).toBeNull();
    const segment = screen.getByLabelText('Align left');
    expect(segment.props.accessibilityRole).toBe('radio');
    expect(segment.props.accessibilityState).toEqual({ checked: true });
  });

  it('still calls onChange with the option value and press event', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        options={iconOptions}
        value="left"
        onChange={onChange}
        showCheckIcon={false}
        showLabels={false}
        theme={mockTheme}
      />,
    );

    fireEvent.press(screen.getByLabelText('Align center'), {
      nativeEvent: {},
    });

    expect(onChange).toHaveBeenCalledWith(
      'center',
      expect.objectContaining({ nativeEvent: expect.anything() }),
    );
  });
});
