-- Fix quiz_path values in quiz_type_definitions
-- Previously stored full paths like '/lead-magnet/{orgSlug}/ready-to-sell'
-- which caused double-path bugs in URL construction.
-- Now stores just the slug: 'ready-to-sell', 'worth-estimate'

UPDATE quiz_type_definitions
SET quiz_path = 'ready-to-sell'
WHERE type_key = 'ready-to-sell' AND quiz_path != 'ready-to-sell';

UPDATE quiz_type_definitions
SET quiz_path = 'worth-estimate'
WHERE type_key = 'worth-estimate' AND quiz_path != 'worth-estimate';
