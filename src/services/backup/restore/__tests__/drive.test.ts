import { exists } from '@api/drive';
import type { DriveFile } from '@api/drive/types';
import { download } from '@api/drive/request';
import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { CACHE_DIR_PATH, clearBackupCache } from '../../cache';
import { ZipBackupName } from '../../types';

import { driveRestore } from '../drive';
import { restoreData } from '../index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from '../result';
import type { RestoreProgressReporter } from '../progress';

jest.mock('@api/drive', () => ({ exists: jest.fn() }));
jest.mock('@api/drive/request', () => ({ download: jest.fn() }));
jest.mock('../../cache', () => ({
  CACHE_DIR_PATH: '/cache/BackupData',
  clearBackupCache: jest.fn(),
}));
jest.mock('../files', () => ({
  getLegacyFilesRestorePath: jest.fn(() => '/cache/legacy-files'),
  getNovelFilesRestorePath: jest.fn(() => '/cache/novel-files'),
  restoreLegacyFiles: jest.fn(),
  restoreNovelFiles: jest.fn(),
}));
jest.mock('../index', () => ({
  clearRestoreChapterMappingsSafely: jest.fn(),
  restoreData: jest.fn(),
}));
jest.mock('../result', () => ({
  finalizeRestoredPlugins: jest.fn(),
  getRestoreCompletionText: jest.fn(() => 'completed'),
}));
jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));
jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));

const dataFile = { id: 'data-file', name: 'data.zip' } as DriveFile;
const backupFolder = { id: 'backup-folder', name: 'backup' } as DriveFile;

const createRestoreResult = (plugins: boolean): RestoreResult => ({
  novelCount: 0,
  failedNovelCount: 0,
  categoryCount: 0,
  failedCategoryCount: 0,
  settingsRestored: true,
  failedSectionCount: 0,
  pluginIds: [],
  novelMappings: [],
  restoreRunId: 'drive-restore-run',
  manifest: {
    appVersion: '2.1.3',
    formatVersion: 3,
    novelDataFormat: 2,
    sections: {
      library: false,
      settings: false,
      plugins,
      downloadedFiles: false,
    },
  },
});

const reportRestoreStages = (reporter: RestoreProgressReporter | undefined) => {
  reporter?.('manifest', 1, 'manifest', true);
  reporter?.('novels', 1, 'novels', true);
  reporter?.('categories', 1, 'categories', true);
  reporter?.('settings', 1, 'settings', true);
  reporter?.('plugins', 1, 'plugins', true);
};

const createProgressCapture = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'DRIVE_RESTORE',
    isRunning: false,
    progress: undefined,
    progressText: undefined,
  };
  const progressValues: number[] = [];
  const setMeta: TaskProgressUpdater = transform => {
    metadata = transform(metadata);
    if (metadata.progress !== undefined) {
      progressValues.push(metadata.progress);
    }
  };
  return { progressValues, setMeta, getMetadata: () => metadata };
};

describe('Drive restore progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(exists).mockResolvedValue(dataFile);
    jest.mocked(download).mockResolvedValue('');
    jest.mocked(clearBackupCache).mockResolvedValue(undefined);
    jest.mocked(finalizeRestoredPlugins).mockResolvedValue([]);
  });

  it('keeps remote retrieval and later phases monotonic through completion', async () => {
    const result = createRestoreResult(false);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    const capture = createProgressCapture();

    await driveRestore(backupFolder, capture.setMeta);

    expect(capture.progressValues[0]).toBe(0);
    expect(
      capture.progressValues.some(value => Math.abs(value - 0.3) < 0.000001),
    ).toBe(true);
    expect(capture.progressValues[capture.progressValues.length - 1]).toBe(1);
    expect(
      capture.progressValues.every(
        (value, index) =>
          index === 0 || value >= capture.progressValues[index - 1],
      ),
    ).toBe(true);
    expect(capture.getMetadata().isRunning).toBe(false);
    expect(capture.getMetadata().completionText).toBe('completed');
    expect(download).toHaveBeenCalledWith(dataFile, CACHE_DIR_PATH);
  });

  it('does not report completion when a selected archive is missing', async () => {
    const result = createRestoreResult(true);
    jest.mocked(restoreData).mockImplementationOnce(async (_path, reporter) => {
      reportRestoreStages(reporter);
      return result;
    });
    jest
      .mocked(exists)
      .mockImplementation(async name =>
        name === ZipBackupName.DATA ? dataFile : undefined,
      );
    const capture = createProgressCapture();

    await expect(driveRestore(backupFolder, capture.setMeta)).rejects.toThrow(
      'backupScreen.invalidBackupFolder',
    );

    expect(capture.progressValues.length).toBeGreaterThan(0);
    expect(Math.max(...capture.progressValues)).toBeLessThan(1);
    expect(finalizeRestoredPlugins).not.toHaveBeenCalled();
    expect(getRestoreCompletionText).not.toHaveBeenCalled();
  });
});
