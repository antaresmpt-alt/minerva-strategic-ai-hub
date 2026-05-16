-- Catálogo material proveedor (Adestor / Fedrigoni) — consulta en Etiquetas digital.
-- Seed: Catalogo_Consolidado_MERGED_Adestor_Fedrigoni.xlsx (171 filas).

create table if not exists public.prod_etiquetas_material_catalogo (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  categoria text null,
  item_number text not null,
  face_name text null,
  adhesive text null,
  backing text null,
  price_m2 numeric(12, 4) null,
  ean_code text null,
  notes text null,
  stock_dimensions text null,
  activo boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prod_etiquetas_material_catalogo_marca_chk
    check (marca in ('ADESTOR', 'FEDRIGONI'))
);

create index if not exists idx_prod_etiquetas_material_marca
  on public.prod_etiquetas_material_catalogo (marca, activo);

create index if not exists idx_prod_etiquetas_material_item
  on public.prod_etiquetas_material_catalogo (lower(item_number));

comment on table public.prod_etiquetas_material_catalogo is
  'Catálogo técnico Adestor/Fedrigoni para consulta de códigos y EAN (Etiquetas digital).';

create or replace function public.prod_etiquetas_material_catalogo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prod_etiquetas_material_catalogo_set_updated_at
  on public.prod_etiquetas_material_catalogo;

create trigger prod_etiquetas_material_catalogo_set_updated_at
  before update on public.prod_etiquetas_material_catalogo
  for each row
  execute function public.prod_etiquetas_material_catalogo_set_updated_at();

alter table public.prod_etiquetas_material_catalogo enable row level security;

grant select, insert, update, delete on public.prod_etiquetas_material_catalogo to authenticated;

drop policy if exists prod_etiquetas_material_catalogo_select
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_select
  on public.prod_etiquetas_material_catalogo for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_insert
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_insert
  on public.prod_etiquetas_material_catalogo for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_update
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_update
  on public.prod_etiquetas_material_catalogo for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (
          array['admin', 'gerencia', 'produccion', 'digital', 'logistica']
        )
    )
  );

drop policy if exists prod_etiquetas_material_catalogo_delete
  on public.prod_etiquetas_material_catalogo;
create policy prod_etiquetas_material_catalogo_delete
  on public.prod_etiquetas_material_catalogo for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and me.role::text = any (array['admin', 'gerencia'])
    )
  );

-- Seed idempotente (solo si tabla vacía)
insert into public.prod_etiquetas_material_catalogo (
  marca,
  categoria,
  item_number,
  face_name,
  adhesive,
  backing,
  price_m2,
  ean_code,
  notes,
  stock_dimensions,
  activo
)
select v.marca, v.categoria, v.item_number, v.face_name, v.adhesive, v.backing,
  v.price_m2, v.ean_code, v.notes, v.stock_dimensions, v.activo
from (
  values
('ADESTOR', 'Uncoated Papers', '7115', 'Vellum', 'A-251', 'GA62', null, '8447390071159', 'ADHSORIA', '2000-4000', true),
('ADESTOR', 'Uncoated Papers', '7120', 'Vellum', 'SP-123', 'GA62', null, '8447390071203', 'ADHSORIA', '2000-4000', true),
('ADESTOR', 'Uncoated Papers', '47868', 'Vellum', 'Supertack', 'GA62', null, '8447390478682', 'ADHSORIA', '2000', true),
('ADESTOR', 'Uncoated Papers', '152411', 'Vellum', 'HM100', 'GA62', null, '8447390001606', 'ADHSORIA', '2000-4000', true),
('ADESTOR', 'Uncoated Papers', '191815', 'Vellum', 'HM245', 'GA62', null, '8447390005970', 'ADHSORIA', '2000', true),
('ADESTOR', 'Uncoated Papers', '166794', 'Vellum', 'HM300', 'GA62', 0.36, '8447390002924', 'ADHSORIA', null, true),
('ADESTOR', 'Uncoated Papers', '60763', 'Vellum', 'CG-349', 'GA62', null, '8447390607631', 'ADHSORIA', '2000', true),
('ADESTOR', 'Uncoated Papers', '7123', 'Vellum', 'RA-678', 'GA62', null, '8447390071234', 'ADHSORIA', null, true),
('ADESTOR', 'Uncoated Papers', '8461', 'Vellum', 'SA-234', 'GA62', null, '8447390084616', 'ADHSORIA', null, true),
('ADESTOR', 'Uncoated Papers', '83658', 'Vellum Duplex (SP123/GA62)', 'SP-123', 'GA62', null, '8447390836581', 'ADHSORIA', null, true),
('ADESTOR', 'Uncoated Papers', '177521', 'Seal Nature DfE', 'Supertack', 'GA62', null, '8447390002542', 'ADHSEALDFE', null, true),
('ADESTOR', 'Coated Gloss White Papers', '7173', 'Art 80', 'A-251', 'GA62', null, '8447390071739', 'ADHALMAZAN', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '7174', 'Art 80', 'SP123-', 'GA62', null, '8447390071746', 'ADHALMAZAN', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '143670', 'Art 80', 'HM-100', 'GA62', null, '8447390002016', 'ADHALMAZAN', null, true),
('ADESTOR', 'Coated Gloss White Papers', '48997', 'Art 80', 'Supertack', 'GA62', null, '8447390489978', 'ADHALMAZAN', null, true),
('ADESTOR', 'Coated Gloss White Papers', '75145', 'Art 80 Opaque', 'A-251', 'GA62', null, '8447390751457', 'ADHALMAZAN', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '87542', 'Art 80 Opaque', 'SP123-', 'GA62', null, '8447390875429', 'ADHALMAZAN', null, true),
('ADESTOR', 'Coated Gloss White Papers', '114363', 'Art 80 Duplex (A251+GW62)', 'A-251', 'GW62', null, '8447390002863', 'ADHALMAZAN', null, true),
('ADESTOR', 'Coated Gloss White Papers', '67424', 'Art 225', 'SP-123', 'GA62', null, '8447390674244', 'ADHALMAZAN', null, true),
('ADESTOR', 'Coated Gloss White Papers', '7165', 'Gloss 60', 'SP123-', 'GA62', null, '8447390071654', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '50617', 'Gloss 60', 'Supertack', 'GA62', null, '8447390506170', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '7154', 'Gloss 80', 'A-251', 'GA62', null, '8447390071548', 'ADHDUERO', '2000-4000', true),
('ADESTOR', 'Coated Gloss White Papers', '147659', 'Gloss 80', 'A-251', 'PET23', null, '8447390001200', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '7155', 'Gloss 80', 'SP-123', 'GA62', null, '8447390071555', 'ADHDUERO', '2000-4000', true),
('ADESTOR', 'Coated Gloss White Papers', '161773', 'Gloss 80', 'SP123-', 'PET23', null, '8447390001385', 'ADHDUERO', '2000-4000', true),
('ADESTOR', 'Coated Gloss White Papers', '177549', 'Gloss 80', 'SP-123', 'PET30', 0.35, '8447390003099', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '46421', 'Gloss 80', 'Supertack', 'GA62', null, '8447390464210', 'ADHDUERO', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '117047', 'Gloss 80', 'HM-100', 'GA62', null, '8447390001446', 'ADHDUERO', '2000-4000', true),
('ADESTOR', 'Coated Gloss White Papers', '191814', 'Gloss 80', 'HM245', 'GA62', null, '8447390005963', 'ADHDUERO', '2000-4000', true),
('ADESTOR', 'Coated Gloss White Papers', '156397', 'Gloss 80', 'HM-300', 'GA62', 0.36, '8447390001330', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '36301', 'Gloss 80', 'CG349', 'GA62', null, '8447390363018', 'ADHDUERO', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '7157', 'Gloss 80', 'RA-678', 'GA62', null, '8447390071579', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '46475', 'Gloss 80', 'SA-234', 'GA62', null, '8447390464753', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '178801', 'Gloss 80', 'SA-234W', 'GA62', null, '8447390003365', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '153535', 'Gloss 80 Duplex (SP123/GA62)', 'SP123-', 'GA62', null, '8447390003358', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '19397', 'Gloss 90', 'A-251', 'GA62', 0.35, '8447390193974', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '19399', 'Gloss 90', 'SP-123', 'GA62', 0.36, '8447390193998', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '36843', 'Gloss 125', 'A-251', 'GA62', null, '8447390368433', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '43909', 'Gloss 150', 'SP-123', 'GA62', null, '8447390439096', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '65604', 'Board 200', 'SP-123', 'GA62', 0.66, '8447390656042', 'ADHDUERO', null, true),
('ADESTOR', 'Coated Gloss White Papers', '162495', 'Gloss GP', 'SP-123', 'GA62', null, '8447390001231', 'ADHDUEROGP', '2000', true),
('ADESTOR', 'Coated Gloss White Papers', '170545', 'Gloss GP', 'SP-123', 'PET23', 0.49, '8447390001699', 'ADHDUEROGP', '2000', true),
('ADESTOR', 'Coated Matt White Papers', '59947', 'Matt 80', 'A-251', 'GA62', 0.39, '8447390599479', 'ADHSORIAPL', null, true),
('ADESTOR', 'Coated Matt White Papers', '59948', 'Matt 80', 'A-251', 'Kraft 80', null, 'NO', null, null, true),
('ADESTOR', 'Coated High Gloss White Papers', '7182', 'High Gloss 80', 'A-251', 'GA62', 0.48, '8447390071821', 'ADHALTOBRI', '2000', true),
('ADESTOR', 'Coated High Gloss White Papers', '7183', 'High Gloss 80', 'SP123-', 'GA62', null, '8447390071838', 'ADHALTOBRI', '2000', true),
('ADESTOR', 'Coloured Papers', '76927', 'Fluor Yellow', 'A-251', 'GA62', null, '8447390769278', 'ADHFLUORES', null, true),
('ADESTOR', 'Coloured Papers', '76934', 'Fluor Orange', 'A-251', 'GA62', null, '8447390769346', 'ADHFLUORES', null, true),
('ADESTOR', 'Coloured Papers', '76922', 'Fluor Red', 'A-251', 'GA62', null, '8447390769223', 'ADHFLUORES', null, true),
('ADESTOR', 'Coloured Papers', '76940', 'Fluor Green', 'A-251', 'GA62', null, '8447390769407', 'ADHFLUORES', null, true),
('ADESTOR', 'Direct Thermal Papers', '153110', 'Thermal Eco BPA Free', 'A-251', 'GA62', null, '8447390001507', 'ADHTERMBΡΑ', '2000-4000-6000', true),
('ADESTOR', 'Direct Thermal Papers', '147842', 'Thermal Eco BPA Free', 'SP123-', 'GA62', null, '8447390001460', 'ADHTERMΒΡΑ', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '160670', 'Thermal Eco BPA Free', 'Supertack', 'GA62', null, '8447390001484', 'ADHTERMBΡΑ', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '152523', 'Thermal Eco BPA Free', 'HM-100', 'GA62', null, '8447390001477', 'ADHTERMBΒΡΑ', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '191816', 'Thermal Eco BPA Free', 'HM245', 'GA62', null, '8447390005987', 'ADHTERMBΡΑ', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '174815', 'Thermal Eco BPA Free', 'HM-300', 'GA62', 0.38, '8447390002511', 'ADHTERMΒΡΑ', null, true),
('ADESTOR', 'Direct Thermal Papers', '172399', 'Thermal Eco BPA Free', 'CG-349', 'GA62', null, '8447390001491', 'ADHTERMBΡΑ', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '173939', 'Thermal Eco BPA Free', 'SA-234', 'GA62', null, '8447390001521', 'ADHTERMBΡΑ', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '191305', 'Thermal Top PH Free', 'A-251', 'GA62', null, '8447390005796', 'ADHTOPPHFR', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '191308', 'Thermal Top PH Free', 'CG-349', 'GA62', null, '8447390005826', 'ADHTOPPHFR', null, true),
('ADESTOR', 'Direct Thermal Papers', '191242', 'Thermal Top PH Free', 'HM-100', 'GA62', null, '8447390005727', 'ADHTOPPHER', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '192851', 'Thermal Top PH Free', 'HM245', 'GA62', null, '8447390006069', 'ADHTOPFPHFR', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '191291', 'Thermal Top PH Free', 'HM300', 'GA62', 0.49, '8447390005789', 'ADHTOPPHER', null, true),
('ADESTOR', 'Direct Thermal Papers', '191306', 'Thermal Top PH Free', 'SP-123', 'GA62', 0.48, '8447390005802', 'ADHTOPPHFR', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '191307', 'Thermal Top PH Free', 'Supertack', 'GA62', null, '8447390005819', 'ADHTOPPHFR', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '187683', 'Thermal Top FD BPA Free', 'A-251', 'GA62', null, '8447390004935', 'ADHTOPFDTC', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '191010', 'Thermal Top FD BPA Free', 'HM100', 'GA62', null, '8447390005642', 'ADHTOPFDTC', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '187684', 'Thermal Top FD BPA Free', 'SP-123', 'GA62', null, '8447390004942', 'ADHTOPFDTC', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '7287', 'Thermal Top Plus PH Free', 'A-251', 'GA62', null, '8447390072873', 'ADHTERMICT', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '7289', 'Thermal Top Plus PH Free', 'SP-123', 'GA62', null, '8447390072897', 'ADHTERMICT', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '55434', 'Thermal Top Plus PH Free', 'Supertack', 'GA62', null, '8447390554348', 'ADHTERMICT', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '117049', 'Thermal Top Plus PH Free', 'HM-100', 'GA62', null, '8447390001415', 'ADHTERMICT', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '191840', 'Thermal Top Plus PH Free', 'HM245', 'GA62', null, '8447390006007', 'ADHTERMICT', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '158476', 'Thermal Top Plus PH Free', 'HM-300', 'GA62', 0.56, '8447390001309', 'ADHTERMICT', '2000-4000', true),
('ADESTOR', 'Direct Thermal Papers', '9466', 'Thermal Top Plus PH Free', 'CG-349', 'GA62', null, '8447390094660', 'ADHTERMICT', '2000', true),
('ADESTOR', 'Direct Thermal Papers', '44831', 'Thermal Top Plus PH Free', 'RA-678', 'GA62', null, '8447390448319', 'ADHTERMICT', null, true),
('ADESTOR', 'Direct Thermal Papers', '153283', 'Thermal Top Plus PH Free', 'SA-234', 'GA62', null, '8447390001279', 'ADHTERMICT', null, true),
('ADESTOR', 'Direct Thermal Papers', '186548', 'Thermal Top Plus Opaque PH Free', 'A-251', 'GA62', null, '8447390760770', 'ADHTOP+OP', null, true),
('ADESTOR', 'Direct Thermal Papers', '186549', 'Thermal Top Plus Opaque PH Free', 'SP-123', 'GA62', null, '8447390772551', 'ADHTOP+OP', null, true),
('ADESTOR', 'Digital Products', '164210', 'Gloss Inkjet FSC', 'SP-123', 'GW62', null, '8447390001668', 'ADHGLOSSIJ', null, true),
('ADESTOR', 'Digital Products', '163145', 'InkJet Matt FSC', 'A-251', 'GW62', null, '8447390003266', 'ADHMATTIJ', null, true),
('ADESTOR', 'Digital Products', '170161', 'InkJet Matt FSC', 'SP-123', 'GW62', null, '8447390001682', 'ADHMATTIJ', null, true),
('ADESTOR', 'Digital Products', '177240', 'Laser 60 LB DIE', 'SP-123', 'Kraft 80', null, '8447390002610', 'ADHLASERLB', null, true),
('ADESTOR', 'Digital Products', '177418', 'Laser Nature DIE', 'A-251', 'Kraft Laser 55', null, '8447390002801', 'ADHLASNATU', null, true),
('ADESTOR', 'Digital Products', '60955', 'Laser 70', 'A-251', 'Kraft Laser 55', null, '8447390609550', 'ADHLASER', '2000-4000-6000', true),
('ADESTOR', 'Digital Products', '53245', 'Laser 70', 'A-251', 'Kraft Laser 74', null, '8447390532452', 'ADHLASER', '2000-4000', true),
('ADESTOR', 'Digital Products', '103402', 'Laser 70', 'SP-123', 'Kraft Laser 55', null, '8447390001439', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '56437', 'Laser 70', 'SP-123', 'Kraft Laser 74', null, '8447390564378', 'ADHLASER', '4000', true),
('ADESTOR', 'Digital Products', '163123', 'Laser 70', 'CG-349', 'Kraft Laser 55', null, '8447390002627', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '174368', 'Laser 70', 'CG-349', 'Kraft Laser 74', null, '8447390001842', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '139087', 'Laser 70', 'RA-678', 'Kraft Laser 55', null, '8447390002634', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '64783', 'Laser 70', 'RA-678', 'Kraft Laser 74', null, '8447390647835', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '143674', 'Laser 70 Opaque', 'A-251', 'Kraft Laser 55', null, '8447390002931', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '76089', 'Laser 70 Opaque', 'A-251', 'Kraft Laser 74', null, '8447390760893', 'ADHLASER', null, true),
('ADESTOR', 'Digital Products', '186367', 'Laser Colour Yellow', 'A-251', 'Kraft 80', 0.64, '8447390004195', 'ADHCOLORLS', null, true),
('ADESTOR', 'Digital Products', '186377', 'Laser Colour Blue', 'A-251', 'Kraft 80', 0.64, '8447390004218', 'ADHCOLORLS', null, true),
('ADESTOR', 'Digital Products', '186378', 'Laser Colour Green', 'A-251', 'Kraft 80', 0.64, '8447390004225', 'ADHCOLORLS', null, true),
('ADESTOR', 'Digital Products', '186368', 'Laser Colour Red', 'A-251', 'Kraft 80', 0.64, '8447390004201', 'ADHCOLORLS', null, true),
('ADESTOR', 'Digital Products', '182116', 'Laser Fluor Yellow', 'A-251', 'Kraft 80', 0.63, '8447390003396', 'ADHFLUORLS', null, true),
('ADESTOR', 'Digital Products', '182117', 'Laser Fluor Orange', 'A-251', 'Kraft 80', 0.63, '8447390003402', 'ADHFLUORLS', null, true),
('ADESTOR', 'Digital Products', '182118', 'Laser Fluor Red', 'A-251', 'Kraft 80', 0.63, '8447390003419', 'ADHFLUORLS', null, true),
('ADESTOR', 'Digital Products', '182119', 'Laser Fluor Green', 'A-251', 'Kraft 80', 0.63, '8447390003426', 'ADHFLUORLS', null, true),
('ADESTOR', 'Digital Products', '186287', 'Laser High Gloss FSC', 'A-251', 'Kraft 80 FSC', null, '8447390001804', 'ADHHGLASER', null, true),
('ADESTOR', 'Digital Products', '180648', 'PET Laser Matt White', 'A-251', 'KL120', null, '8447390002504', 'ADHPETLMW', null, true),
('ADESTOR', 'Digital Products', '179164', 'PET Laser Matt White', 'SP-123', 'KL120', null, '8447390002498', 'ADHPETLMW', null, true),
('ADESTOR', 'Digital Products', '182053', 'PET Laser Matt White', 'RA-678', 'KL120', null, '8447390003495', 'ADHPETLMW', null, true),
('ADESTOR', 'Wine & Beverage Products', '175300', 'Art 80', 'BC-500', 'GA62', null, '8447390002566', 'ADHALMAZAN', null, true),
('ADESTOR', 'Wine & Beverage Products', '175301', 'Gloss 80', 'BC-500', 'GW80', null, '8447390001767', 'ADHDUERO', null, true),
('ADESTOR', 'Wine & Beverage Products', '175302', 'Gloss 90', 'BC-500', 'GA62', null, '8447390206384', 'ADHDUERO', null, true),
('ADESTOR', 'Wine & Beverage Products', '175336', 'Gloss 90', 'BC-500', 'GW80', null, '8447390206391', 'ADHDUERO', null, true),
('ADESTOR', 'Wine & Beverage Products', '175994', 'Gloss 90', 'BC-500', 'PET23', null, '8447390003105', 'ADHDUERO', null, true),
('ADESTOR', 'Wine & Beverage Products', '175154', 'High Gloss 80', 'BC-500', 'GW80', null, '8447390002740', 'ADHALTOBRI', null, true),
('ADESTOR', 'Wine & Beverage Products', '175460', 'High Gloss 80 WS', 'BC-500', 'GW80', null, '8447390002733', 'ADHALTOBRI', null, true),
('ADESTOR', 'Wine & Beverage Products', '175615', 'Matt 90 WS', 'BC-500', 'GWBO', null, '8447390002689', 'ADHMATTWS', null, true),
('ADESTOR', 'Wine & Beverage Products', '173964', 'Cold Ice White 110 HWS', 'BC-500', 'GW80', null, '8447390002597', 'ADHGLAZED', null, true),
('ADESTOR', 'Wine & Beverage Products', '173965', 'Cotton White 90 WS', 'BC-500', 'GW80', null, '8447390002573', 'ADHCOTTON', null, true),
('ADESTOR', 'Wine & Beverage Products', '176549', 'Embossed Toile 90 WS', 'BC-500', 'GW80', null, '8447390002580', 'ADHTOILE', null, true),
('ADESTOR', 'Wine & Beverage Products', '179228', 'Essence Nature DfE 90 WS', 'BC-500', 'GW80', null, '8447390002030', 'ADHESNATWS', null, true),
('ADESTOR', 'Wine & Beverage Products', '176079', 'Glitter 90 WS', 'BC-500', 'GW80', null, '8447390002603', 'ADHGLITTER', null, true),
('ADESTOR', 'Wine & Beverage Products', '179303', 'Intensive Nero Smooth 110 WS', 'BC-500', 'GW80', null, '8447390002047', 'ADHINEROWS', null, true),
('ADESTOR', 'Wine & Beverage Products', '178578', 'Kraft Brown 70 DfE', 'BC-500', 'GW80', null, '8447390002702', 'ADHKRAFT70', null, true),
('ADESTOR', 'Wine & Beverage Products', '173963', 'Martelé Extra White 90 WS', 'BC-500', 'GW80', null, '8447390002658', 'ADHMARTELE', null, true),
('ADESTOR', 'Wine & Beverage Products', '185083', 'Martelé Extra White 90 WS', 'BC-500', 'PET30', null, '8447390003921', 'ADHMARTELE', null, true),
('ADESTOR', 'Wine & Beverage Products', '173962', 'Martelé Ivory 90 WS', 'BC-500', 'GW80', 0.86, '8447390002665', 'ADHMARTELE', null, true),
('ADESTOR', 'Wine & Beverage Products', '175044', 'Snow Digital 90 WS', 'BC-500', 'GW80', null, '8447390002559', 'ADHSNOW', null, true),
('ADESTOR', 'Wine & Beverage Products', '175422', 'StonePaper 144 DIE', 'BC-500', 'GW80', null, '8447390002535', 'ADHPIEDRA', null, true),
('ADESTOR', 'Wine & Beverage Products', '193441', 'Laid White 90 WS', 'BC-500', 'GW80', null, '8447390006434', 'ADHLAIDCR', null, true),
('ADESTOR', 'Wine & Beverage Products', '193442', 'Laid Cream 90 WS', 'BC-500', 'GW80', null, '8447390006427', 'ADHLAIDWH', null, true),
('ADESTOR', 'Wine & Beverage Products', '193182', 'Vintack White 95 WS', 'BC-500', 'GW80', null, '8447390006342', 'ADHVINTAWH', null, true),
('ADESTOR', 'Wine & Beverage Products', '193440', 'Vintack Cream 90 WS', 'BC-500', 'GW80', null, '8447390001934', 'ADHVINTACR', null, true),
('ADESTOR', 'Wine & Beverage Products', '175329', 'Foil Bright Gold', 'BC-500', 'GW80', null, '8447390002719', 'ADHLAMINAD', null, true),
('ADESTOR', 'Wine & Beverage Products', '175488', 'Foil Bright Silver', 'BC-500', 'GW80', null, '8447390002726', 'ADHLAMINAD', null, true),
('ADESTOR', 'Wine & Beverage Products', '184861', 'Foil Matt Silver', 'BC-500', 'GW80', 0.87, '8447390003853', 'ADHLAMINAD', null, true),
('ADESTOR', 'Wine & Beverage Products', '177715', 'Foil Bright Silver', 'CG-349', 'GW80', null, '8447390002948', 'ADHLAMINAD', null, true),
('ADESTOR', 'Wine & Beverage Products', '177900', 'Metalvac Bright Silver', 'BC-500', 'GW80', 0.74, '8447390002696', 'ADHMETALBS', null, true),
('ADESTOR', 'Wine & Beverage Products', '181013', 'Metalvac Bright Silver', 'A-251', 'GA62', null, '8447390002443', 'ADHMETALBS', null, true),
('ADESTOR', 'Wine & Beverage Products', '181014', 'Metalvac Bright Silver', 'SP123-', 'GA62', null, '8447390002450', 'ADHMETALBS', null, true),
('ADESTOR', 'Wine & Beverage Products', '181015', 'Metalvac Bright Silver', 'SP-123', 'PET23', null, '8447390002467', 'ADHMETALBS', null, true),
('ADESTOR', 'Standard Films', '196418', 'PP Pearl White C TC', 'A-292F', 'GW', null, '8447390006830', 'ADHPPPEARL', '2000', true),
('ADESTOR', 'Standard Films', '196420', 'PP Pearl White C TC', 'A-292F', 'PET23', null, '8447390006847', 'ADHPPPEARL', '2000', true),
('ADESTOR', 'Standard Films', '191513', 'PP Pearl White C TC', 'HM-100', 'GW', null, '8447390002108', 'ADHPPPEARL', '2000', true),
('ADESTOR', 'Standard Films', '196421', 'PP Gloss White S TC', 'A-292F', 'GW', null, '8447390006854', 'ADHPPGLWH6', '2000', true),
('ADESTOR', 'Standard Films', '196422', 'PP Gloss Clear S TC', 'A-292F', 'GW', null, '8447390006861', 'ADHPPGLCL6', '2000', true),
('ADESTOR', 'Standard Films', '196429', 'PP Gloss Clear S TC', 'A-292F', 'PET30', null, '8447390006939', 'ADHPPGLCL6', null, true),
('ADESTOR', 'Standard Films', '195415', 'PP Matt White TC', 'A-292', 'GW62', null, '8447390006649', 'ADHPPMTWH6', null, true),
('ADESTOR', 'Standard Films', '195416', 'PP Gloss Silver TC', 'A-292', 'GW62', null, '8447390006656', 'ADHPPGLSIL', null, true),
('ADESTOR', 'Standard Films', '195414', 'PP Gloss Clear TC', 'A-292', 'PET30', null, '8447390006632', 'ADHPPGLCL5', null, true),
('ADESTOR', 'Standard Films', '196425', 'PE Gloss White TC', 'A-292F', 'GW', null, '8447390006892', 'ADHPEGLWH8', '2000', true),
('ADESTOR', 'Standard Films', '196426', 'PE Gloss Clear TC', 'A-292F', 'GW', null, '8447390006908', 'ADHPEGLCLB', '2000', true),
('ADESTOR', 'Standard Films', '196427', 'PE Gloss White TC100', 'A-292F', 'GW', null, '8447390006915', 'ADHPEGWT10', null, true),
('ADESTOR', 'Standard Films', '7262', 'PVC Gloss White', 'A-251', 'GW', null, '844739072620', 'ADHPVCBLAN', null, true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0362', 'CAST GLOSS PEFC', 'P1000', 'YG60', null, null, 'ALTO BRILLO BASE AMARILLA', '2000', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0108', 'COATED 80 FSC™', 'RF20', 'YG60', null, null, null, '2000', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0108', 'COATED 80 FSC™', 'RF20', 'YG60', null, null, 'REMOVIBLE BASE AMARILLA', '2000', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0060', 'COATED 80 FSC™', 'TT50 EXTREME', 'YG60', null, null, 'couche brillo - superficies rugosas - adherencia extrema', '1500', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0121', 'COATED 80 FSC™', 'TT50L', 'YG60', null, null, 'couche brillo - superficies planas  - adherencia fuerte', '1500', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0072', 'COATED 80 FSC™', 'RF20', 'WG62', null, null, 'REMOVIBLE BASE BLANCA', '0', true),
('FEDRIGONI', 'Coated Gloss White Papers', 'PCD0062', 'COATED 80 FSC™', 'ST5000', 'YG60', null, null, 'SUPER PERMANENTE - adherencia muyfuerte', '2000', true),
('FEDRIGONI', 'Wine & Beverage Products', 'WNE0138', 'FREELIFE MERIDA WHITE FSC™', 'SH6020 PLUS', 'WG80', null, null, 'RUGOSO TIPO TEJIDO', '0', true),
('FEDRIGONI', 'Standard Films', 'FLM0115', 'PP TC MATT WHITE 70', 'AP901', 'WG74', null, null, null, '1000', true),
('FEDRIGONI', 'Standard Films', 'FLM0115', 'PP TC MATT WHITE 70', 'AP901', 'WG74', null, null, 'POLIPROPILENO MATE', '2000', true),
('FEDRIGONI', 'Standard Films', 'FLM1355', 'PP TC8 GLOSS CLEAR 50', 'AP901', 'WG62', 0.67, null, 'POLIPROPILENO TRANSP - POLIPROPILENO ORIENTADO - - Más rígido y resistente al estiramiento. - MAS CALIDAD DE IMPRESIÓN - SUPERFICIE LISA', '0', true),
('FEDRIGONI', 'Standard Films', 'FLM1337', 'PP TC8 GLOSS WHITE CAV 60', 'AP901', 'WG62', null, null, null, '1500', true),
('FEDRIGONI', 'Standard Films', 'FLM1171', 'PP TCX GLOSS CLEAR 50', 'AP901', 'WG62', 0.67, null, null, '1500', true),
('FEDRIGONI', 'Standard Films', 'FLM1171', 'PP TCX GLOSS CLEAR 50', 'AP901', 'WG62', 0.67, null, 'POLIPROPILENO TRANSP - POLIPROPILENO EXTRUIDO - - Más FLEXIBLE y SUPERFICIES IRREGULARES. - MENOS CALIDAD DE IMPRESIÓN - SUPERFICIE RUGOSA', '2000', true),
('FEDRIGONI', 'Wine & Beverage Products', 'WNE0864', 'SUPERMATT WS FSC™', 'SH6020 PLUS', 'YG60', null, null, 'SUPERMATT - BASE AMARILLA', '1500', true),
('FEDRIGONI', 'Direct Thermal Papers', 'PDT0211', 'THERMAL TOP FSC™', 'P1000', 'YG60', null, null, 'PAPEL IMPRESIÓN TERMICA - MAQUINA ADMINISTRACION', '2000', true),
('FEDRIGONI', 'Uncoated Papers', 'PUN0101', 'VELLUM SC FSC™', 'RF20', 'YG60', null, null, null, '2000', true),
('FEDRIGONI', 'Uncoated Papers', 'PUN0101', 'VELLUM SC FSC™', 'RF20', 'YG60', null, null, 'TERMO - NO SE USA EN IMPRESIÓN DIGITAL - flexografia', '2000', true),
('FEDRIGONI', 'Wine & Beverage Products', 'WNE0463', 'WATERPROOF WHITE FSC™', 'SH6020 PLUS', 'WG80', null, null, null, '1000', true),
('FEDRIGONI', 'Wine & Beverage Products', 'WNE0463', 'WATERPROOF WHITE FSC™', 'SH6020 PLUS', 'WG80', null, null, 'WATERPROOF', '1000', true)
) as v(
  marca, categoria, item_number, face_name, adhesive, backing,
  price_m2, ean_code, notes, stock_dimensions, activo
)
where not exists (select 1 from public.prod_etiquetas_material_catalogo limit 1);
