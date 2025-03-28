import React, { memo, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Pressable,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import ListView from './ListView';

import { useDeviceOrientation } from '@hooks';
import { coverPlaceholderColor } from '../theme/colors';
import { DisplayModes } from '@screens/library/constants/constants';
import { NovelInfo } from '@database/types';
import { NovelItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { getString } from '@strings/translations';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { defaultCover } from '@plugins/helpers/constants';
import { ActivityIndicator } from 'react-native-paper';

interface UnreadBadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  showDownloadBadges: boolean;
  theme: ThemeColors;
}

interface DownloadBadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  showUnreadBadges: boolean;
  theme: ThemeColors;
}

type CoverItemLibrary =
  | NovelInfo & {
      completeRow?: number;
    };

type CoverItemPlugin =
  | NovelItem & {
      completeRow?: number;
    };

interface INovelCover<TNovel> {
  item: TNovel;
  onPress: () => void;
  libraryStatus: boolean;
  theme: ThemeColors;
  isSelected: boolean;
  addSkeletonLoading?: boolean;
  inActivity?: boolean;
  onLongPress: (item: TNovel) => void;
  selectedNovelIds: number[];
}

function NovelCover<TNovel extends CoverItemLibrary | CoverItemPlugin>({
  item,
  onPress,
  libraryStatus,
  theme,
  isSelected,
  addSkeletonLoading,
  inActivity,
  onLongPress,
  selectedNovelIds,
}: INovelCover<TNovel>) {
  const {
    displayMode = DisplayModes.Comfortable,
    showDownloadBadges = true,
    showUnreadBadges = true,
    novelsPerRow = 3,
  } = useLibrarySettings();

  const window = useWindowDimensions();

  const orientation = useDeviceOrientation();

  const numColumns = useMemo(
    () => (orientation === 'landscape' ? 6 : novelsPerRow),
    [orientation, novelsPerRow],
  );

  const coverHeight = useMemo(
    () => (window.width / numColumns) * (4 / 3),
    [window.width, numColumns],
  );

  const unreadChapters = item.id
    ? item.totalChapters - item.chaptersRead
    : undefined;

  const selectNovel = () => onLongPress(item);

  const uri = item.cover || defaultCover;
  if (item.completeRow) {
    if (!addSkeletonLoading) {
      return <></>;
    }
    return (
      <SourceScreenSkeletonLoading
        theme={theme}
        completeRow={item.completeRow}
      />
    );
  }

  return displayMode !== DisplayModes.List ? (
    <View
      style={[
        {
          flex: 1 / numColumns,
        },
        styles.standardNovelCover,
        isSelected && {
          backgroundColor: theme.primary,
          ...styles.selectedNovelCover,
        },
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={styles.opac}
        onPress={
          selectedNovelIds && selectedNovelIds.length > 0
            ? selectNovel
            : onPress
        }
        onLongPress={selectNovel}
      >
        <View style={styles.badgeContainer}>
          {libraryStatus ? <InLibraryBadge theme={theme} /> : null}
          {item.id ? (
            <>
              {showDownloadBadges && item.chaptersDownloaded > 0 ? (
                <DownloadBadge
                  showUnreadBadges={showUnreadBadges}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={unreadChapters!}
                  theme={theme}
                />
              ) : null}
              {showUnreadBadges && unreadChapters! > 0 ? (
                <UnreadBadge
                  theme={theme}
                  chaptersDownloaded={item.chaptersDownloaded}
                  chaptersUnread={unreadChapters!}
                  showDownloadBadges={showDownloadBadges}
                />
              ) : null}
            </>
          ) : null}
          {inActivity ? <InActivityBadge theme={theme} /> : null}
        </View>
        <Image
          source={{ uri, headers: { 'User-Agent': getUserAgent() } }}
          style={[
            {
              height: coverHeight,
              backgroundColor: coverPlaceholderColor,
            },
            styles.standardBorderRadius,
            libraryStatus && styles.opacityPoint5,
          ]}
        />
        <View style={styles.compactTitleContainer}>
          {displayMode === DisplayModes.Compact ? (
            <CompactTitle novelName={item.name} />
          ) : null}
        </View>
        {displayMode === DisplayModes.Comfortable ? (
          <ComfortableTitle novelName={item.name} theme={theme} />
        ) : null}
      </Pressable>
    </View>
  ) : (
    <ListView
      item={item}
      downloadBadge={
        showDownloadBadges && item.id && item.chaptersDownloaded ? (
          <DownloadBadge
            theme={theme}
            showUnreadBadges={showUnreadBadges}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={unreadChapters!}
          />
        ) : null
      }
      unreadBadge={
        showUnreadBadges && item.id && unreadChapters ? (
          <UnreadBadge
            theme={theme}
            chaptersDownloaded={item.chaptersDownloaded}
            chaptersUnread={unreadChapters}
            showDownloadBadges={showDownloadBadges}
          />
        ) : null
      }
      inLibraryBadge={libraryStatus && <InLibraryBadge theme={theme} />}
      theme={theme}
      onPress={
        selectedNovelIds && selectedNovelIds.length > 0 ? selectNovel : onPress
      }
      onLongPress={selectNovel}
      isSelected={isSelected}
    />
  );
}

export default memo(NovelCover);

const ComfortableTitle = ({
  theme,
  novelName,
}: {
  theme: ThemeColors;
  novelName: string;
}) => (
  <Text
    numberOfLines={2}
    style={[
      styles.title,
      styles.padding4,
      {
        color: theme.onSurface,
      },
    ]}
  >
    {novelName}
  </Text>
);

const CompactTitle = ({ novelName }: { novelName: string }) => (
  <View style={styles.titleContainer}>
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      style={styles.linearGradient}
    >
      <Text numberOfLines={2} style={[styles.title, styles.compactTitle]}>
        {novelName}
      </Text>
    </LinearGradient>
  </View>
);

const InLibraryBadge = ({ theme }: { theme: ThemeColors }) => (
  <Text
    style={[
      styles.inLibraryBadge,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
      },
      styles.standardBorderRadius,
    ]}
  >
    {getString('novelScreen.inLibaray')}
  </Text>
);

const InActivityBadge = ({ theme }: { theme: ThemeColors }) => (
  <View
    style={[
      styles.activityBadge,
      {
        backgroundColor: theme.primary,
      },
      styles.standardBorderRadius,
    ]}
  >
    <ActivityIndicator animating={true} size={10} color={theme.onPrimary} />
  </View>
);

interface BadgeProps {
  chaptersDownloaded: number;
  chaptersUnread: number;
  theme: ThemeColors;
}
interface UnreadBadgeProps extends BadgeProps {
  showDownloadBadges: boolean;
}
interface DownloadBadgeProps extends BadgeProps {
  showUnreadBadges: boolean;
}

const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  chaptersDownloaded,
  chaptersUnread,
  showDownloadBadges,
  theme,
}: UnreadBadgeProps) => (
  <Text
    style={[
      styles.unreadBadge,
      !chaptersDownloaded && styles.LeftBorderRadius,
      !showDownloadBadges && styles.standardBorderRadius,
      {
        backgroundColor: theme.primary,
        color: theme.onPrimary,
      },
    ]}
  >
    {chaptersUnread}
  </Text>
);

const DownloadBadge: React.FC<DownloadBadgeProps> = ({
  chaptersDownloaded,
  showUnreadBadges,
  chaptersUnread,
  theme,
}: DownloadBadgeProps) => (
  <Text
    style={[
      styles.downloadBadge,
      !chaptersUnread && styles.RightBorderRadius,
      !showUnreadBadges && styles.standardBorderRadius,
      {
        backgroundColor: theme.tertiary,
        color: theme.onTertiary,
      },
    ]}
  >
    {chaptersDownloaded}
  </Text>
);

const styles = StyleSheet.create({
  LeftBorderRadius: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 4,
  },
  RightBorderRadius: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
  },
  activityBadge: {
    marginHorizontal: 4,
    padding: 5,
  },
  badgeContainer: {
    flexDirection: 'row',
    left: 10,
    position: 'absolute',
    top: 10,
    zIndex: 1,
  },
  compactTitle: {
    color: 'rgba(255,255,255,1)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  compactTitleContainer: {
    bottom: 4,
    left: 4,
    position: 'absolute',
    right: 4,
  },
  downloadBadge: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 4,
    fontSize: 12,
    paddingHorizontal: 5,
    paddingTop: 2,
  },
  extensionIcon: {
    borderRadius: 4,
    height: 42,
    width: 42,
  },
  inLibraryBadge: {
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  linearGradient: {
    borderRadius: 4,
  },
  listView: {
    alignItems: 'center',
    borderRadius: 4,
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  opac: {
    borderRadius: 4,
    flex: 1,
    padding: 4.8,
  },
  opacityPoint5: { opacity: 0.5 },
  padding4: { padding: 4 },
  selectedNovelCover: {
    opacity: 0.8,
  },
  standardBorderRadius: {
    borderRadius: 4,
  },
  standardNovelCover: {
    borderRadius: 6,
    margin: 2,
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'pt-sans-bold',
    fontSize: 14,
    padding: 8,
  },
  titleContainer: {
    borderRadius: 4,
    flex: 1,
  },
  unreadBadge: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
});
