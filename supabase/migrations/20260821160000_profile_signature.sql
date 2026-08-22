alter table public.profiles add column if not exists signature_url text;
comment on column public.profiles.signature_url is 'ลายเซ็นดิจิทัลของผู้ใช้สำหรับเอกสารราชการ';
