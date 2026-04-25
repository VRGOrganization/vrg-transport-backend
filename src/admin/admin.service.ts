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
      .select('+password')
      .exec();
  }

  async findOneOrFail(id: string): Promise<Admin> {
    const admin = await this.adminModel.findById(id).exec();
    if (!admin) {
      throw new NotFoundException(`Admin ${id} não encontrado`);
    }
    return admin;
  }

}
