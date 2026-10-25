ALTER TABLE `users` ADD `calendar_token` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`user_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`calendar_token` text,
	`created` text NOT NULL,
	CONSTRAINT "users_color_hex" CHECK("color" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "users_calendar_token_hex" CHECK("calendar_token" IS NULL OR (length("calendar_token") = 32 AND "calendar_token" NOT GLOB '*[^a-f0-9]*'))
);
--> statement-breakpoint
INSERT INTO `__new_users`(`user_id`, `name`, `color`, `created`) SELECT `user_id`, `name`, `color`, `created` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_calendar_token` ON `users` (`calendar_token`);