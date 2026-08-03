/**
 * Jest can't run the native Jetpack Compose views @expo/ui renders on
 * Android, so this replaces the jetpack-compose entry point with plain React
 * Native primitives that preserve the props/callbacks LNReader wrappers rely
 * on (selection state, onClick, colors) for behavioral testing.
 */
jest.mock('@expo/ui/jetpack-compose', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');

  const Host = ({ children, style }) =>
    React.createElement(View, { style }, children);

  const SingleChoiceSegmentedButtonRow = ({ children }) =>
    React.createElement(View, { accessibilityRole: 'radiogroup' }, children);

  const MultiChoiceSegmentedButtonRow = ({ children }) =>
    React.createElement(View, null, children);

  const SegmentedButtonLabel = ({ children }) =>
    React.createElement(Text, null, children);

  const SegmentedButton = ({
    selected,
    checked,
    onClick,
    onCheckedChange,
    enabled = true,
    colors,
    children,
  }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: 'radio',
        accessibilityState: {
          checked: selected ?? checked ?? false,
          disabled: !enabled,
        },
        disabled: !enabled,
        onPress: () => {
          onClick?.();
          if (onCheckedChange) onCheckedChange(!checked);
        },
        testID: 'segmented-button',
        colors,
      },
      children,
    );
  SegmentedButton.Label = SegmentedButtonLabel;

  return {
    Host,
    SingleChoiceSegmentedButtonRow,
    MultiChoiceSegmentedButtonRow,
    SegmentedButton,
    useMaterialColors: jest.fn(() => ({})),
    getMaterialColors: jest.fn(() => ({})),
    isDynamicColorAvailable: false,
  };
});
