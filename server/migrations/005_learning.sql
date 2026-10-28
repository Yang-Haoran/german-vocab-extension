-- Daily lesson (/heute): growing review intervals, lesson and writing history, small bot state.
alter table words
  add column if not exists stage integer not null default 0,
  add column if not exists origin text not null default 'extension',
  add column if not exists mistake text not null default '';

-- Words already marked "know" start one step up the interval ladder.
update words set stage = 1 where last_result = 'know' and stage = 0;

create table if not exists lessons (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  category text not null default '',
  source text not null default '',
  url text not null default '',
  title text not null default '',
  text_de text not null default '',
  text_zh text not null default '',
  question_de text not null default '',
  question_zh text not null default '',
  keywords jsonb not null default '[]',
  answered_at timestamptz
);

create table if not exists writings (
  id bigserial primary key,
  lesson_id bigint references lessons (id),
  created_at timestamptz not null default now(),
  text text not null,
  corrected text not null default '',
  better text not null default '',
  errors jsonb not null default '[]'
);

create table if not exists bot_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
