CREATE TABLE "attestations" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"uid" text NOT NULL,
	"statement" text NOT NULL,
	"statement_hash" text NOT NULL,
	"catalog_score" real,
	"metadata" text,
	"metadata_hash" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "funding" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"lamports" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_uid" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "partners_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"uid" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"wallet_pubkey" text NOT NULL,
	"wallet_secret_enc" text NOT NULL,
	"exported_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"challenger_uid" text NOT NULL,
	"evidence" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_url" text,
	"matched_part" text,
	"since_when" text,
	"challenger_email" text,
	"reject_reason" text,
	"reviewed_at" timestamp,
	"tx_sig" text,
	"resolve_tx_sig" text,
	"response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_invites" (
	"work_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "work_invites_work_id_email_pk" PRIMARY KEY("work_id","email")
);
--> statement-breakpoint
CREATE TABLE "work_versions" (
	"work_id" text NOT NULL,
	"idx" integer NOT NULL,
	"content_hash" text NOT NULL,
	"tx_sig" text NOT NULL,
	"author_uid" text NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"lyrics" text DEFAULT '' NOT NULL,
	"chords" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "work_versions_work_id_idx_pk" PRIMARY KEY("work_id","idx")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"display_name" text,
	"lyrics" text DEFAULT '' NOT NULL,
	"chords" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"source_ref" text,
	"partner_id" text,
	"external_ref" text,
	"fingerprint" text,
	"work_pda" text,
	"onchain_status" text,
	"registered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "funding_uid_idx" ON "funding" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "funding_created_idx" ON "funding" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "partners_owner_idx" ON "partners" USING btree ("owner_uid");--> statement-breakpoint
CREATE INDEX "wallets_email_idx" ON "wallets" USING btree ("email");--> statement-breakpoint
CREATE INDEX "work_versions_hash_idx" ON "work_versions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "works_user_idx" ON "works" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "works_fingerprint_idx" ON "works" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "works_partner_ref_idx" ON "works" USING btree ("partner_id","external_ref");