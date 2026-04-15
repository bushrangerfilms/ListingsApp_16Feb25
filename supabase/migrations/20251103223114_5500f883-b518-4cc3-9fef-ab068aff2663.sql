-- Add hero_photo column to store the main featured image separately from gallery photos
ALTER TABLE listings ADD COLUMN hero_photo text;