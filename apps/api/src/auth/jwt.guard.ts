import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export type AuthUser = {
  id: string;
  email: string;
  role: 'PLAYER' | 'HOST' | 'ADMIN';
  emailVerified: boolean;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const user = await resolveAuthUser(context, this.jwt, this.prisma, true);
    context.switchToHttp().getRequest().user = user;
    return true;
  }
}

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const user = await resolveAuthUser(context, this.jwt, this.prisma, false);
    context.switchToHttp().getRequest().user = user;
    return true;
  }
}

export async function userFromToken(
  token: string | undefined,
  jwt: JwtService,
  prisma: PrismaService,
): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify<{ sub: string }>(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  } catch {
    return null;
  }
}

async function resolveAuthUser(
  context: ExecutionContext,
  jwt: JwtService,
  prisma: PrismaService,
  required: boolean,
) {
  const req = context.switchToHttp().getRequest();
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  const user = await userFromToken(token, jwt, prisma);
  if (!user && required) {
    throw new UnauthorizedException('Нужно войти');
  }
  return user;
}
