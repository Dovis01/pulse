CREATE TABLE "article_cluster_links" (
	"article_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	CONSTRAINT "article_cluster_links_article_id_cluster_id_pk" PRIMARY KEY("article_id","cluster_id")
);
--> statement-breakpoint
CREATE TABLE "article_entities" (
	"article_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "article_entities_article_id_entity_pk" PRIMARY KEY("article_id","entity")
);
--> statement-breakpoint
CREATE TABLE "article_topics" (
	"article_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "article_topics_article_id_topic_pk" PRIMARY KEY("article_id","topic")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"source_authority" integer DEFAULT 50 NOT NULL,
	"source_provider" text NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"author" text,
	"image_url" text,
	"language" text,
	"country" text,
	"category" text DEFAULT 'Other' NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cluster_id" uuid,
	"importance_score" real DEFAULT 0 NOT NULL,
	"relevance_score" real DEFAULT 0 NOT NULL,
	"velocity_score" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"brief_date" text NOT NULL,
	"intro" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"story_count" integer DEFAULT 0 NOT NULL,
	"model" text,
	"version" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_briefs_kind_date_unique" UNIQUE("kind","brief_date")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"name" text PRIMARY KEY NOT NULL,
	"weight" integer DEFAULT 50 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"cron_group" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"cluster_id" uuid,
	"subject" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "read_history" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_articles" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"note" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"provider" text NOT NULL,
	"category" text NOT NULL,
	"language" text,
	"country" text,
	"authority_score" integer DEFAULT 50 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"refresh_interval_minutes" integer DEFAULT 30 NOT NULL,
	"cron_group" text DEFAULT 'normal' NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary_short" text,
	"summary_full" text,
	"why_it_matters" text,
	"key_points" jsonb,
	"summary_model" text,
	"summary_version" text,
	"summary_generated_at" timestamp with time zone,
	"cluster_hash" text,
	"importance_score" real DEFAULT 0 NOT NULL,
	"breaking_score" real DEFAULT 0 NOT NULL,
	"velocity_score" real DEFAULT 0 NOT NULL,
	"relevance_score" real DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp with time zone,
	"metadata" jsonb,
	CONSTRAINT "story_clusters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"name" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"topic" text PRIMARY KEY NOT NULL,
	"weight" real DEFAULT 0.5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_cluster_links" ADD CONSTRAINT "article_cluster_links_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_cluster_links" ADD CONSTRAINT "article_cluster_links_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_topics" ADD CONSTRAINT "article_topics_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_history" ADD CONSTRAINT "read_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_entities_entity_idx" ON "article_entities" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "article_topics_topic_idx" ON "article_topics" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_cluster_idx" ON "articles" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "story_clusters_updated_idx" ON "story_clusters" USING btree ("last_updated_at");--> statement-breakpoint
CREATE INDEX "story_clusters_importance_idx" ON "story_clusters" USING btree ("importance_score");--> statement-breakpoint
CREATE INDEX "usage_events_kind_at_idx" ON "usage_events" USING btree ("kind","at");