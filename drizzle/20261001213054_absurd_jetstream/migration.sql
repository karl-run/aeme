CREATE TABLE `activities` (
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
	CONSTRAINT "activities_ideal_member_count_positive" CHECK("ideal_member_count" IS NULL OR "ideal_member_count" > 0)
);
--> statement-breakpoint
CREATE TABLE `activity_availability` (
	`id` text PRIMARY KEY,
	`activity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`slots` text NOT NULL,
	`declined` integer DEFAULT false NOT NULL,
	`plus_one` integer DEFAULT false NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	CONSTRAINT `fk_activity_availability_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activity_availability_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
	CONSTRAINT "activity_availability_slots_json" CHECK(json_valid("slots") AND json_type("slots") = 'array'),
	CONSTRAINT "activity_availability_declined_no_slots" CHECK("declined" = 0 OR json_array_length("slots") = 0),
	CONSTRAINT "activity_availability_declined_no_plus_one" CHECK("declined" = 0 OR "plus_one" = 0)
);
--> statement-breakpoint
CREATE TABLE `activity_booking_attendees` (
	`id` text PRIMARY KEY,
	`booking_id` text NOT NULL,
	`user_id` text,
	`name` text,
	CONSTRAINT `fk_activity_booking_attendees_booking_id_activity_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `activity_bookings`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activity_booking_attendees_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
	CONSTRAINT "activity_booking_attendees_user_or_name" CHECK(("user_id" IS NOT NULL AND "name" IS NULL) OR ("user_id" IS NULL AND length(trim("name")) > 0))
);
--> statement-breakpoint
CREATE TABLE `activity_bookings` (
	`id` text PRIMARY KEY,
	`activity_id` text NOT NULL,
	`created_by` text NOT NULL,
	`date` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`location_id` text,
	`slack_message_ts` text,
	`created` text NOT NULL,
	CONSTRAINT `fk_activity_bookings_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activity_bookings_created_by_users_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_activity_bookings_location_id_activity_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `activity_locations`(`id`) ON DELETE SET NULL,
	CONSTRAINT "activity_bookings_date_format" CHECK("date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "activity_bookings_location_xor" CHECK("location_id" IS NULL OR "location" = ''),
	CONSTRAINT "activity_bookings_time_format" CHECK("from" GLOB '[0-2][0-9]:[0-5][0-9]' AND "to" GLOB '[0-2][0-9]:[0-5][0-9]'),
	CONSTRAINT "activity_bookings_from_before_to" CHECK("from" < "to")
);
--> statement-breakpoint
CREATE TABLE `activity_locations` (
	`id` text PRIMARY KEY,
	`activity_id` text NOT NULL,
	`name` text NOT NULL,
	`maps_url` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created` text NOT NULL,
	CONSTRAINT `fk_activity_locations_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE,
	CONSTRAINT "activity_locations_name_not_empty" CHECK(length(trim("name")) > 0),
	CONSTRAINT "activity_locations_maps_url_not_empty" CHECK(length(trim("maps_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE `channel_members` (
	`id` text PRIMARY KEY,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined` text NOT NULL,
	CONSTRAINT `fk_channel_members_channel_id_channels_channel_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`channel_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_channel_members_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`channel_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`created` text NOT NULL,
	CONSTRAINT `fk_channels_owner_users_user_id_fk` FOREIGN KEY (`owner`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `otp_logins` (
	`otp_hash` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	CONSTRAINT `fk_otp_logins_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_otp_logins_channel_id_channels_channel_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`channel_id`) ON DELETE CASCADE,
	CONSTRAINT "otp_hash_sha256_hex" CHECK(length("otp_hash") = 64 AND "otp_hash" NOT GLOB '*[^a-f0-9]*')
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sessions_channel_id_channels_channel_id_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`channel_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_availability_activity_user` ON `activity_availability` (`activity_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_booking_attendees_booking_user` ON `activity_booking_attendees` (`booking_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_locations_activity_name` ON `activity_locations` (`activity_id`,`name`) WHERE "activity_locations"."archived" = 0;--> statement-breakpoint
CREATE UNIQUE INDEX `channel_members_channel_user` ON `channel_members` (`channel_id`,`user_id`);