import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserRole } from '../enums/role.enum';

function maskCpf(cpf?: string): string {
  if (!cpf) return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  return '***.***.***-**';
}

function maskPhone(phone?: string): string {
  if (!phone) return '(**) *****-****';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const ddd = clean.slice(0, 2);
    const lastDigits = clean.slice(-4);
    return `(${ddd}) 9****-${lastDigits}`;
  }
  return '(**) *****-****';
}

function sanitizeData(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (typeof data === 'object') {
    const sanitized = { ...data };
    if ('cpf' in sanitized && sanitized.cpf) {
      sanitized.cpf = maskCpf(sanitized.cpf);
    }
    if ('phonenumber' in sanitized && sanitized.phonenumber) {
      sanitized.phonenumber = maskPhone(sanitized.phonenumber);
    }
    if ('athletes' in sanitized && Array.isArray(sanitized.athletes)) {
      sanitized.athletes = sanitized.athletes.map(a => sanitizeData(a));
    }
    return sanitized;
  }
  return data;
}

@Injectable()
export class LgpdMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const role = req?.user?.role;

    // Governança (SUPER_ADMIN, ORGANIZER) tem prerrogativa legal e operacional
    // de visualizar dados cadastrais completos (CPF, telefone, kit) para gestão do campeonato
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ORGANIZER || role === 'SUPER_ADMIN' || role === 'ORGANIZER') {
      return next.handle();
    }

    return next.handle().pipe(
      map(data => sanitizeData(data)),
    );
  }
}
