alter table words
  add column if not exists deleted_at timestamptz;

create index if not exists words_deleted_at_idx on words (deleted_at);
create index if not exists words_active_review_idx
  on words (next_review_at, created_at)
  where deleted_at is null;
