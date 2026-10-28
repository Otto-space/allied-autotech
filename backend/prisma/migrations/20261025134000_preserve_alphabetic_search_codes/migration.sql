-- Preserve alphabetic identifier punctuation too. Natural names expose both their
-- recorded hyphenated token and ordinary words; query code suffixes stay exact.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE OR REPLACE FUNCTION aat_search_words(value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE found TEXT[]; word TEXT; result TEXT := ' '; source TEXT;
BEGIN
  source := regexp_replace(aat_search_normalize(value), '\mmotor[[:space:]]+oil\M', 'engine oil', 'g');
  FOR found IN SELECT regexp_matches(source, '([[:alnum:]]+([._/-][[:alnum:]]+)*)', 'g') LOOP
    word := found[1];
    IF word ~ '^(0|5|10|15|20|25)w-?(8|12|16|20|30|40|50|60)$' THEN
      word := replace(word, '-', '');
    ELSIF word !~ '[0-9]' AND word ~ '[._/-]' THEN
      word := word || ' ' || regexp_replace(word, '[._/-]+', ' ', 'g');
    END IF;
    result := result || word || ' ';
  END LOOP;
  RETURN result;
END;
$$;
UPDATE "Product" SET "searchCore" = "searchCore";
UPDATE "VehicleListing" SET "searchCore" = "searchCore";
COMMIT;
