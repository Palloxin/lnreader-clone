import { useEffect, useRef, useState } from 'react';

import { NovelItem, PluginItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { usePlugins } from '@hooks/persisted';

interface Props {
  defaultSearchText?: string;
}

export interface GlobalSearchResult {
  isLoading: boolean;
  plugin: PluginItem;
  novels: NovelItem[];
  error?: string | null;
}

export const useGlobalSearch = ({ defaultSearchText }: Props) => {
  const isMounted = useRef(true);

  const { filteredInstalledPlugins } = usePlugins();

  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [progress, setProgress] = useState(0);

  const globalSearch = (searchText: string) => {
    const defaultResult: GlobalSearchResult[] = filteredInstalledPlugins.map(
      plugin => ({
        isLoading: true,
        plugin,
        novels: [],
        error: null,
      }),
    );

    setSearchResults(defaultResult);

    //Sort so we load the plugins results in the same order as they show on the list
    let filteredSortedInstalledPlugins = [...filteredInstalledPlugins].sort(
      (a, b) => a.name.localeCompare(b.name),
    );

    (async () => {
      let running = 0;
      for (let _plugin of filteredSortedInstalledPlugins) {
        if (!isMounted.current) {
          break;
        }
        while (running >= 2) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        running++;
        (async () => {
          try {
            const plugin = getPlugin(_plugin.id);
            if (!plugin) {
              throw new Error(`Unknown plugin: ${_plugin.id}`);
            }
            const res = await plugin.searchNovels(searchText, 1);

            setSearchResults(prevState =>
              prevState.map(prevResult =>
                prevResult.plugin.id === plugin.id
                  ? { ...prevResult, novels: res, isLoading: false }
                  : { ...prevResult },
              ),
            );

            setSearchResults(prevState =>
              prevState.sort(
                (
                  { novels: a, plugin: { name: aName } },
                  { novels: b, plugin: { name: bName } },
                ) => {
                  if (!a.length) {
                    return 1;
                  }
                  if (!b.length) {
                    return -1;
                  }

                  return aName.localeCompare(bName);
                },
              ),
            );
          } catch (error: any) {
            const errorMessage = error?.message || String(error);
            setSearchResults(prevState =>
              prevState.map(prevResult =>
                prevResult.plugin.id === _plugin.id
                  ? {
                      ...prevResult,
                      novels: [],
                      isLoading: false,
                      error: errorMessage,
                    }
                  : { ...prevResult },
              ),
            );
          } finally {
            setProgress(
              prevState => prevState + 1 / filteredInstalledPlugins.length,
            );
            running--;
          }
        })();
      }
    })();
  };

  useEffect(() => {
    if (defaultSearchText) {
      globalSearch(defaultSearchText);
    }
  }, []);

  return { searchResults, globalSearch, progress };
};
