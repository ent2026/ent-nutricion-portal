alter table public.lifestyle_library
  drop constraint if exists lifestyle_library_youtube_url_check;

alter table public.lifestyle_library
  add constraint lifestyle_library_youtube_url_check
  check (
    lower(youtube_url) like 'https://youtube.com/%'
    or lower(youtube_url) like 'https://www.youtube.com/%'
    or lower(youtube_url) like 'https://youtu.be/%'
  );
