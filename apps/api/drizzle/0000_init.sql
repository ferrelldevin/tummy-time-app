CREATE TYPE "public"."audit_event_type" AS ENUM('sign_up', 'sign_in', 'sign_in_failed', 'lockout', 'sign_out', 'account_deleted');--> statement-breakpoint
CREATE SEQUENCE "public"."tummy_logs_rev_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_lookup" text NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_lookup_is_hex_sha256" CHECK ("accounts"."code_lookup" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "accounts_pin_hash_is_argon2id" CHECK ("accounts"."pin_hash" LIKE '$argon2id$%'),
	CONSTRAINT "accounts_failed_attempts_range" CHECK ("accounts"."failed_attempts" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "audit_event_type" NOT NULL,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_id_hash_is_hex_sha256" CHECK ("sessions"."id_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_expires_after_created" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_seen_after_created" CHECK ("sessions"."last_seen_at" >= "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "tummy_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"rev" bigint DEFAULT nextval('tummy_logs_rev_seq') NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tummy_logs_duration_range" CHECK ("tummy_logs"."duration_seconds" BETWEEN 1 AND 7200)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tummy_logs" ADD CONSTRAINT "tummy_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_code_lookup_key" ON "accounts" USING btree ("code_lookup");--> statement-breakpoint
CREATE INDEX "audit_events_account_id_idx" ON "audit_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tummy_logs_account_id_rev_idx" ON "tummy_logs" USING btree ("account_id","rev");--> statement-breakpoint
CREATE UNIQUE INDEX "tummy_logs_rev_key" ON "tummy_logs" USING btree ("rev");