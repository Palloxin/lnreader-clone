import {
  _restoreNovelAndChapters,
  _restoreNovelsAndChapters,
  recordRestoreFallback,
  type RestoreNovelMetrics,
} from '@database/queries/NovelRestoreQueries';
import type { BackupNovel, RestoredNovelMapping } from '@database/types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import { NOVEL_STORAGE, ROOT_STORAGE } from '@utils/Storages';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { BackupEntryName, type ResolvedBackupManifest } from '../types';
import {
  NovelFileValidationError,
  decodeAndValidateNovelFile,
} from './validation';

const RESTORE_NOVEL_BATCH_SIZE = 100;
const BACKUP_FILE_CONCURRENCY = 8;
const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

type BackupNovelFileDescriptor = {
  name: string;
  path: string;
};

type RestoreBenchmarkLogger = (message: string) => void;

type RestoreNovelTelemetry = {
  database: RestoreNovelMetrics;
  collectDatabaseMetrics: boolean;
  uniqueInputChapterCount: number;
};

export type NovelRestoreSummary = {
  novelCount: number;
  failedNovelCount: number;
  failedSectionCount: number;
  pluginIds: string[];
  novelMappings: RestoredNovelMapping[];
  novelIdMap: Map<number, number>;
};

const updateRestoreProgress = (
  setMeta: TaskProgressUpdater | undefined,
  progressText: string,
) => {
  setMeta?.(meta => ({
    ...meta,
    progressText,
  }));
};

const restoreNovelsWithTelemetry = async (
  cacheDirPath: string,
  manifest: ResolvedBackupManifest,
  restoreRunId: string,
  setMeta: TaskProgressUpdater | undefined,
  benchmarkLog: RestoreBenchmarkLogger | undefined,
  telemetry: RestoreNovelTelemetry,
): Promise<NovelRestoreSummary> => {
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  const summary: NovelRestoreSummary = {
    novelCount: 0,
    failedNovelCount: 0,
    failedSectionCount: 0,
    pluginIds: [],
    novelMappings: [],
    novelIdMap: new Map<number, number>(),
  };

  benchmarkLog?.('restoreData:novels:validation:start');
  if (!(await NativeFile.exists(novelDirPath))) {
    summary.failedSectionCount++;
    return summary;
  }

  let items: BackupNovelFileDescriptor[];
  try {
    items = (await NativeFile.readDir(novelDirPath))
      .filter(item => !item.isDirectory)
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )
      .map(item => ({ name: item.name, path: item.path }));
  } catch {
    summary.failedSectionCount++;
    return summary;
  }

  const seenNovelIds = new Set<number>();
  const seenNovelIdentities = new Set<string>();
  const seenChapterIdentities = new Set<string>();
  const pluginIds = new Set<string>();
  const pendingNovels: BackupNovel[] = [];
  let filesProcessed = 0;
  let readMs = 0;
  let parseMs = 0;
  let databaseMs = 0;
  let coverProcessingMs = 0;
  let coverCandidates = 0;
  let coverFilesFound = 0;
  let coverFilesMissing = 0;
  let coverFilesCopied = 0;
  let coverProcessingFailures = 0;
  const processFile = async (item: BackupNovelFileDescriptor) => {
    const readStartedAt = performance.now();
    let fileContent: string | undefined;
    try {
      fileContent = await NativeFile.readFile(item.path);
    } catch {
      summary.failedNovelCount++;
    } finally {
      readMs += performance.now() - readStartedAt;
    }

    if (fileContent !== undefined) {
      const parseStartedAt = performance.now();
      try {
        const novels = decodeAndValidateNovelFile(
          fileContent,
          manifest,
          seenNovelIds,
          seenNovelIdentities,
          seenChapterIdentities,
        );
        for (const novel of novels) {
          pluginIds.add(novel.pluginId);
          pendingNovels.push(novel);
        }
        if (telemetry.collectDatabaseMetrics) {
          telemetry.uniqueInputChapterCount = seenChapterIdentities.size;
        }
      } catch (error) {
        summary.failedNovelCount +=
          error instanceof NovelFileValidationError ? error.recordCount : 1;
      } finally {
        parseMs += performance.now() - parseStartedAt;
      }
    }

    filesProcessed++;
    updateRestoreProgress(
      setMeta,
      getString('backupScreen.restoringNovelFilesProgress', {
        current: filesProcessed,
        total: items.length,
      }),
    );
  };

  const restoreNovelBatch = async () => {
    if (pendingNovels.length === 0) {
      return;
    }
    const batch = pendingNovels.splice(0, pendingNovels.length);
    const restoreOptions = {
      includeChapterMappings: manifest.sections.downloadedFiles,
      ...(manifest.sections.downloadedFiles ? { restoreRunId } : {}),
    };
    let restoredNovels: {
      backupNovel: BackupNovel;
      mapping: RestoredNovelMapping;
    }[] = [];
    const databaseStartedAt = performance.now();
    try {
      const mappings = telemetry.collectDatabaseMetrics
        ? await _restoreNovelsAndChapters(
            batch,
            restoreOptions,
            telemetry.database,
          )
        : await _restoreNovelsAndChapters(batch, restoreOptions);
      if (mappings.length !== batch.length) {
        throw new Error('Restore returned incomplete novel mappings');
      }
      restoredNovels = batch.map((backupNovel, index) => ({
        backupNovel,
        mapping: mappings[index],
      }));
    } catch (error) {
      if (telemetry.collectDatabaseMetrics) {
        telemetry.database.novelBatchFallbacks++;
        recordRestoreFallback(telemetry.database, error);
      }
      for (const backupNovel of batch) {
        if (telemetry.collectDatabaseMetrics) {
          telemetry.database.novelFallbackRowsAttempted++;
        }
        try {
          restoredNovels.push({
            backupNovel,
            mapping: telemetry.collectDatabaseMetrics
              ? await _restoreNovelAndChapters(
                  backupNovel,
                  restoreOptions,
                  telemetry.database,
                )
              : await _restoreNovelAndChapters(backupNovel, restoreOptions),
          });
        } catch (novelError) {
          if (telemetry.collectDatabaseMetrics) {
            recordRestoreFallback(telemetry.database, novelError);
          }
          summary.failedNovelCount++;
        }
      }
    } finally {
      databaseMs += performance.now() - databaseStartedAt;
    }

    const coverStartedAt = performance.now();
    for (
      let start = 0;
      start < restoredNovels.length;
      start += BACKUP_FILE_CONCURRENCY
    ) {
      const coverBatch = restoredNovels.slice(
        start,
        start + BACKUP_FILE_CONCURRENCY,
      );
      await Promise.all(
        coverBatch.map(async ({ backupNovel, mapping: novelMapping }) => {
          try {
            if (
              !manifest.sections.downloadedFiles &&
              backupNovel.cover?.startsWith(APP_STORAGE_URI)
            ) {
              coverCandidates++;
              const coverBackupPath = coversDirPath + '/' + backupNovel.id;
              if (await NativeFile.exists(coverBackupPath)) {
                coverFilesFound++;
                const coverPath = `${NOVEL_STORAGE}/${backupNovel.pluginId}/${novelMapping.restoredNovelId}/cover.png`;
                await NativeFile.mkdir(
                  coverPath.slice(0, Math.max(0, coverPath.lastIndexOf('/'))),
                );
                await NativeFile.copyFile(coverBackupPath, coverPath);
                coverFilesCopied++;
              } else {
                coverFilesMissing++;
              }
            }
          } catch {
            coverProcessingFailures++;
            summary.failedNovelCount++;
          }
        }),
      );
    }
    coverProcessingMs += performance.now() - coverStartedAt;

    for (const { backupNovel, mapping: novelMapping } of restoredNovels) {
      summary.novelMappings.push(novelMapping);
      summary.novelIdMap.set(backupNovel.id, novelMapping.restoredNovelId);
      summary.novelCount++;
    }
  };

  let nextFileIndex = 0;
  while (nextFileIndex < items.length || pendingNovels.length > 0) {
    if (pendingNovels.length >= RESTORE_NOVEL_BATCH_SIZE) {
      const writePromise = restoreNovelBatch();
      if (nextFileIndex < items.length) {
        const filePromise = processFile(items[nextFileIndex++]);
        const [writeResult, fileResult] = await Promise.allSettled([
          writePromise,
          filePromise,
        ]);
        if (fileResult.status === 'rejected') {
          throw fileResult.reason;
        }
        if (writeResult.status === 'rejected') {
          throw writeResult.reason;
        }
      } else {
        await writePromise;
      }
      continue;
    }

    if (nextFileIndex < items.length) {
      await processFile(items[nextFileIndex++]);
      continue;
    }

    await restoreNovelBatch();
  }

  benchmarkLog?.(`restoreData:novels:pipeline:done total=${filesProcessed}`);
  benchmarkLog?.(
    `restoreData:novels:done count=${summary.novelCount} failed=${
      summary.failedNovelCount
    } readMs=${readMs.toFixed(1)} parseMs=${parseMs.toFixed(
      1,
    )} databaseMs=${databaseMs.toFixed(
      1,
    )} coverProcessingMs=${coverProcessingMs.toFixed(
      1,
    )} coverCandidates=${coverCandidates} coverFilesFound=${coverFilesFound} coverFilesMissing=${coverFilesMissing} coverFilesCopied=${coverFilesCopied} coverProcessingFailures=${coverProcessingFailures}`,
  );

  summary.pluginIds = [...pluginIds];
  return summary;
};

export const restoreNovels = async (
  cacheDirPath: string,
  manifest: ResolvedBackupManifest,
  restoreRunId: string,
  setMeta?: TaskProgressUpdater,
  benchmarkLog?: RestoreBenchmarkLogger,
): Promise<NovelRestoreSummary> => {
  const telemetry: RestoreNovelTelemetry = {
    collectDatabaseMetrics: __DEV__ && benchmarkLog !== undefined,
    database: {
      novelUpsertCalls: 0,
      novelUpsertRowsAttempted: 0,
      novelUpsertMs: 0,
      novelIdentityLookupCalls: 0,
      novelIdentityLookupRowsReturned: 0,
      novelIdentityLookupMs: 0,
      chapterWriteChunkCalls: 0,
      chapterWriteRowsAttempted: 0,
      chapterWriteMs: 0,
      chapterMappingRowsAttempted: 0,
      statsRefreshCalls: 0,
      statsRefreshNovels: 0,
      statsRefreshMs: 0,
      novelBatchFallbacks: 0,
      novelFallbackRowsAttempted: 0,
      chapterBatchFallbacks: 0,
      chapterFallbackRowsAttempted: 0,
      fallbackCauses: [],
    },
    uniqueInputChapterCount: 0,
  };
  try {
    return await restoreNovelsWithTelemetry(
      cacheDirPath,
      manifest,
      restoreRunId,
      setMeta,
      benchmarkLog,
      telemetry,
    );
  } finally {
    if (telemetry.collectDatabaseMetrics) {
      benchmarkLog?.(
        `restoreData:database:summary ${JSON.stringify({
          uniqueInputChapterCount: telemetry.uniqueInputChapterCount,
          ...telemetry.database,
        })}`,
      );
    }
  }
};
