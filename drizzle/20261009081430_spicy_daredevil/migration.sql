ALTER TABLE `activities` ADD `max_member_count` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activities` (
	`id` text PRIMARY KEY,
	`channel_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`end_time` text,
	`persistent` integer DEFAULT false NOT NULL,
	`slot_granularity` text DEFAULT 'day' NOT NULL,
	`suggested_dates` text,
	`ideal_member_count` integer,
	`max_member_count` integer,
	`slack_message_ts` text,
	`archived` integer DEFAULT false NOT NULL,
	`created` text NOT NULL,
	CONSTRAINT `fk_activities_channel_id_channels_channel_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`channel_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activities_created_by_users_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT,
	CONSTRAINT "activities_persistent_no_end_time" CHECK("persistent" = 0 OR "end_time" IS NULL),
	CONSTRAINT "activities_oneoff_has_end_time" CHECK("persistent" = 1 OR "end_time" IS NOT NULL),
	CONSTRAINT "activities_end_time_utc" CHECK("end_time" IS NULL OR "end_time" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9].[0-9][0-9][0-9]Z'),
	CONSTRAINT "activities_suggested_dates_json" CHECK("suggested_dates" IS NULL OR (json_valid("suggested_dates") AND json_array_length("suggested_dates") > 0)),
	CONSTRAINT "activities_slot_granularity_valid" CHECK("slot_granularity" IN ('day', 'hourly')),
	CONSTRAINT "activities_persistent_no_suggested_dates" CHECK("persistent" = 0 OR "suggested_dates" IS NULL),
	CONSTRAINT "activities_ideal_member_count_positive" CHECK("ideal_member_count" IS NULL OR "ideal_member_count" > 0),
	CONSTRAINT "activities_max_member_count_positive" CHECK("max_member_count" IS NULL OR "max_member_count" > 0),
	CONSTRAINT "activities_ideal_within_max" CHECK("ideal_member_count" IS NULL OR "max_member_count" IS NULL OR "ideal_member_count" <= "max_member_count")
);
--> statement-breakpoint
INSERT INTO `__new_activities`(`id`, `channel_id`, `created_by`, `title`, `description`, `end_time`, `persistent`, `slot_granularity`, `suggested_dates`, `ideal_member_count`, `slack_message_ts`, `archived`, `created`) SELECT `id`, `channel_id`, `created_by`, `title`, `description`, `end_time`, `persistent`, `slot_granularity`, `suggested_dates`, `ideal_member_count`, `slack_message_ts`, `archived`, `created` FROM `activities`;--> statement-breakpoint
DROP TABLE `activities`;--> statement-breakpoint
ALTER TABLE `__new_activities` RENAME TO `activities`;--> statement-breakpoint
PRAGMA foreign_keys=ON;