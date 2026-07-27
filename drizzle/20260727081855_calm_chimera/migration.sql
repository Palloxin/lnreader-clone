DROP TRIGGER IF EXISTS `update_novel_stats`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `update_novel_stats_on_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `update_novel_stats_on_delete`;--> statement-breakpoint
DROP TABLE IF EXISTS `__new_Novel`;--> statement-breakpoint
DROP TABLE IF EXISTS `__migration_Chapter`;--> statement-breakpoint
DROP TABLE IF EXISTS `__migration_NovelCategory`;--> statement-breakpoint
CREATE TABLE `__new_Novel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`pluginId` text NOT NULL,
	`name` text NOT NULL,
	`cover` text,
	`summary` text,
	`author` text,
	`artist` text,
	`status` text DEFAULT 'Unknown',
	`genres` text,
	`inLibrary` integer DEFAULT false,
	`isLocal` integer DEFAULT false,
	`totalPages` integer DEFAULT 0,
	`chaptersDownloaded` integer DEFAULT 0,
	`chaptersUnread` integer DEFAULT 0,
	`totalChapters` integer DEFAULT 0,
	`lastReadAt` text,
	`lastUpdatedAt` text
);
--> statement-breakpoint
INSERT INTO `__new_Novel` (
	`id`,
	`path`,
	`pluginId`,
	`name`,
	`cover`,
	`summary`,
	`author`,
	`artist`,
	`status`,
	`genres`,
	`inLibrary`,
	`isLocal`,
	`totalPages`,
	`chaptersDownloaded`,
	`chaptersUnread`,
	`totalChapters`,
	`lastReadAt`,
	`lastUpdatedAt`
)
SELECT
	`Novel`.`id`,
	`Novel`.`path`,
	`Novel`.`pluginId`,
	`Novel`.`name`,
	`Novel`.`cover`,
	`Novel`.`summary`,
	`Novel`.`author`,
	`Novel`.`artist`,
	`Novel`.`status`,
	`Novel`.`genres`,
	`Novel`.`inLibrary`,
	`Novel`.`isLocal`,
	`Novel`.`totalPages`,
	(
		SELECT COUNT(*)
		FROM `Chapter`
		WHERE `Chapter`.`novelId` = `Novel`.`id`
			AND `Chapter`.`isDownloaded` = 1
	),
	(
		SELECT COUNT(*)
		FROM `Chapter`
		WHERE `Chapter`.`novelId` = `Novel`.`id`
			AND `Chapter`.`unread` = 1
	),
	(
		SELECT COUNT(*)
		FROM `Chapter`
		WHERE `Chapter`.`novelId` = `Novel`.`id`
	),
	(
		SELECT MAX(`Chapter`.`readTime`)
		FROM `Chapter`
		WHERE `Chapter`.`novelId` = `Novel`.`id`
	),
	(
		SELECT MAX(`Chapter`.`updatedTime`)
		FROM `Chapter`
		WHERE `Chapter`.`novelId` = `Novel`.`id`
	)
FROM `Novel`;--> statement-breakpoint
CREATE TABLE `__migration_Chapter` AS SELECT * FROM `Chapter`;--> statement-breakpoint
CREATE TABLE `__migration_NovelCategory` AS SELECT * FROM `NovelCategory`;--> statement-breakpoint
DROP TABLE `Novel`;--> statement-breakpoint
ALTER TABLE `__new_Novel` RENAME TO `Novel`;--> statement-breakpoint
INSERT INTO `Chapter` SELECT * FROM `__migration_Chapter`;--> statement-breakpoint
INSERT INTO `NovelCategory` SELECT * FROM `__migration_NovelCategory`;--> statement-breakpoint
DROP TABLE `__migration_Chapter`;--> statement-breakpoint
DROP TABLE `__migration_NovelCategory`;--> statement-breakpoint
CREATE UNIQUE INDEX `novel_path_plugin_unique` ON `Novel` (`path`,`pluginId`);--> statement-breakpoint
CREATE INDEX `NovelIndex` ON `Novel` (`pluginId`,`path`,`id`,`inLibrary`);
