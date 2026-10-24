-- Busca de produtos por ILIKE '%termo%' usa índice GIN de trigramas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
