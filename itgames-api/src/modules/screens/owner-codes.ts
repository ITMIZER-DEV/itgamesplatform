import { UserRole } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { effectiveGameCodes } from './screens-logic';

type Db = Pick<PrismaService, 'user' | 'game' | 'gameOrganizer'>;

// Campeonatos que o telão de fato exibe, calculados com o DONO ATUAL (nunca com quem age):
// dono super admin vê tudo; organizador só vínculos ativos; campeonato bloqueado ou inexistente fica de fora.
export async function effectiveCodesForOwner(
  db: Db,
  ownerId: string | null,
  configured: string[],
): Promise<string[]> {
  if (!ownerId || !configured.length) return [];
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { role: true } });
  if (!owner) return [];
  const games = await db.game.findMany({
    where: { code: { in: configured } },
    select: { code: true, status: true },
  });
  const existing = new Set(games.map((g) => g.code));
  const blocked = new Set(games.filter((g) => g.status === 'blocked').map((g) => g.code));
  let manageable: Set<string> | 'all';
  if (owner.role === UserRole.SUPER_ADMIN) {
    manageable = 'all';
  } else if (owner.role === UserRole.ORGANIZER) {
    const links = await db.gameOrganizer.findMany({
      where: { userId: ownerId, active: true, gameCode: { in: configured } },
      select: { gameCode: true },
    });
    manageable = new Set(links.map((l) => l.gameCode));
  } else {
    return [];
  }
  return effectiveGameCodes(
    configured.filter((c) => existing.has(c)),
    manageable,
    blocked,
  );
}
