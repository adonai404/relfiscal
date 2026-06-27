alter table public.company_documentation
  add column if not exists folder text default null;
