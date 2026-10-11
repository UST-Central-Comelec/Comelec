-- Preserve existing links while allowing multiple typed working documents.
alter table public.secretariat_letters
add column if not exists working_documents jsonb not null default '[]'::jsonb
check (jsonb_typeof(working_documents) = 'array');

update public.secretariat_letters
set working_documents = jsonb_build_array(jsonb_build_object(
  'type', case
    when working_document like 'https://docs.google.com/document/%' then 'docs'
    when working_document like 'https://docs.google.com/spreadsheets/%' then 'sheets'
    when working_document like 'https://drive.google.com/%' then 'drive'
    else 'pdf'
  end,
  'url', working_document
))
where working_document <> '' and working_documents = '[]'::jsonb;
notify pgrst, 'reload schema';
