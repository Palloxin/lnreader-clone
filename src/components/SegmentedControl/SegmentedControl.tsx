import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import {
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
} from '@expo/ui/jetpack-compose';
import { ExpoHost, getSegmentedButtonColors } from '@components/ExpoUI';
import { ThemeColors } from '@theme/types';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T, event?: GestureResponderEvent) => void;
  theme: ThemeColors;
  showCheckIcon?: boolean;
  showLabels?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  theme,
  showCheckIcon = true,
  showLabels = true,
}: SegmentedControlProps<T>) {
  /**
   * Compose's SegmentedButton only exposes a `Label` slot and always shows
   * Material 3's default check icon on the selected segment, so icon-only
   * controls (and the unsupported labels-without-check combination) keep the
   * previous React Native implementation below.
   */
  const useComposeSegmentedButtons =
    showLabels && showCheckIcon && !options.some(option => option.icon);

  if (useComposeSegmentedButtons) {
    const colors = getSegmentedButtonColors(theme);
    return (
      <ExpoHost
        theme={theme}
        style={styles.host}
        matchContents={{ vertical: true }}
      >
        <SingleChoiceSegmentedButtonRow>
          {options.map(option => (
            <SegmentedButton
              key={option.value}
              selected={value === option.value}
              onClick={() => onChange(option.value)}
              colors={colors}
            >
              <SegmentedButton.Label>{option.label}</SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </ExpoHost>
    );
  }

  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        const buttonStyles = [
          styles.segment,
          isFirst && styles.segmentFirst,
          isLast && styles.segmentLast,
          !isFirst && !isLast && styles.segmentMiddle,
          {
            backgroundColor: isSelected
              ? theme.secondaryContainer
              : 'transparent',
            borderColor: theme.outline,
          },
        ];

        const textColor = isSelected
          ? theme.onSecondaryContainer
          : theme.onSurface;

        return (
          <View key={option.value} style={buttonStyles}>
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={styles.segmentPressable}
              onPress={e => onChange(option.value, e)}
              android_ripple={{
                color: theme.rippleColor,
                borderless: false,
              }}
            >
              {showCheckIcon && isSelected && (
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color={textColor}
                  style={styles.checkIcon}
                />
              )}
              {option.icon && (!isSelected || !showCheckIcon) && (
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={textColor}
                  style={showLabels ? styles.icon : undefined}
                />
              )}
              {showLabels ? (
                <Text style={[styles.segmentText, { color: textColor }]}>
                  {option.label}
                </Text>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    height: 40,
  },
  segment: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  segmentFirst: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  segmentMiddle: {
    borderRightWidth: 1,
  },
  segmentLast: {
    borderRightWidth: 1,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  segmentPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  checkIcon: {
    marginRight: 8,
  },
  icon: {
    marginRight: 8,
  },
});
