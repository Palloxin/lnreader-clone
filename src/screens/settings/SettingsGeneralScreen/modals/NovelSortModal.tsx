import React from 'react';
import { Text, StyleSheet } from 'react-native';

import { Portal } from 'react-native-paper';

import {
  LibrarySortOrder,
  librarySortOrderList,
} from '@screens/library/constants/constants';
import { ThemeColors } from '@theme/types';
import { SortItem } from '@components/Checkbox/Checkbox';
import { useLibrarySettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { Modal } from '@components';

interface NovelSortModalProps {
  novelSortModalVisible: boolean;
  hideNovelSortModal: () => void;
  theme: ThemeColors;
}

const NovelSortModal: React.FC<NovelSortModalProps> = ({
  novelSortModalVisible,
  hideNovelSortModal,
  theme,
}) => {
  const { sortOrder = LibrarySortOrder.DateAdded_DESC, setLibrarySettings } =
    useLibrarySettings();
  return (
    <Portal>
      <Modal visible={novelSortModalVisible} onDismiss={hideNovelSortModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.sortOrder')}
        </Text>
        {librarySortOrderList.map(item => (
          <SortItem
            key={item.ASC}
            label={item.label}
            theme={theme}
            status={
              sortOrder === item.ASC
                ? 'asc'
                : sortOrder === item.DESC
                ? 'desc'
                : undefined
            }
            onPress={() =>
              setLibrarySettings({
                sortOrder: sortOrder === item.ASC ? item.DESC : item.ASC,
              })
            }
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default NovelSortModal;

const styles = StyleSheet.create({
  modalDescription: {
    fontSize: 16,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  modalHeader: {
    fontSize: 24,
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  slider: {
    height: 40,
    width: '100%',
  },
});
