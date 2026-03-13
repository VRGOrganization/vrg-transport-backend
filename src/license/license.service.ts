import { Injectable } from '@nestjs/common';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { StudentService } from 'src/student/student.service';



@Injectable()
export class LicenseService {
  constructor(
  ){
  }

  async create(createLicenseDto: CreateLicenseDto) {
    const response = await fetch(`${process.env.BASE_URL_API_LICENSE}/api/v1/license/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createLicenseDto)
    });

    if (!response.ok) {
      throw new Error(`Failed to create license: ${response.statusText}`);
    }

    try{
      
    }catch(error){
    }

  }

  findAll() {
    return `This action returns all license`;
  }

  findOne(id: number) {
    return `This action returns a #${id} license`;
  }

  update(id: number, updateLicenseDto: UpdateLicenseDto) {
    return `This action updates a #${id} license`;
  }

  remove(id: number) {
    return `This action removes a #${id} license`;
  }

  async checkHealth() {
    try {
      const res = await fetch("http://localhost:8000/health");
      const data = await res.json();
      console.log("Resposta:", data);
      return data;
    } catch (error) {
      return { status: 'error', message: 'License API is not healthy' };
    }
  }
}
