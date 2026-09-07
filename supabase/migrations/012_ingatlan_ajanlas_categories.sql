-- Ingatlan ajánlás szolgáltatói kategóriák + hiányzó autó kategória (autoátvizsgálás).

INSERT INTO service_categories (id, label, sort_order) VALUES
  ('autoatvizsgalas', 'Autoátvizsgálás', 4),
  ('ertekesites', 'Értékesítés', 20),
  ('ertekbecsles', 'Értékbecslés', 21),
  ('allapotfelmeres', 'Állapotfelmérés', 22),
  ('energetikai_tanusitvany', 'Energetikai tanúsítvány', 23),
  ('szerkezeti_vizsgalat', 'Szerkezeti vizsgálat', 24),
  ('hitelugyintezes', 'Hitelügyintézés', 25),
  ('foldmeres', 'Földmérés', 26),
  ('tervezok', 'Tervezők', 27),
  ('lakberendezo', 'Lakberendező', 28),
  ('kertepito', 'Kertépítő', 29),
  ('ugyvedek', 'Ügyvédek', 30),
  ('kozjegyzok', 'Közjegyzők', 31)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- Autó kategóriák sort_order igazítása az új listához
UPDATE service_categories SET sort_order = 5, label = 'Autószerelő' WHERE id = 'autoszerelo';
UPDATE service_categories SET sort_order = 6, label = 'Gumiszerelő' WHERE id = 'gumiszerelo';
UPDATE service_categories SET sort_order = 7, label = 'Lakatos' WHERE id = 'lakatos';
UPDATE service_categories SET sort_order = 8, label = 'Klímaszerelő' WHERE id = 'klimaszerelo';
UPDATE service_categories SET sort_order = 9, label = 'Autókozmetika' WHERE id = 'autokozmetika';
UPDATE service_categories SET sort_order = 10, label = 'Autóvillamosság' WHERE id = 'autovillamossag';
