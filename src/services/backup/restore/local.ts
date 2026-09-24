import { CACHE_DIR_PATH, clearBackupCache } from '../cache';
import { restoreData, clearRestoreChapterMappingsSafely } from './index';
import {
  finalizeRestoredPlugins,
  getRestoreCompletionText,
  type RestoreResult,
} from './result';
import NativeZipArchive from '@modules/native-zip-archive';
import { BackupEntryName, ZipBackupName } from '../types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import {
  getLegacyFilesRestorePath,
  getNovelFilesRestorePath,
  restoreLegacyFiles,
  restoreNovelFiles,
} from './files';
import { getSelectedBackupFileSections } from '../fileSections';

const printTime = (time?: number) => {
  if (!time) return '';
  if (time >= 1000) {
    return (time / 1000).toFixed(2) + 's';
  }
  return time.toFixed(2) + 'ms';
};

let startTime: number;
let lastTime: number | undefined;
const logRestoreBenchmark = (message: string) => {
  if (!__DEV__) {
    return;
  }
  const currentTime = performance.now();
  if (message === 'local:start') {
    lastTime = undefined;
    startTime = currentTime;
  }
  const diff = lastTime ? printTime(currentTime - lastTime) : undefined;
  lastTime = currentTime;
  // Benchmark output is consumed from the Metro client log.
  // eslint-disable-next-line no-console
  console.log(
    `[restore-benchmark] ${currentTime.toFixed(2)},${
      !diff ? '' : ' duration: ' + diff.padEnd(15, ' ')
    } ${message}`,
  );
  if (message === 'local:finalize:done') {
    // eslint-disable-next-line no-console
    console.log('Total time:', printTime(currentTime - startTime));
    lastTime = undefined;
  }
};

export const restoreBackup = async (
  { sourceUri }: { sourceUri: string },
  setMeta?: TaskProgressUpdater,
) => {
  logRestoreBenchmark('local:start');
  let restoreResult: RestoreResult | undefined;
  try {
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.downloadingData'),
    }));

    await clearBackupCache();
    const localPath = CACHE_DIR_PATH + '-source.zip';
    await NativeFile.copyFile(sourceUri, localPath);
    logRestoreBenchmark('local:copy:done');

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    const outerArchiveStats = await NativeZipArchive.unzip(
      localPath,
      CACHE_DIR_PATH,
    );
    logRestoreBenchmark(
      `local:outer-unzip:done ${JSON.stringify(outerArchiveStats)}`,
    );

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.restoringData'),
    }));

    await sleep(200);

    restoreResult = await restoreData(
      CACHE_DIR_PATH,
      setMeta,
      logRestoreBenchmark,
    );
    logRestoreBenchmark('local:restore-data:done');
    if (restoreResult.manifest.formatVersion === 1) {
      const legacyArchive = CACHE_DIR_PATH + '/' + ZipBackupName.DOWNLOAD;
      if (!(await NativeFile.exists(legacyArchive))) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      const legacyFilesRestorePath = getLegacyFilesRestorePath(CACHE_DIR_PATH);
      const legacyArchiveStats = await NativeZipArchive.unzip(
        legacyArchive,
        legacyFilesRestorePath,
      );
      logRestoreBenchmark(
        `local:legacy-archive-unzip:done ${JSON.stringify(legacyArchiveStats)}`,
      );
      await restoreLegacyFiles(
        legacyFilesRestorePath,
        restoreResult.novelMappings,
        restoreResult.restoreRunId,
      );
      logRestoreBenchmark('local:downloaded-files:done');
    } else {
      const novelFilesRestorePath = getNovelFilesRestorePath(CACHE_DIR_PATH);
      const sections = getSelectedBackupFileSections(
        restoreResult.manifest.sections,
        restoreResult.manifest.formatVersion,
      );
      if (
        restoreResult.manifest.formatVersion === 3 &&
        restoreResult.manifest.sections.downloadedFiles &&
        !(await NativeFile.exists(
          `${CACHE_DIR_PATH}/${BackupEntryName.NOVEL_FILES}`,
        ))
      ) {
        throw new Error(getString('backupScreen.invalidBackupFolder'));
      }
      for (const section of sections) {
        const archivePath = `${CACHE_DIR_PATH}/${section.archiveName}`;
        if (!(await NativeFile.exists(archivePath))) {
          throw new Error(getString('backupScreen.invalidBackupFolder'));
        }
        const archiveStats = await NativeZipArchive.unzip(
          archivePath,
          section.archiveName === ZipBackupName.NOVEL_FILES
            ? novelFilesRestorePath
            : section.storagePath,
        );
        logRestoreBenchmark(
          `local:selected-archive-unzip:done ${JSON.stringify(archiveStats)}`,
        );
      }
      logRestoreBenchmark('local:selected-archives:done');
      if (restoreResult.manifest.sections.downloadedFiles) {
        await restoreNovelFiles(
          restoreResult.manifest.formatVersion === 3
            ? `${CACHE_DIR_PATH}/${BackupEntryName.NOVEL_FILES}`
            : novelFilesRestorePath,
          restoreResult.novelMappings,
          restoreResult.restoreRunId,
        );
      }
    }
    logRestoreBenchmark('local:downloaded-files:done');
    logRestoreBenchmark('local:selected-files:done');
    const missingPluginIds = await finalizeRestoredPlugins(restoreResult);
    const completionText = getRestoreCompletionText(
      restoreResult,
      missingPluginIds,
    );
    logRestoreBenchmark('local:finalize:done');

    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } catch (error) {
    lastTime = undefined;
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  } finally {
    if (restoreResult) {
      await clearRestoreChapterMappingsSafely(restoreResult.restoreRunId);
    }
  }
};
