import { sleep } from '@utils/sleep';
import { download } from '@api/remote';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import { restoreData, clearRestoreChapterMappingsSafely } from './index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from './result';
import { ZipBackupName } from '../types';
import type {
  SelfHostData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import {
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  restoreLegacyFiles,
  restoreNovelFiles,
} from './files';
import { getSelectedBackupFileSections } from '../fileSections';

export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
  setMeta: TaskProgressUpdater,
) => {
  let restoreResult: RestoreResult | undefined;
  try {
    setMeta(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 3,
      progressText: getString('backupScreen.downloadingData'),
    }));

    await clearBackupCache();
    await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);

    setMeta(meta => ({
      ...meta,
      progress: 1 / 3,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    restoreResult = await restoreData(CACHE_DIR_PATH, setMeta);

    setMeta(meta => ({
      ...meta,
      progress: 2 / 3,
      progressText: getString('backupScreen.restoringSelectedFiles'),
    }));

    await sleep(200);

    if (restoreResult.manifest.formatVersion === 1) {
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      await download(
        host,
        backupFolder,
        ZipBackupName.DOWNLOAD,
        legacyFilesRestorePath,
      );
      await restoreLegacyFiles(
        legacyFilesRestorePath,
        restoreResult.novelMappings,
        restoreResult.restoreRunId,
      );
    } else {
      const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
      for (const section of getSelectedBackupFileSections(
        restoreResult.manifest.sections,
        2,
      )) {
        await download(
          host,
          backupFolder,
          section.archiveName,
          section.archiveName === ZipBackupName.NOVEL_FILES
            ? novelFilesRestorePath
            : section.storagePath,
        );
      }
      if (restoreResult.manifest.sections.downloadedFiles) {
        await restoreNovelFiles(
          novelFilesRestorePath,
          restoreResult.novelMappings,
          restoreResult.restoreRunId,
        );
      }
    }
    const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
    const completionText = getRestoreCompletionText(
      restoreResult,
      missingPluginIds,
    );

    setMeta(meta => ({
      ...meta,
      progress: 3 / 3,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } finally {
    if (restoreResult) {
      await clearRestoreChapterMappingsSafely(restoreResult.restoreRunId);
    }
  }
};
