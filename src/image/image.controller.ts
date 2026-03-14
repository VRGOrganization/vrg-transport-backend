import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ImagesService } from './image.service';
import { CreateImageDto } from './create-image.dto';
import { UpdateImageDto } from './update-image.dto';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  create(@Body() createImageDto: CreateImageDto) {
    return this.imagesService.create(createImageDto);
  }

  @Get()
  findAll() {
    return this.imagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imagesService.findOne(id);
  }

  @Get('student/:studentId')
  findByStudentId(@Param('studentId') studentId: string) {
    return this.imagesService.findByStudentId(studentId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImageDto: UpdateImageDto) {
    return this.imagesService.update(id, updateImageDto);
  }

  @Patch('student/:studentId')
  updateByStudentId(
    @Param('studentId') studentId: string,
    @Body() updateImageDto: UpdateImageDto,
  ) {
    return this.imagesService.updateByStudentId(studentId, updateImageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imagesService.remove(id);
  }

  @Delete('student/:studentId')
  removeByStudentId(@Param('studentId') studentId: string) {
    return this.imagesService.removeByStudentId(studentId);
  }
}
