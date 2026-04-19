import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Image, ImageDocument } from './schema/image.schema';
import {
	ImageHistory,
	ImageHistoryDocument,
} from './schema/image-history.schema';
import { IImageRepository } from './interface/repository.interface';
import { PhotoType } from './types/photoType.enum';

@Injectable()
export class ImageRepository implements IImageRepository {
	constructor(
		@InjectModel(Image.name, 'images')
		private readonly imageModel: Model<ImageDocument>,
		@InjectModel(ImageHistory.name, 'images')
		private readonly imageHistoryModel: Model<ImageHistoryDocument>,
	) {}

	async create(data: Partial<Image>, session?: ClientSession): Promise<Image> {
		const image = new this.imageModel(data);
		return image.save({ session });
	}

	async findOneByFilter(
		filter: Partial<Image> & { _id?: string },
	): Promise<Image | null> {
		return this.imageModel.findOne(filter).exec();
	}

	async findOneByStudentAndPhotoType(
		studentId: string,
		photoType: PhotoType,
	): Promise<Image | null> {
		return this.imageModel.findOne({ studentId, photoType }).exec();
	}

	async findAllActive(): Promise<Image[]> {
		return this.imageModel.find({ active: true }).exec();
	}

	async findAllPaginatedActive(
		page: number,
		limit: number,
	): Promise<{ data: Image[]; total: number; page: number; limit: number }> {
		const filter = { active: true };
		const skip = (page - 1) * limit;

		const [data, total] = await Promise.all([
			this.imageModel.find(filter).skip(skip).limit(limit).exec(),
			this.imageModel.countDocuments(filter).exec(),
		]);

		return { data, total, page, limit };
	}

	async findById(id: string): Promise<Image | null> {
		return this.imageModel.findById(id).exec();
	}

	async findByStudentIdActive(studentId: string): Promise<Image[]> {
		return this.imageModel.find({ studentId, active: true }).exec();
	}

	async findProfilePhotoActive(studentId: string): Promise<Image | null> {
		return this.imageModel
			.findOne({ studentId, photoType: PhotoType.ProfilePhoto, active: true })
			.exec();
	}

	async updateById(id: string, data: Partial<Image>, session?: ClientSession): Promise<Image | null> {
		return this.imageModel
			.findByIdAndUpdate(
				id,
				{ $set: data },
				{
					returnDocument: 'after',
					runValidators: true,
					context: 'query',
          session,
				},
			)
			.exec();
	}

	async updateProfilePhotoByStudentId(
		studentId: string,
		data: Partial<Image>,
    session?: ClientSession,
	): Promise<Image | null> {
		return this.imageModel
			.findOneAndUpdate(
				{ studentId, photoType: PhotoType.ProfilePhoto, active: true },
				{ $set: data },
				{
					returnDocument: 'after',
					runValidators: true,
					context: 'query',
          session,
				},
			)
			.exec();
	}

	async softDeleteById(id: string): Promise<boolean> {
		const result = await this.imageModel
			.findByIdAndUpdate(
				id,
				{ $set: { active: false } },
				{ returnDocument: 'after', runValidators: true },
			)
			.exec();

		return !!result;
	}

	async softDeleteByStudentId(studentId: string): Promise<number> {
		const result = await this.imageModel
			.updateMany({ studentId }, { $set: { active: false } })
			.exec();

		return result.modifiedCount;
	}

	async archiveImageToHistory(image: Image): Promise<void> {
		const imageId =
			(image as { _id?: { toString: () => string } })._id?.toString() ?? '';

		const history = new this.imageHistoryModel({
			studentId: image.studentId,
			imageId,
			photoType: image.photoType,
			photo3x4: image.photo3x4,
			documentImage: image.documentImage,
			replacedAt: new Date(),
		});

		await history.save();
	}
}

