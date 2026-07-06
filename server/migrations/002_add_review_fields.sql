alter table words
  add column if not exists review_count integer not null default 0,
  add column if not exists difficulty integer not null default 2,
  add column if not exists next_review_at timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_result text;

update words
set next_review_at = coalesce(next_review_at, created_at)
where next_review_at is null;

create index if not exists words_next_review_idx on words (next_review_at, difficulty desc);
create index if not exists words_difficulty_idx on words (difficulty desc);
