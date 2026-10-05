-- New recruitment documents. Older applications did not collect these links.
-- Letter of Intent is required by form/server validation for new applications.
alter table public.applications
  add column if not exists letter_of_intent_url text
    check (letter_of_intent_url is null or char_length(letter_of_intent_url) between 1 and 500),
  add column if not exists grades_url text
    check (grades_url is null or char_length(grades_url) between 1 and 500);
