alter table public.site_configuration
  add column if not exists consult_initial_price numeric check (consult_initial_price is null or consult_initial_price >= 0),
  add column if not exists consult_followup_price numeric check (consult_followup_price is null or consult_followup_price >= 0),
  add column if not exists consult_bimonthly_price numeric check (consult_bimonthly_price is null or consult_bimonthly_price >= 0),
  add column if not exists consult_quarterly_price numeric check (consult_quarterly_price is null or consult_quarterly_price >= 0),
  add column if not exists consult_semester_price numeric check (consult_semester_price is null or consult_semester_price >= 0),
  add column if not exists consult_couple_price numeric check (consult_couple_price is null or consult_couple_price >= 0),
  add column if not exists consult_prices_valid_until date;

update public.site_configuration
set consult_initial_price = 900,
    consult_followup_price = 800,
    consult_bimonthly_price = 1400,
    consult_quarterly_price = 2100,
    consult_semester_price = 3900,
    consult_couple_price = 1400,
    consult_prices_valid_until = date '2026-12-01'
where id = 1;
