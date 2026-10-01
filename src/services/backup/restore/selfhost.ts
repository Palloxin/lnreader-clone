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
import { createRestoreProgressReporter } from './progress';
export const selfHostRestore = async (
  { host, backupFolder }: SelfHostData,
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

    await clearBackupCache();
    await download(host, backupFolder, ZipBackupName.DATA, CACHE_DIR_PATH);
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
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      await download(
        host,
        backupFolder,
        ZipBackupName.DOWNLOAD,
        legacyFilesRestorePath,
      );
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
        await download(
          host,
          backupFolder,
          section.archiveName,
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
