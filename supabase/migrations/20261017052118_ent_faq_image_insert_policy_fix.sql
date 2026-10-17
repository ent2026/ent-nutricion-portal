create policy faq_admin_insert on public.faq_visual for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role')='admin');
