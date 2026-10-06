import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Autenticação opcional: com Bearer válido, request.user é preenchido;
      // sem token ou com token inválido/expirado, segue como visitante.
      try {
        await super.canActivate(context);
      } catch {
        // visitante anônimo
      }
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
