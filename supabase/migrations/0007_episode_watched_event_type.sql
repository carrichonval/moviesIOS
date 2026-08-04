-- Split from 0008's trigger on purpose: a new enum value can't be referenced in the same
-- transaction it was added in.
alter type movies.event_type add value 'episode_watched';
alter table movies.events add column season_number integer;
alter table movies.events add column episode_number integer;
