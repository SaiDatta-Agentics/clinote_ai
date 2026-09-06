CREATE TABLE `audio_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audio_encounter` ON `audio_assets` (`encounter_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`encounter_id` text,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_owner_created` ON `audit_events` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clinical_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`status` text NOT NULL,
	`chief_complaint` text DEFAULT '' NOT NULL,
	`subjective` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`assessment` text DEFAULT '' NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`patient_summary` text DEFAULT '' NOT NULL,
	`medications` text NOT NULL,
	`allergies` text NOT NULL,
	`uncertainties` text NOT NULL,
	`updated_at` text NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notes_encounter` ON `clinical_notes` (`encounter_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_status` ON `clinical_notes` (`status`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`guardian_name` text,
	`captured_at` text NOT NULL,
	`withdrawn_at` text,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_consent_encounter` ON `consent_records` (`encounter_id`);--> statement-breakpoint
CREATE TABLE `encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`consultation_type` text NOT NULL,
	`status` text NOT NULL,
	`clinician_name` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_encounters_owner_scheduled` ON `encounters` (`owner_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_encounters_patient` ON `encounters` (`patient_id`);--> statement-breakpoint
CREATE INDEX `idx_encounters_status` ON `encounters` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `clinical_notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_note_versions_note_version` ON `note_versions` (`note_id`,`version`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`mrn` text NOT NULL,
	`sex` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`allergies` text NOT NULL,
	`medications` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_patients_owner_name` ON `patients` (`owner_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_patients_owner_mrn` ON `patients` (`owner_id`,`mrn`);--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`encounter_id` text NOT NULL,
	`segments` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transcripts_encounter` ON `transcripts` (`encounter_id`);