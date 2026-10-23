CREATE TABLE `pets` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pets_owner_id` ON `pets` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
