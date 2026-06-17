/**
 * @file src/features/users/users.controller.ts
 *
 * CHANGE: l'upload d'avatar passe par usersService.replaceAvatar() au lieu de
 * updateUser(), pour que l'ancien fichier local soit supprimé du disque et que
 * avatarSource soit marqué LOCAL (l'upload manuel devient prioritaire sur une
 * éventuelle synchro Google).
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AvatarSource } from '../../generated/prisma/client.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './services/users.service.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAllUsers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findUserById({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser({ id }, dto);
  }

  @Patch(':id/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<UserResponseDto> {
    return this.usersService.changePassword({ id }, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.deleteUser({ id });
  }

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(
            new Error('Seuls les formats JPG, JPEG et PNG sont acceptés'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    // Génère une URL absolue pour que le frontend Zod (z.url()) l'accepte
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`;

    // replaceAvatar() supprime l'ancien fichier local (s'il y en avait un) et
    // marque avatarSource=LOCAL : l'upload manuel devient prioritaire sur la
    // synchro Google pour ce compte, même s'il s'est inscrit via Google.
    return this.usersService.replaceAvatar(id, avatarUrl, AvatarSource.LOCAL);
  }
}
