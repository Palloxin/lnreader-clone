import { act, renderHook } from '@testing-library/react-native';

import { getLibraryNovelsQuery } from '@database/queries/LibraryQueries';
import { NovelInfo } from '@database/types';
import { useLiveQuery } from '@database/manager/liveQuery';
import { useLibrary } from '../useLibrary';

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: () => ({
    filter: undefined,
    sortOrder: 'name ASC',
    downloadedOnlyMode: false,
  }),
}));

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn().mockResolvedValue([]),
  getLibraryNovelsQuery: jest.fn(() => ({ query: 'library' })),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesFromDb: jest.fn().mockResolvedValue([]),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  switchNovelToLibraryQuery: jest.fn(),
}));

jest.mock('@database/manager/liveQuery', () => ({
  useLiveQuery: jest.fn(),
}));

jest.mock('@services/backgroundTasks', () => ({
  BACKGROUND_TASKS_STORE_KEY: 'backgroundTasks',
  getDownloadProgressKey: jest.fn(() => ''),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
  }),
  useMMKVObject: () => [undefined],
}));

const mockGetLibraryNovelsQuery = getLibraryNovelsQuery as jest.MockedFunction<
  typeof getLibraryNovelsQuery
>;
const mockUseLiveQuery = useLiveQuery as jest.MockedFunction<
  typeof useLiveQuery
>;

describe('useLibrary', () => {
  it('updates the library when the reactive Novel query changes', () => {
    let onLibraryChange: ((novels: NovelInfo[]) => void) | undefined;
    mockUseLiveQuery.mockImplementation((_query, fireOn, callback) => {
      expect(fireOn).toEqual([{ table: 'Novel' }]);
      onLibraryChange = callback as (novels: NovelInfo[]) => void;
      return [];
    });

    const { result } = renderHook(useLibrary);
    const updatedNovel = {
      id: 1,
      name: 'Updated novel',
      path: '/updated-novel',
      pluginId: 'test-plugin',
      chaptersDownloaded: 0,
    } as NovelInfo;

    act(() => onLibraryChange?.([updatedNovel]));

    expect(mockGetLibraryNovelsQuery).toHaveBeenCalledWith(
      'name ASC',
      undefined,
      '',
      false,
    );
    expect(result.current.library).toEqual([updatedNovel]);
  });
});
