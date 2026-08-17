alter table words
  add column if not exists cefr_level text not null default '';

create index if not exists words_cefr_level_idx on words (cefr_level);
