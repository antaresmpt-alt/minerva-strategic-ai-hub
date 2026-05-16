insert into public.prod_etiquetas_material_catalogo (
  marca, categoria, item_number, face_name, adhesive, backing,
  price_m2, ean_code, notes, stock_dimensions, activo
)
select v.marca, v.categoria, v.item_number, v.face_name, v.adhesive, v.backing,
  v.price_m2, v.ean_code, v.notes, v.stock_dimensions, v.activo
from (values
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
);
