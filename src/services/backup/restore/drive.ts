import { DriveFile } from '@api/drive/types';
import { sleep } from '@utils/sleep';
import { exists } from '@api/drive';
import { getString } from '@i18n/translations';
import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import { restoreData, clearRestoreChapterMappingsSafely } from './index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from './result';
import { download } from '@api/drive/request';
import { ZipBackupName } from '../types';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import {
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  restoreLegacyFiles,
  restoreNovelFiles,
} from './files';
import { getSelectedBackupFileSections } from '../fileSections';

export const driveRestore = async (
  backupFolder: DriveFile,
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

    const zipDataFile = await exists(
      ZipBackupName.DATA,
      false,
      backupFolder.id,
    );
    if (!zipDataFile) {
      throw new Error(getString('backupScreen.invalidBackupFolder'));
    }

    await clearBackupCache();
    await download(zipDataFile, CACHE_DIR_PATH);
    await sleep(500);

    setMeta(meta => ({
      ...meta,
      progress: 1 / 3,
      progressText: getString('backupScreen.restoringData'),
    }));

    restoreResult = await restoreData(CACHE_DIR_PATH, setMeta);
    await sleep(500);

    setMeta(meta => ({
      ...meta,
      progress: 2 / 3,
      progressText: getString('backupScreen.restoringSelectedFiles'),
    }));

    if (restoreResult.manifest.formatVersion === 1) {
      const legacyFile = await exists(
        ZipBackupName.DOWNLOAD,
        false,
        backupFolder.id,
      );
      if (!legacyFile) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      await download(legacyFile, legacyFilesRestorePath);
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
        const file = await exists(section.archiveName, false, backupFolder.id);
        if (!file) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        await download(
          file,
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
