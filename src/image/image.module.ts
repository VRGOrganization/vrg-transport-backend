import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './image.controller';
import { ImagesService } from './image.service';
import { Image, ImageSchema } from './schema/image.schema';
import {
  ImageHistory,
  ImageHistorySchema,
} from './schema/image-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Image.name, schema: ImageSchema },
        { name: ImageHistory.name, schema: ImageHistorySchema },
      ],
      'images', // usa a conexão secundária declarada no AppModule
    ),
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService, MongooseModule],
})
export class ImagesModule {}