-- Állapotfelmérés kikerül az ingatlan ajánlásokból.

DELETE FROM partner_services WHERE category_id = 'allapotfelmeres';
DELETE FROM service_categories WHERE id = 'allapotfelmeres';
