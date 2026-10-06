import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowPendingPasswordChange } from '../../common/decorators/allow-pending-password-change.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro público de atleta (o campo role é ignorado)' })
  @ApiResponse({ status: 201, description: 'Atleta registrado com sucesso.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário e obter token JWT' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @AllowPendingPasswordChange()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o perfil do usuário logado' })
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id);
  }

  @AllowPendingPasswordChange()
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trocar a senha (obrigatório no primeiro acesso de organizadores)' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
