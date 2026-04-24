import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import {
  AddBusRouteDestinationDto,
  CreateBusRouteDto,
  UpdateBusRouteDto,
} from './dto/bus-route.dto';
import {
  BUS_ROUTE_REPOSITORY,
  type IBusRouteRepository,
} from './interface/repository.interface';
import { BusRoute, type BusRouteDestination } from './schema/bus-route.schema';

@Injectable()
export class BusRouteService {
  constructor(
    @Inject(BUS_ROUTE_REPOSITORY)
    private readonly repository: IBusRouteRepository<BusRoute>,
    private readonly auditLog: AuditLogService,
  ) {}

  private normalizeLineNumber(lineNumber: string): string {
    return lineNumber.trim().toLowerCase();
  }

  private normalizeDestinationName(name: string): string {
    return name.trim().toLowerCase();
  }

  private normalizeDestinations(
    destinations: Array<{ name: string; active?: boolean }>,
  ): BusRouteDestination[] {
    if (!Array.isArray(destinations) || destinations.length === 0) {
      throw new BadRequestException('Informe ao menos um destino ativo para a rota.');
    }

    const seen = new Set<string>();
    const normalized = destinations.map((destination) => {
      const name = destination.name?.trim();
      if (!name) {
        throw new BadRequestException('Destino inválido.');
      }

      const nameNormalized = this.normalizeDestinationName(name);
      if (seen.has(nameNormalized)) {
        throw new ConflictException('Não é permitido duplicar destinos na mesma rota.');
      }
      seen.add(nameNormalized);

      return {
        name,
        nameNormalized,
        active: destination.active !== false,
      };
    });

    if (!normalized.some((destination) => destination.active)) {
      throw new BadRequestException('A rota deve ter pelo menos 1 destino ativo.');
    }

    return normalized;
  }

  async create(dto: CreateBusRouteDto, adminId: string): Promise<BusRoute> {
    const lineNumberNormalized = this.normalizeLineNumber(dto.lineNumber);
    const existing = await this.repository.findByLineNumberNormalized(
      lineNumberNormalized,
    );

    if (existing) {
      throw new ConflictException('Já existe uma rota ativa com esse número.');
    }

    const created = await this.repository.create({
      lineNumber: dto.lineNumber.trim(),
      lineNumberNormalized,
      destinations: this.normalizeDestinations(dto.destinations),
    });

    await this.auditLog.record({
      action: 'bus_route.create',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busRouteId: (created as any)._id?.toString?.() },
    });

    return created;
  }

  async findAll(): Promise<BusRoute[]> {
    return this.repository.findAll();
  }

  async findAllInactive(): Promise<BusRoute[]> {
    return this.repository.findAllInactive();
  }

  async findOneOrFail(id: string): Promise<BusRoute> {
    const route = await this.repository.findById(id);
    if (!route) {
      throw new NotFoundException('Rota de ônibus não encontrada.');
    }
    return route;
  }

  async update(
    id: string,
    dto: UpdateBusRouteDto,
    adminId: string,
  ): Promise<BusRoute> {
    const current = await this.findOneOrFail(id);

    const nextLineNumber = dto.lineNumber?.trim();
    if (nextLineNumber) {
      const normalized = this.normalizeLineNumber(nextLineNumber);
      const existing = await this.repository.findByLineNumberNormalized(normalized);
      if (existing && (existing as any)._id?.toString?.() !== id) {
        throw new ConflictException('Já existe uma rota ativa com esse número.');
      }
    }

    const updated = await this.repository.update(id, {
      ...(nextLineNumber !== undefined ? { lineNumber: nextLineNumber } : {}),
      ...(nextLineNumber !== undefined
        ? { lineNumberNormalized: this.normalizeLineNumber(nextLineNumber) }
        : {}),
      ...(dto.destinations !== undefined
        ? { destinations: this.normalizeDestinations(dto.destinations) }
        : {}),
    });

    if (!updated) {
      throw new NotFoundException('Rota de ônibus não encontrada.');
    }

    await this.auditLog.record({
      action: 'bus_route.update',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busRouteId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  async addDestination(
    id: string,
    dto: AddBusRouteDestinationDto,
    adminId: string,
  ): Promise<BusRoute> {
    const route = await this.findOneOrFail(id);
    if (!route.active) {
      throw new BadRequestException('Não é possível alterar uma rota inativa.');
    }

    const name = dto.name.trim();
    const nameNormalized = this.normalizeDestinationName(name);
    const destinations = [...(route.destinations || [])];
    if (destinations.some((destination) => destination.nameNormalized === nameNormalized && destination.active)) {
      throw new ConflictException('Já existe um destino ativo com esse nome.');
    }

    destinations.push({ name, nameNormalized, active: true });

    const updated = await this.repository.update(id, { destinations });
    if (!updated) {
      throw new NotFoundException('Rota de ônibus não encontrada.');
    }

    await this.auditLog.record({
      action: 'bus_route.add_destination',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busRouteId: id },
      metadata: { destination: name },
    });

    return updated;
  }

  async removeDestination(
    id: string,
    destinationName: string,
    adminId: string,
  ): Promise<BusRoute> {
    const route = await this.findOneOrFail(id);
    const nameNormalized = this.normalizeDestinationName(destinationName);
    let found = false;

    const destinations = (route.destinations || []).map((destination) => {
      if (destination.nameNormalized !== nameNormalized) {
        return destination;
      }

      found = true;
      return {
        ...destination,
        active: false,
      };
    });

    if (!found) {
      throw new NotFoundException('Destino não encontrado.');
    }

    if (!destinations.some((destination) => destination.active)) {
      throw new BadRequestException('A rota deve ter pelo menos 1 destino ativo.');
    }

    const updated = await this.repository.update(id, { destinations });
    if (!updated) {
      throw new NotFoundException('Rota de ônibus não encontrada.');
    }

    await this.auditLog.record({
      action: 'bus_route.remove_destination',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busRouteId: id },
      metadata: { destination: destinationName },
    });

    return updated;
  }

  async deactivate(id: string, adminId: string): Promise<{ message: string }> {
    await this.findOneOrFail(id);

    const result = await this.repository.deactivate(id);
    if (!result) {
      throw new NotFoundException('Rota de ônibus não encontrada.');
    }

    await this.auditLog.record({
      action: 'bus_route.deactivate',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busRouteId: id },
    });

    return { message: 'Rota de ônibus desativada com sucesso.' };
  }
}
