import { DriveFile } from '@api/drive/types';
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
import { createRestoreProgressReporter } from './progress';
export const driveRestore = async (
  backupFolder: DriveFile,
  setMeta: TaskProgressUpdater,
) => {
  const progressReporter = createRestoreProgressReporter(setMeta, 'remote');
  let restoreResult: RestoreResult | undefined;
  try {
    setMeta(meta => ({
      ...meta,
      isRunning: true,
    }));
    progressReporter?.(
      'source',
      0,
      getString('backupScreen.downloadingData'),
      true,
    );

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
    progressReporter?.(
      'source',
      1,
      getString('backupScreen.downloadingData'),
      true,
    );
    progressReporter?.(
      'extract',
      1,
      getString('backupScreen.downloadingData'),
      true,
    );

    restoreResult = await restoreData(CACHE_DIR_PATH, progressReporter);

    const selectedFilesText = getString('backupScreen.restoringSelectedFiles');
    const publishSelectedFilesProgress = (fraction: number, force = false) => {
      progressReporter?.('selectedFiles', fraction, selectedFilesText, force);
    };
    const reportSelectedFileMoves = (completed: number, total: number) => {
      publishSelectedFilesProgress(
        0.5 + 0.5 * (total > 0 ? completed / total : 1),
        completed >= total,
      );
    };
    progressReporter?.('selectedFiles', 0, selectedFilesText, true);

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
      publishSelectedFilesProgress(0.5, true);
      await restoreLegacyFiles(
        legacyFilesRestorePath,
        restoreResult.novelMappings,
        restoreResult.restoreRunId,
        reportSelectedFileMoves,
      );
    } else {
      const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
      const sections = getSelectedBackupFileSections(
        restoreResult.manifest.sections,
        2,
      );
      if (sections.length === 0) {
        publishSelectedFilesProgress(0.5, true);
      }
      for (const [index, section] of sections.entries()) {
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
        publishSelectedFilesProgress(
          0.5 * ((index + 1) / sections.length),
          index + 1 === sections.length,
        );
      }
      if (restoreResult.manifest.sections.downloadedFiles) {
        await restoreNovelFiles(
          novelFilesRestorePath,
          restoreResult.novelMappings,
          restoreResult.restoreRunId,
          reportSelectedFileMoves,
        );
      } else {
        publishSelectedFilesProgress(1, true);
      }
    }

    progressReporter?.(
      'finalize',
      0,
      getString('backupScreen.finalizingRestore'),
      true,
    );
    const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
    const completionText = getRestoreCompletionText(
      restoreResult,
      missingPluginIds,
    );
    progressReporter?.('finalize', 1, completionText, true);

    setMeta(meta => ({
      ...meta,
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
