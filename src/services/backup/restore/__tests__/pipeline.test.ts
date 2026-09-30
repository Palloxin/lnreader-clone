import {
  _restoreNovelsAndChapters,
  clearRestoreChapterMappings,
} from '@database/queries/NovelRestoreQueries';
import { _restoreCategory } from '@database/queries/CategoryQueries';
import type {
  BackupNovel,
  ChapterInfo,
  RestoredNovelMapping,
} from '@database/types';
import NativeFile from '@modules/native-file';
import { restoreData } from '../index';
import { restoreNovels } from '../novels';
import { encodeNovelBatch } from '../../novelPayload';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  _restoreNovelsAndChapters: jest.fn(),
  clearRestoreChapterMappings: jest.fn(async () => undefined),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  _restoreCategory: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string | number>) =>
    options?.current !== undefined
      ? `${key}:${options.current}/${options.total}`
      : key,
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getAllKeys: jest.fn(() => []),
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  ROOT_STORAGE: '/storage',
}));

const options = {
  library: true,
  settings: false,
  plugins: false,
  downloadedFiles: true,
};

const makeTestChapter = (novelId: number): ChapterInfo => ({
  id: novelId * 100 + 1,
  novelId,
  path: `/novel/${novelId}/chapter/1`,
  name: `Chapter ${novelId}`,
  releaseTime: null,
  readTime: null,
  bookmark: null,
  unread: null,
  isDownloaded: true,
  updatedTime: null,
  chapterNumber: 1,
  page: null,
  position: null,
  progress: null,
  scanlator: null,
  timeSpent: 0,
});

const makeTestNovel = (id: number, path = `/novel/${id}`): BackupNovel => ({
  id,
  name: `Novel ${id}`,
  path,
  pluginId: 'source',
  cover: null,
  summary: null,
  author: null,
  artist: null,
  status: null,
  genres: null,
  inLibrary: true,
  isLocal: false,
  totalPages: null,
  chapters: [makeTestChapter(id)],
});

const makeMappings = (novels: BackupNovel[]): RestoredNovelMapping[] =>
  novels.map(novel => ({
    pluginId: novel.pluginId,
    backupNovelId: novel.id,
    restoredNovelId: novel.id + 10_000,
  }));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const manifestContent = JSON.stringify({
  appVersion: '2.1.3',
  formatVersion: 2,
  novelDataFormat: 2,
  sections: options,
});

const configureFiles = (files: Record<string, string>) => {
  jest
    .mocked(NativeFile.exists)
    .mockImplementation(
      async path =>
        path === '/cache/NovelAndChapters' || path === '/cache/Category.json',
    );
  jest.mocked(NativeFile.readDir).mockResolvedValue(
    Object.keys(files)
      .reverse()
      .map(name => ({
        name,
        path: `/cache/NovelAndChapters/${name}`,
        isDirectory: false,
      })),
  );
  jest.mocked(NativeFile.readFile).mockImplementation(async path => {
    if (path === '/cache/Version.json') {
      return manifestContent;
    }
    if (path === '/cache/Category.json') {
      return JSON.stringify([
        { id: 8, name: 'Reading list', novelIds: [1, 100, 200, 201] },
      ]);
    }
    return files[path.split('/').pop() ?? ''];
  });
};

const getNovelReadPaths = () =>
  jest
    .mocked(NativeFile.readFile)
    .mock.calls.map(([path]) => path)
    .filter(path => path.includes('/NovelAndChapters/'));

describe('bounded novel restore pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('logs zeroed database metrics when the novel directory is absent', async () => {
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    const events: string[] = [];
    const result = await restoreNovels(
      '/cache',
      {
        appVersion: '2.1.3',
        formatVersion: 2,
        novelDataFormat: 2,
        sections: options,
      },
      'restore-run',
      undefined,
      event => {
        events.push(event);
      },
    );

    expect(result.failedSectionCount).toBe(1);
    const summaryPrefix = 'restoreData:database:summary ';
    const summaryEvent = events.find(event => event.startsWith(summaryPrefix));
    expect(summaryEvent).toBeDefined();
    expect(JSON.parse(summaryEvent!.slice(summaryPrefix.length))).toMatchObject(
      {
        uniqueInputChapterCount: 0,
        novelUpsertCalls: 0,
        novelIdentityLookupCalls: 0,
        chapterWriteChunkCalls: 0,
        chapterMappingRowsAttempted: 0,
        statsRefreshCalls: 0,
        novelBatchFallbacks: 0,
        chapterBatchFallbacks: 0,
        fallbackCauses: [],
      },
    );
  });

  it('validates one later file during a 100-novel write', async () => {
    const firstFileNovels = Array.from({ length: 100 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const secondFileNovel = makeTestNovel(200);
    const duplicateNovel = makeTestNovel(201, secondFileNovel.path);
    const files = {
      'batch-000001.json': JSON.stringify(encodeNovelBatch(firstFileNovels)),
      'batch-000002.json': JSON.stringify(encodeNovelBatch([secondFileNovel])),
      'batch-000003.json': JSON.stringify(encodeNovelBatch([duplicateNovel])),
    };
    configureFiles(files);

    const firstWrite = createDeferred<RestoredNovelMapping[]>();
    const secondFileRead = createDeferred<void>();
    const readFile = jest.mocked(NativeFile.readFile);
    const readFileImplementation = readFile.getMockImplementation()!;
    readFile.mockImplementation(async path => {
      if (path.endsWith('batch-000002.json')) {
        secondFileRead.resolve(undefined);
      }
      return readFileImplementation(path);
    });
    let writeCount = 0;
    jest.mocked(_restoreNovelsAndChapters).mockImplementation(async novels => {
      writeCount++;
      if (writeCount === 1) {
        return firstWrite.promise;
      }
      return makeMappings(novels);
    });
    const progressTexts: string[] = [];
    const setMeta: TaskProgressUpdater = transform => {
      const next = transform({
        name: 'LOCAL_RESTORE',
        isRunning: true,
        progress: undefined,
        progressText: undefined,
      });
      if (next.progressText) {
        progressTexts.push(next.progressText);
      }
    };

    const restorePromise = restoreData('/cache', setMeta);
    await secondFileRead.promise;

    expect(getNovelReadPaths()).toEqual([
      '/cache/NovelAndChapters/batch-000001.json',
      '/cache/NovelAndChapters/batch-000002.json',
    ]);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelsAndChapters).toHaveBeenNthCalledWith(
      1,
      firstFileNovels,
      { includeChapterMappings: true, restoreRunId: expect.any(String) },
    );
    expect(progressTexts).toEqual([
      'backupScreen.restoringNovelFilesProgress:0/3',
    ]);

    firstWrite.resolve(makeMappings(firstFileNovels));
    const result = await restorePromise;
    expect(progressTexts).toContain(
      'backupScreen.restoringNovelFilesProgress:1/3',
    );
    expect(progressTexts).toContain(
      'backupScreen.restoringNovelFilesProgress:3/3',
    );

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(2);
    expect(_restoreNovelsAndChapters).toHaveBeenNthCalledWith(
      2,
      [secondFileNovel],
      { includeChapterMappings: true, restoreRunId: result.restoreRunId },
    );
    expect(getNovelReadPaths()).toEqual([
      '/cache/NovelAndChapters/batch-000001.json',
      '/cache/NovelAndChapters/batch-000002.json',
      '/cache/NovelAndChapters/batch-000003.json',
    ]);
    expect(result).toMatchObject({
      novelCount: 101,
      categoryCount: 1,
      failedNovelCount: 1,
      failedCategoryCount: 0,
      pluginIds: ['source'],
      novelMappings: [
        ...makeMappings(firstFileNovels),
        ...makeMappings([secondFileNovel]),
      ],
    });
    const [restoredCategory, restoredNovelIdMap] = (
      _restoreCategory as jest.Mock
    ).mock.calls[0];
    expect(restoredCategory).toEqual({
      id: 8,
      name: 'Reading list',
      novelIds: [1, 100, 200],
    });
    expect(restoredNovelIdMap.get(1)).toBe(10_001);
    expect(restoredNovelIdMap.get(100)).toBe(10_100);
    expect(restoredNovelIdMap.get(200)).toBe(10_200);
  });
  it('reports completion for empty and invalid files without novel writes', async () => {
    configureFiles({
      'empty.json': JSON.stringify(encodeNovelBatch([])),
      'invalid.json': '{',
    });
    const progressTexts: string[] = [];
    const result = await restoreNovels(
      '/cache',
      {
        appVersion: '2.1.3',
        formatVersion: 2,
        novelDataFormat: 2,
        sections: options,
      },
      'restore-run',
      transform => {
        const next = transform({
          name: 'LOCAL_RESTORE',
          isRunning: true,
          progress: undefined,
          progressText: undefined,
        });
        if (next.progressText) {
          progressTexts.push(next.progressText);
        }
      },
    );

    expect(_restoreNovelsAndChapters).not.toHaveBeenCalled();
    expect(progressTexts).toEqual([
      'backupScreen.restoringNovelFilesProgress:0/2',
      'backupScreen.restoringNovelFilesProgress:2/2',
    ]);
    expect(result).toMatchObject({ novelCount: 0, failedNovelCount: 1 });
  });

  it('settles the active write before interrupted restore cleanup', async () => {
    const firstFileNovels = Array.from({ length: 100 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const nextFileNovel = makeTestNovel(200);
    configureFiles({
      'batch-000001.json': JSON.stringify(encodeNovelBatch(firstFileNovels)),
      'batch-000002.json': JSON.stringify(encodeNovelBatch([nextFileNovel])),
    });

    const firstWrite = createDeferred<RestoredNovelMapping[]>();
    let firstWriteSettled = false;
    const writePromise = firstWrite.promise.then(mappings => {
      firstWriteSettled = true;
      return mappings;
    });
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockImplementation(async () => writePromise);
    const secondFileRead = createDeferred<void>();
    const readFile = jest.mocked(NativeFile.readFile);
    const readFileImplementation = readFile.getMockImplementation()!;
    readFile.mockImplementation(async path => {
      if (path.endsWith('batch-000002.json')) {
        secondFileRead.resolve(undefined);
      }
      return readFileImplementation(path);
    });
    const interruption = new Error('restore interrupted');
    const setMeta: TaskProgressUpdater = transform => {
      const next = transform({
        name: 'LOCAL_RESTORE',
        isRunning: true,
        progress: undefined,
        progressText: undefined,
      });
      if (
        next.progressText === 'backupScreen.restoringNovelFilesProgress:1/2'
      ) {
        throw interruption;
      }
    };

    const restorePromise = restoreData('/cache', setMeta);
    await secondFileRead.promise;
    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(clearRestoreChapterMappings).not.toHaveBeenCalled();

    firstWrite.resolve(makeMappings(firstFileNovels));
    await expect(restorePromise).rejects.toBe(interruption);

    expect(firstWriteSettled).toBe(true);
    expect(clearRestoreChapterMappings).toHaveBeenCalledTimes(1);
  });
});
