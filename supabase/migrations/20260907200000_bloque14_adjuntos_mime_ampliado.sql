-- Bloque 14: ampliar MIME de adjuntos (mismos formatos foto + troquel).

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/bmp',
  'image/x-ms-bmp',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/tif'
]
where id = 'referencias-adjuntos';
