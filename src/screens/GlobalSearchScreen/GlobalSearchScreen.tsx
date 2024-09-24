import React from 'react';

import { ProgressBar } from 'react-native-paper';

import { EmptyView, SearchbarV2 } from '@components/index';
import GlobalSearchResultsList from './components/GlobalSearchResultsList';

import { useSearch } from '@hooks';
import { useTheme } from '@hooks/persisted';

import { getString } from '@strings/translations';
import { useGlobalSearch } from './hooks/useGlobalSearch';

interface Props {
  route?: {
    params?: {
      searchText?: string;
    };
  };
}

let lastSearchStart = 0;

const GlobalSearchScreen = (props: Props) => {
  const theme = useTheme();
  const { searchText, setSearchText, clearSearchbar } = useSearch(
    props?.route?.params?.searchText,
  );
  const onChangeText = (text: string) => setSearchText(text);
  const onSubmitEditing = () => {
    globalSearch(searchText);
    lastSearchStart = Date.now();
  };

  const { searchResults, globalSearch, progress } = useGlobalSearch({
    defaultSearchText: searchText,
  });

  console.log('Rendering... ' + progress);
  if (progress >= 0.9 && lastSearchStart > 0) {
    console.log('Search took ' + (Date.now() - lastSearchStart) + 'ms');
    lastSearchStart = 0;
  }

  let start = Date.now();
  let ret = (
    <>
      <SearchbarV2
        searchText={searchText}
        placeholder={getString('browseScreen.globalSearch')}
        leftIcon="magnify"
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        clearSearchbar={clearSearchbar}
        theme={theme}
      />
      {progress ? (
        <ProgressBar color={theme.primary} progress={progress} />
      ) : null}
      <GlobalSearchResultsList
        searchResults={searchResults}
        ListEmptyComponent={
          <EmptyView
            icon="__φ(．．)"
            description={`${getString('globalSearch.searchIn')} ${getString(
              'globalSearch.allSources',
            )}`}
            theme={theme}
          />
        }
      />
    </>
  );
  console.log('Rendering took ' + (Date.now() - start) + 'ms');
  return ret;
};

export default GlobalSearchScreen;
