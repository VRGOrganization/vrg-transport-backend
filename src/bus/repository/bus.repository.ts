import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Bus, BusDocument } from '../schema/bus.schema';
import { IBusRepository } from '../interface/repository.interface';

@Injectable()
export class BusRepository implements IBusRepository<Bus> {
  constructor(
    @InjectModel(Bus.name)
    private readonly busModel: Model<BusDocument>,
  ) {}

  async create(data: Partial<Bus>): Promise<Bus> {
    const bus = new this.busModel(data);
    return bus.save();
  }


  async findAll(): Promise<Bus[]> {
    return this.busModel.find().exec();
  }


  async findAllInactive(): Promise<Bus[]> {
    return this.busModel.find({ active: false }).exec();
  }


  async findById(id: string): Promise<Bus | null> {
    return this.busModel.findById(id).exec();
  }

  async findByIdentifier(identifier: string): Promise<Bus | null> {
    return this.busModel.findOne({ identifier: identifier.trim() }).exec();
  }


  async update(id: string, data: Partial<Bus>): Promise<Bus | null> {
    return this.busModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }


  // Métodos removidos: addUniversity, removeUniversity
  async findAllActive(): Promise<Bus[]> {
    return this.busModel.find({ active: true }).exec();
  }

  // Retorna todos os ônibus ativos que contenham a universidade (lógica de prioridade fica no service)
  async findByUniversityId(universityId: string): Promise<Bus[]> {
    return this.busModel.find({ active: true, 'universitySlots.universityId': new Types.ObjectId(universityId) }).exec();
  }

  async incrementUniversityFilledSlots(busId: string, universityId: string, session?: ClientSession): Promise<void> {
    // Load bus document in session (if provided) and perform guarded increment
    const bus = await this.busModel.findById(busId).session(session ?? null).exec();
    if (!bus) throw new Error('Ônibus não encontrado');

    const slot = (bus as any).universitySlots.find((s: any) => s.universityId?.toString() === universityId);
    if (!slot) throw new Error('Universidade não está nos slots do ônibus');

    const currentTotal = (bus as any).universitySlots.reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0);
    const capacity = (bus as any).capacity;

    if (capacity != null && currentTotal >= capacity) {
      throw new Error('Capacidade do ônibus atingida');
    }

    // Increment the slot and save within session
    slot.filledSlots = (slot.filledSlots || 0) + 1;
    await bus.save({ session });
  }

  async decrementUniversityFilledSlots(busId: string, universityId: string, session?: ClientSession): Promise<void> {
    const result = await this.busModel.updateOne(
      {
        _id: busId,
        'universitySlots.universityId': new Types.ObjectId(universityId),
      },
      { $inc: { 'universitySlots.$.filledSlots': -1 } },
      { session },
    ).exec();

    if (!result || (result as any).modifiedCount === 0) {
      // If nothing was modified, try to set to zero to avoid negative values
      const bus = await this.busModel.findById(busId).session(session ?? null).exec();
      if (!bus) throw new Error('Ônibus não encontrado');
      const slot = (bus as any).universitySlots.find((s: any) => s.universityId?.toString() === universityId);
      if (!slot) throw new Error('Universidade não está nos slots do ônibus');
      slot.filledSlots = Math.max((slot.filledSlots || 0) - 1, 0);
      await bus.save({ session });
    }
  }

  async resetAllFilledSlots(): Promise<void> {
    const buses = await this.busModel.find({ active: true }).exec();
    for (const bus of buses) {
      let changed = false;
      for (const slot of bus.universitySlots) {
        if (slot.filledSlots !== 0) {
          slot.filledSlots = 0;
          changed = true;
        }
      }
      if (changed) await bus.save();
    }
  }

  async resetUniversityFilledSlots(busId: string, session?: ClientSession): Promise<number> {
    const bus = await this.busModel.findById(busId).session(session ?? null).exec();
    if (!bus) throw new Error('Ônibus não encontrado');

    let released = 0;
    let changed = false;
    for (const slot of (bus as any).universitySlots || []) {
      const amount = slot.filledSlots || 0;
      if (amount > 0) {
        released += amount;
        slot.filledSlots = 0;
        changed = true;
      }
    }

    if (changed) {
      await bus.save({ session });
    }

    return released;
  }

  // Retorna informações básicas com contagens mínimas. Contagens de requests devem
  // idealmente vir de um aggregation em LicenseRequestRepository/Service.
  async findAllWithQueueCounts(): Promise<any[]> {
    const buses = await this.findAllActive();
    return buses.map(bus => {
      const filledSlotsTotal = (bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0);
      return {
        _id: (bus as any)._id?.toString?.(),
        identifier: (bus as any).identifier,
        capacity: (bus as any).capacity,
        filledSlotsTotal,
        availableSlots: (bus as any).capacity == null ? null : Math.max((bus as any).capacity - filledSlotsTotal, 0),
        pendingCount: 0,
        waitlistedCount: 0,
        universitySlots: (bus.universitySlots || []).map((s: any) => ({
          universityId: s.universityId?.toString?.(),
          priorityOrder: s.priorityOrder,
          filledSlots: s.filledSlots || 0,
          pendingCount: 0,
          waitlistedCount: 0,
        })),
      };
    });
  }

  async deactivate(id: string): Promise<boolean> {
    const result = await this.busModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .exec();
    return !!result;
  }
}