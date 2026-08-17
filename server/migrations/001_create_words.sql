create table if not exists words (
  id bigserial primary key,
  original text not null,
  translation text not null,
  base_form text default '',
  part_of_speech text default '',
  cefr_level text default '',
  article text default '',
  plural text default '',
  explanation text default '',
  context_text text default '',
  context_translation text default '',
  source_title text default '',
  source_url text default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (original, source_url)
);

create index if not exists words_created_at_idx on words (created_at desc);
create index if not exists words_reviewed_at_idx on words (reviewed_at, created_at);
