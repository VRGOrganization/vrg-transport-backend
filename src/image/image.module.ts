import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './image.controller';
import { ImagesService } from './image.service';
import { ImageRepository } from './image.repository';
import { Image, ImageSchema } from './schema/image.schema';
import {
  ImageHistory,
  ImageHistorySchema,
} from './schema/image-history.schema';
import { IMAGE_REPOSITORY } from './interface/repository.interface';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [
        { name: Image.name, schema: ImageSchema },
        { name: ImageHistory.name, schema: ImageHistorySchema },
      ],
      'images', // usa a conexão secundária declarada no AppModule
    ),
  ],
  controllers: [ImagesController],
  providers: [
    ImagesService,
    {
      provide: IMAGE_REPOSITORY,
      useClass: ImageRepository,
    },
  ],
  exports: [ImagesService, MongooseModule],
})
export class ImagesModule {}