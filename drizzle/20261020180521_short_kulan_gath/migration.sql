PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_locations` (
	`id` text PRIMARY KEY,
	`activity_id` text NOT NULL,
	`name` text NOT NULL,
	`maps_url` text NOT NULL,
	`booking_url` text,
	`maps_place_name` text,
	`archived` integer DEFAULT false NOT NULL,
	`created` text NOT NULL,
	CONSTRAINT `fk_activity_locations_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE,
	CONSTRAINT "activity_locations_name_not_empty" CHECK(length(trim("name")) > 0),
	CONSTRAINT "activity_locations_maps_url_not_empty" CHECK(length(trim("maps_url")) > 0),
	CONSTRAINT "activity_locations_booking_url_not_empty" CHECK("booking_url" IS NULL OR length(trim("booking_url")) > 0),
	CONSTRAINT "activity_locations_maps_place_name_not_empty" CHECK("maps_place_name" IS NULL OR length(trim("maps_place_name")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_activity_locations`(`id`, `activity_id`, `name`, `maps_url`, `archived`, `created`) SELECT `id`, `activity_id`, `name`, `maps_url`, `archived`, `created` FROM `activity_locations`;--> statement-breakpoint
DROP TABLE `activity_locations`;--> statement-breakpoint
ALTER TABLE `__new_activity_locations` RENAME TO `activity_locations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `activity_locations_activity_name` ON `activity_locations` (`activity_id`,`name`) WHERE "activity_locations"."archived" = 0;