-- Eltávolított hirdetésfeladási mezők (cellák + meződefiníciók).
-- A listings wide oszlopokat nem érinti.

DELETE FROM listing_cells
WHERE field_key IN (
  'okmany_ervenyesseg',
  'kornyezetvedelmi',
  'co2_kibocsatas',
  'henger_elrendezes',
  'belso_azonosito',
  'hatso_nyari_szelesseg',
  'hatso_nyari_magassag',
  'hatso_nyari_atmero',
  'hatso_nyari_kulon',
  'hatso_teli_szelesseg',
  'hatso_teli_magassag',
  'hatso_teli_atmero',
  'hatso_teli_kulon',
  'tipus_katalogus'
);

DELETE FROM field_defs
WHERE field_key IN (
  'okmany_ervenyesseg',
  'kornyezetvedelmi',
  'co2_kibocsatas',
  'henger_elrendezes',
  'belso_azonosito',
  'hatso_nyari_szelesseg',
  'hatso_nyari_magassag',
  'hatso_nyari_atmero',
  'hatso_nyari_kulon',
  'hatso_teli_szelesseg',
  'hatso_teli_magassag',
  'hatso_teli_atmero',
  'hatso_teli_kulon',
  'tipus_katalogus'
);
