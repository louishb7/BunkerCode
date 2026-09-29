ALTER TABLE checkpoints ADD COLUMN kind TEXT NOT NULL DEFAULT 'user';
UPDATE checkpoints SET kind = 'backup' WHERE message LIKE 'Antes de restaurar:%' OR message = 'Antes de adicionar a surface';
UPDATE checkpoints SET kind = 'restore' WHERE message LIKE 'Restaurado:%';
UPDATE checkpoints SET kind = 'system' WHERE message = 'Surface do sistema' OR message = 'Base do OrderDesk';
