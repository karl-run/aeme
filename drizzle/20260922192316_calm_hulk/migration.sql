CREATE TABLE `channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`suid` integer NOT NULL,
	`created` text NOT NULL UNIQUE
);
