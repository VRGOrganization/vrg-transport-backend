import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './image.controller';
import { ImagesService } from './image.service';
import { Image, ImageSchema } from './image.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Image.name, schema: ImageSchema }],
      'images',
    ),
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
