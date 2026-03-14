import { Inject, Injectable } from '@nestjs/common';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';



//REVISAR TODAS AS FUNCOES A FIM DE DIMINUIR CODIGO, COMPLEXIDADE E MELHORAR MANUTENIBILIDADE
@Injectable()
export class LicenseService {
  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
  ) {}

  async checkHealth() {
    try {
      const res = await fetch(`${process.env.BASE_URL_API_LICENSE}/health`);
      const data = await res.json();
      return data;
    } catch (error) {
      return { status: 'error', message: 'License API is not healthy' };
    }
  }

  async create(createLicenseDto: CreateLicenseDto) {
    try {
      const response = await fetch(
        `${process.env.BASE_URL_API_LICENSE}/api/v1/license/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': `${process.env.X_API_KEY}`,
          },
          body: JSON.stringify(createLicenseDto),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to create license: ${response.statusText}`);
      }

      const data = await response.json(); //esperar a resposta da APILicense e converter para JSON
      const currentDate = new Date(); //obter a data atual
      
      const dataLicense = {
        studentId: createLicenseDto.id,
        employeeId: createLicenseDto.employee_id,
        imageLicense: data.image,
        status: 'active',
        existing: true,
        expirationDate: addMonthsBR(nowInBR(), 7), //funcao do utils para corrigir timezone e adicionar 7 meses a data atual
      }

      const r = await this.licenseRepository.create(dataLicense);
      if(!r){
        throw new Error('Failed to save license in database');
      }
      return r;
    } catch (error) {
      console.error('Error creating license:', error);
      throw error;
    }
  }

  async getLicenseByStudentId(studentId: string) {
    try{
      const license = await this.licenseRepository.findOneByStudentId(studentId);
      if(!license){
        throw new Error('License not found for student ID: ' + studentId);
      }
      return license;
    }catch(error){
      console.error('Error finding license by student ID:', error);
      throw error;
    }
  }

  async getLicenseById(id: string) {
    try{
      const license = await this.licenseRepository.findOne(id);
      if(!license){
        throw new Error('License not found for ID: ' + id);
      }
      return license;
    }catch(error){
      console.error('Error finding license by ID:', error);
      throw error;
    }
  }

  async getAll() {
    try{
      const licenses = await this.licenseRepository.findAll();
      return licenses;
    }catch(error){
      console.error('Error retrieving all licenses:', error);
      throw error;
    }
  }

  async remove(id: string) {
    try{
      const result = await this.licenseRepository.remove(id);
      if(!result){
        throw new Error('Failed to remove license with ID: ' + id);
      } else {
        return true;
      }
    }catch(error){
      console.error('Error removing license:', error);
      throw error;
    }
  }

  async update(id: string, data: CreateLicenseDto){
    try{
      const result = await this.remove(id);
      if(!result){
        throw new Error('Failed to update license with ID: ' + id);
      }
      const nLicense = await this.create(data);
      if(!nLicense){
        throw new Error('Failed to create new license during update for ID: ' + id);
      }
      return nLicense;
    }catch(error){
      console.error('Error updating license:', error);
      throw error;
    }
  }
}