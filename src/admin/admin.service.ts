import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin, AdminDocument } from './schema/admin.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
  ) {}

  async findById(id: string): Promise<Admin | null> {
    return this.adminModel.findById(id).exec();
  }

  async findByUsername(username: string): Promise<Admin | null> {
    return this.adminModel.findOne({ username }).exec();
  }

  // Retorna o hash da senha — usado exclusivamente no loginAdmin para bcrypt.compare
  // Seleciona explicitamente os campos select:false necessários para auth
  async findByUsernameWithPassword(username: string): Promise<Admin | null> {
    return this.adminModel
      .findOne({ username })
      .select('+password +refreshTokenHash +refreshTokenVersion') // Inclui o campo de senha e tokens, que são excluídos por padrão
      .exec();
  }

  async findOneOrFail(id: string): Promise<Admin> {
    const admin = await this.adminModel.findById(id).exec();
    if (!admin) {
      throw new NotFoundException(`Admin ${id} não encontrado`);
    }
    return admin;
  }

  // Persiste hash e versão do refresh token para validação futura
  async updateRefreshToken(
    id: string,
    hash: string,
    version: number,
  ): Promise<void> {
    await this.adminModel
      .findByIdAndUpdate(
        id,
        { refreshTokenHash: hash, refreshTokenVersion: version },
        { new: true },
      )
      .exec();
  }

  // Usa Date.now() para garantir que qualquer token anterior seja invalidado, mesmo que o hash seja limpo
  async clearRefreshToken(id: string): Promise<void> {
    await this.adminModel
      .findByIdAndUpdate(
        id,
        { refreshTokenHash: null, refreshTokenVersion: Date.now() }, // Invalida tokens antigos ao limpar
        { new: true },
      )
      .exec();
  }
}
