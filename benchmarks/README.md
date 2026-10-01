# Backup and restore benchmarks

`backup-restore-full.txt` is the running record for full-library restore runs. `backup-restore-small.txt` holds reduced-archive runs. When the user supplies new benchmark output, add its results to the appropriate file in the same task. Treat the user’s log as the source of truth. Preserve the run label, backup format, code-path description, archive metadata, and any validation or image-optimization variant they identify. Do not invent missing details.

## Entry format

Append a dated section to the relevant file. Name the run by code path, backup format, and variant, for example `integrated restore-perf + Optimize Import v3, optimized images`.

In `backup-restore-full.txt`, keep one consolidated table before the per-run detail entries. Add one row for each run discussed, including new user-provided runs. Label backup format, image variant, and code path separately; use `—` for missing values. Retain older entries rather than replacing them.

For each per-run entry, include:

- Input: backup format, novel count, chapter count, and selected sections when known.
- Archive: entry count, compressed bytes, and uncompressed bytes when logged.
- Total restore time, plus novel-pipeline and `restoreData` times when the events are present.
- Copy, outer unzip, novel JSON read, parse, database, cover, category, settings, plugin, selected-file, and finalization timings when available.
- Restored and failed novel/category counts, plugin count, and cover candidate/found/copied/missing/failure counts when available.
- Database counters and validation/image variants when present.
- A short comparison only where the runs are meaningfully matched. State which archive metadata matches. Label comparisons across different backup contents or code paths as run-level observations, not causal results.
- When deriving a stage span from event timestamps rather than a logged `duration:` interval, label it as calculated and keep the raw event intervals alongside it.

Keep raw measurements in milliseconds or seconds as emitted, with readable equivalents where helpful. Use decimal seconds to two places in summaries. Keep byte counts as bytes; optional MB figures must say whether they are decimal MB or MiB. Do not round away differences that matter to a comparison.

## Log labels and shorthand

- `v2` / `v3`: backup manifest format versions, not app or code versions.
- `local:start` to `local:finalize:done`: end-to-end local restore duration reported by `Total time`.
- `local:copy:done`: source archive copy into app cache has completed.
- `local:outer-unzip:done`: the outer backup archive has been extracted. The JSON payload gives entry counts and compressed/uncompressed sizes when that instrumentation is available.
- `restoreData`: manifest, library, categories, settings, and plugin-registry restore work.
- `restoreData:novels:pipeline:done`: novel-file processing pipeline completion. `total` counts processed novel JSON files, not restored novel rows.
- `readMs` / `parseMs` / `databaseMs` / `coverProcessingMs`: accumulated time for novel-file reads, JSON parsing, database restore batches, and cover processing. Cover time can include concurrent native copies; it is elapsed stage time, not a sum of per-file CPU time.
- `databaseBatches` and `batchCount`: number of non-empty database restore batches in the emitting implementation.
- `uniqueInputChapterCount`: Optimize Import deduplicates chapter identities before counting. Earlier restore-perf logs accumulated raw chapter rows despite using this same field name. Preserve the original key and explain its implementation-specific meaning.
- `chapterWriteChunkCalls` / `chapterWriteRowsAttempted`: database insert statements and input rows submitted to those statements. Different implementations may batch these differently, so compare elapsed database time and workload before comparing counts.
- `restoreFailures`: a bounded sample of per-novel database failures, not necessarily a complete count of all errors.
- `restoreData:novels:validation:start`: a timing event only. Its `duration:` value measures the gap since the previous log event, not validation runtime; there is no matching validation-complete event in these logs.
- `local:selected-archive-unzip:done`: extraction of one selected inner archive. `local:selected-archives:done` marks completion of those extractions.
- `local:downloaded-files:done`: downloaded novel files have been restored. `local:selected-files:done` marks completion of selected-file handling.
- Durations are wall-clock elapsed times from `performance.now()`. The `duration:` value is the interval since the preceding benchmark event. Adjacent stage intervals and end-to-end totals can differ slightly due to logging and omitted setup or completion work.

## Comparisons and data quality

Prefer runs with matching reported archive metadata, device, reset state, and workload. Matching file counts and byte counts mean the reported metadata matches; it does not prove the archives are byte-for-byte identical. Backup format, image optimization, validation settings, app code path, and run order can all affect timing. Record those distinctions explicitly.

When showing percentage deltas, name the exact baseline in the table caption and calculate `(run value / baseline value - 1) × 100`. Positive values mean slower than baseline; negative values mean faster. If multiple Restore-perf runs exist, identify the specific one rather than calling it simply “Restore-perf”.

Preserve each run separately. Do not replace older values with a new result or combine runs into an average unless the user asks for that analysis. If a log omits an archive size, code revision, device, or setting, write `not provided` rather than inferring it. When the user supplies more benchmark information, append it here and update this guide only if the format or shorthand changes.
