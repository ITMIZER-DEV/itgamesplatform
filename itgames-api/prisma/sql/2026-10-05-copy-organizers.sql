-- Copia o organizador único atual de cada campeonato para a tabela de vínculo.
INSERT INTO games_organizers ("gameCode", "userId")
SELECT "code", "organizerId"
FROM games
WHERE "organizerId" IS NOT NULL
ON CONFLICT DO NOTHING;
