-- Official documents now link to Google Drive instead of being uploaded, and member photos are
-- compressed in the browser to 1 MB or less. Tighten the uploads bucket to match.
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'uploads';
