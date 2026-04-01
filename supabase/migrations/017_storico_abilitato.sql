-- Migration 017: storico_abilitato per area
-- Permette all'admin di disabilitare l'importazione storico per singola area

ALTER TABLE areas ADD COLUMN storico_abilitato boolean NOT NULL DEFAULT true;
