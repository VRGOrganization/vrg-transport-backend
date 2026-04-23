import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { ClientSession } from 'mongoose';
import { AuditLogService } from '../common/audit/audit-log.service';
import { EnrollmentPeriodService } from '../enrollment-period/enrollment-period.service';
import { LicenseService } from '../license/license.service';
import { MailService } from '../mail/mail.service';
import { StudentService } from '../student/student.service';
import { LICENSE_REQUEST_REPOSITORY } from './interfaces/repository.interface';
import type { ILicenseRequestRepository } from './interfaces/repository.interface';
import {
  LicenseRequest,
  LicenseRequestStatus,
  LicenseRequestType,
} from './schemas/license-request.schema';
import { ApproveLicenseRequestDto } from './dto/license-request.dto';
import { SubmitLicenseRequestFormDto } from '../student/dto/student.dto';
import { PhotoType } from '../image/types/photoType.enum';
import { ImagesService } from '../image/image.service';
import { Types } from 'mongoose';
import { BusService } from '../bus/bus.service';
import { Shift } from '../common/interfaces/student-attributes.enum';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class LicenseRequestService {
  private readonly logger = new Logger(LicenseRequestService.name);

  constructor(
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly repository: ILicenseRequestRepository<LicenseRequest>,
    @Inject(forwardRef(() => EnrollmentPeriodService))
    private readonly enrollmentPeriodService: EnrollmentPeriodService,
    private readonly studentService: StudentService,
    private readonly busService: BusService,
    private readonly licenseService: LicenseService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  private createRequestRecord(data: any, session?: ClientSession) {
    return session ? this.repository.create(data, session) : this.repository.create(data);
  }

  private toStringId(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return (value as { toString?: () => string }).toString?.() ?? null;
  }

  private buildCardNote(
    studentShift: Shift,
    accessBusIdentifiers: string[],
  ): string | null {
    const shiftLabel = studentShift ?? Shift.MORNING;
    const busList = accessBusIdentifiers.length > 0 ? accessBusIdentifiers.join(', ') : 'não definido';

    if (studentShift === Shift.FULL_TIME) {
      return `Aluno integral. Elegível para os ônibus da faculdade: ${busList}.`;
    }

    return `Aluno do turno ${shiftLabel}. Elegível para os ônibus da faculdade: ${busList}.`;
  }

  private async resolveBusContextForRequest(student: any): Promise<{
    universityId: string;
    busCandidates: any[];
    accessBusIdentifiers: string[];
    cardNote: string | null;
  }> {
    const universityId = this.toStringId(student?.universityId);
    if (!universityId) {
      throw new BadRequestException('Cadastre sua instituição antes de se inscrever.');
    }

    const studentShift = student?.shift as Shift | undefined;
    const busCandidates = await this.busService.findAllByUniversityId(universityId);
    if (!busCandidates || busCandidates.length === 0) {
      throw new BadRequestException('Nenhum ônibus disponível para sua instituição.');
    }
    const accessBusIdentifiers = busCandidates
      .map((bus: any) => bus.identifier)
      .filter((identifier: unknown): identifier is string => typeof identifier === 'string' && identifier.length > 0);

    return {
      universityId,
      busCandidates,
      accessBusIdentifiers,
      cardNote: this.buildCardNote(studentShift ?? Shift.MORNING, accessBusIdentifiers),
    };
  }

  private async resolveCardContextForApproval(request: any): Promise<{
    cardNote: string | null;
    accessBusIdentifiers: string[];
  }> {
    if (
      request?.cardNote ||
      (Array.isArray(request?.accessBusIdentifiers) && request.accessBusIdentifiers.length > 0)
    ) {
      return {
        cardNote: request.cardNote ?? null,
        accessBusIdentifiers: request.accessBusIdentifiers ?? [],
      };
    }

    return {
      cardNote: null,
      accessBusIdentifiers: [],
    };
  }

  private async resolveApprovedBus(busInput: string): Promise<{ _id: unknown; identifier?: string | null }> {
    const byIdentifier = await this.busService.findByIdentifier(busInput);
    if (byIdentifier) {
      return byIdentifier as any;
    }

    return this.busService.findOneOrFail(busInput) as any;
  }

  // Verifica elegibilidade e retorna o período de inscrição ativo (quando aplicável)
  async assertInitialRequestEligibility(studentId: string): Promise<any> {
    const requests = await this.repository.findByStudentId(studentId);
    const existingPendingOrWaitlistedInitial = requests.find(
      (request) =>
        (request.status === LicenseRequestStatus.PENDING ||
          request.status === LicenseRequestStatus.WAITLISTED) &&
        request.type === LicenseRequestType.INITIAL,
    );

    if (existingPendingOrWaitlistedInitial) {
      throw new BadRequestException(
        'Você já possui uma solicitação em andamento. Aguarde a análise antes de enviar uma nova.',
      );
    }

    const activePeriod = await this.enrollmentPeriodService.getActive();

    if (!activePeriod) {
      throw new BadRequestException(
        'Inscrições encerradas. Aguarde a abertura de um novo período.',
      );
    }

    this.assertPeriodWindow(activePeriod.startDate, activePeriod.endDate);

    return activePeriod;
  }

  async createRequest(
    studentId: string,
    activePeriodParam?: any,
    session?: ClientSession,
  ): Promise<LicenseRequest> {
    // If caller provided the active period (to avoid duplicate checks), reuse it;
    // otherwise run the eligibility check which returns the active period.
    const activePeriod = activePeriodParam ?? (await this.assertInitialRequestEligibility(studentId));

    const enrollmentPeriodId = (activePeriod as any)._id?.toString?.();
    if (!enrollmentPeriodId) {
      throw new BadRequestException('Per?odo de inscri??o inv?lido.');
    }

    const student = await this.studentService.findOneOrFail(studentId);
    const busContext = await this.resolveBusContextForRequest(student);
    const universityIdForRequest = busContext.universityId;
    const busCandidates = busContext.busCandidates;
    const universityObjectId = new Types.ObjectId(universityIdForRequest);

    const baseRequestData = {
      studentId,
      type: LicenseRequestType.INITIAL,
      rejectionReason: null,
      cancellationReason: null,
      rejectedAt: null,
      approvedByEmployeeId: null,
      rejectedByEmployeeId: null,
      licenseId: null,
      pendingImages: [] as any[],
      changedDocuments: [] as any[],
      enrollmentPeriodId,
      busId: null,
      universityId: universityObjectId,
      cardNote: busContext.cardNote,
      accessBusIdentifiers: busContext.accessBusIdentifiers,
    };

    const studentSlotForBus = (bus: any) =>
      ((bus as any).universitySlots || []).find((s: any) =>
        (s.universityId && s.universityId.toString ? s.universityId.toString() : s.universityId) ===
        universityIdForRequest,
      );

    const busIsAvailable = async (bus: any): Promise<boolean> => {
      const studentSlot = studentSlotForBus(bus);
      if (!studentSlot) {
        return false;
      }

      const higherPrioritySlots = ((bus as any).universitySlots || []).filter(
        (s: any) => (s.priorityOrder || 0) < (studentSlot.priorityOrder || 0),
      );

      for (const slot of higherPrioritySlots) {
        const uniIdStr = slot.universityId && slot.universityId.toString ? slot.universityId.toString() : slot.universityId;
        const hasDemand = await this.repository.hasActiveDemandForBusAndUniversity(
          (bus as any).identifier,
          typeof uniIdStr === 'string' ? uniIdStr : uniIdStr?.toString?.(),
        );
        if (hasDemand) {
          return false;
        }
      }

      if ((bus as any).capacity == null) {
        return true;
      }

      const totalFilled = ((bus as any).universitySlots || []).reduce(
        (acc: number, s: any) => acc + (s.filledSlots || 0),
        0,
      );

      return totalFilled < (bus as any).capacity;
    };

    const hasAnyAvailableBus = await Promise.all(
      busCandidates.map(async (bus: any) => busIsAvailable(bus)),
    ).then((results) => results.some(Boolean));

    if (!hasAnyAvailableBus) {
      const filaCount = await this.repository.countWaitlistedByEnrollmentPeriod(enrollmentPeriodId);
      const filaPosition = (filaCount || 0) + 1;

      const request = await this.createRequestRecord({
        ...baseRequestData,
        status: LicenseRequestStatus.WAITLISTED,
        filaPosition,
      }, session);

      try {
        await this.mailService.sendWaitlistConfirmation(student.email, student.name, filaPosition);
      } catch (error) {
        this.logger.warn(`Falha ao enviar email de confirmacao de fila para ${studentId}: ${(error as Error)?.message}`);
      }

      await this.auditLog.record({
        action: 'license_request.waitlisted',
        outcome: 'success',
        target: { studentId, enrollmentPeriodId },
        metadata: {
          universityId: universityIdForRequest,
          cardNote: busContext.cardNote,
          accessBusIdentifiers: busContext.accessBusIdentifiers,
          filaPosition,
        },
      });

      return { ...(request as any), waitlisted: true, filaPosition };
    }

    // Passed all checks -> create PENDING
    const request = await this.createRequestRecord({
      ...baseRequestData,
      status: LicenseRequestStatus.PENDING,
      filaPosition: null,
    }, session);

    await this.auditLog.record({
      action: 'license_request.create',
      outcome: 'success',
      target: { studentId, enrollmentPeriodId },
      metadata: {
        universityId: universityIdForRequest,
        cardNote: busContext.cardNote,
        accessBusIdentifiers: busContext.accessBusIdentifiers,
      },
    });

    return { ...(request as any), waitlisted: false };
  }

  async submitAndCreateRequest(
    studentId: string,
    dto: SubmitLicenseRequestFormDto,
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ): Promise<any> {
    // Only attempt to use transactions when mongoose is connected. When
    // running in environments where the DB is not available (tests, dev with
    // absent DB), startSession() may hang or time out. Fallback to
    // non-transactional path when session cannot be acquired.
    let session: mongoose.ClientSession | undefined = undefined;
    if (mongoose?.connection?.readyState === 1) {
      try {
        session = await mongoose.startSession();
      } catch {
        session = undefined;
      }
    }

    if (session) {
      try {
        let studentResult: any;
        await session.withTransaction(async () => {
          const activePeriod = await this.assertInitialRequestEligibility(studentId);
          studentResult = await this.studentService.submitLicenseRequest(
            studentId,
            dto,
            files,
            session,
          );
          await this.createRequest(studentId, activePeriod, session);
        });

        return studentResult;
      } finally {
        await session.endSession();
      }
    }

    // Fallback non-transactional flow
    const activePeriod = await this.assertInitialRequestEligibility(studentId);
    const studentResult = await this.studentService.submitLicenseRequest(
      studentId,
      dto,
      files,
      undefined,
    );
    await this.createRequest(studentId, activePeriod, undefined);
    return studentResult;
  }

  async submitDocumentUpdateRequest(
    studentId: string,
    changedDocumentsRaw: string,
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ): Promise<LicenseRequest> {
    const existingDocuments = await this.imagesService.findByStudentId(studentId);

    if (existingDocuments.length === 0) {
      throw new BadRequestException(
        'Você precisa enviar seus documentos pela primeira vez antes de solicitar alterações.',
      );
    }

    const changedDocuments = this.parseChangedDocuments(changedDocumentsRaw);

    const profileFile = files?.ProfilePhoto?.[0];
    const enrollmentFile = files?.EnrollmentProof?.[0];
    const scheduleFile = files?.CourseSchedule?.[0];

    const fileByType: Partial<Record<PhotoType, UploadedImageFile | undefined>> = {
      [PhotoType.ProfilePhoto]: profileFile,
      [PhotoType.EnrollmentProof]: enrollmentFile,
      [PhotoType.CourseSchedule]: scheduleFile,
    };

    const pendingImages: Partial<Record<PhotoType, string>> = {};

    for (const photoType of changedDocuments) {
      const file = fileByType[photoType];
      if (!file) {
        throw new BadRequestException(
          `Arquivo não enviado para o tipo ${photoType}`,
        );
      }

      pendingImages[photoType] = this.toDataUrl(file);
    }

    return this.cancelAndReplaceWithUpdate(
      studentId,
      changedDocuments,
      pendingImages,
    );
  }

  async cancelAndReplaceWithUpdate(
    studentId: string,
    changedDocuments: PhotoType[],
    pendingImages: Partial<Record<PhotoType, string>>,
  ): Promise<LicenseRequest> {
    const requests = await this.repository.findByStudentId(studentId);
    const hasApprovedRequest = requests.some(
      (request) => request.status === LicenseRequestStatus.APPROVED,
    );

    if (!hasApprovedRequest) {
      throw new BadRequestException(
        'Só é possível solicitar alteração de documentos após a aprovação da carteirinha inicial.',
      );
    }

    const pendingUpdate = requests.find(
      (request) =>
        request.status === LicenseRequestStatus.PENDING && request.type === LicenseRequestType.UPDATE,
    );

    if (pendingUpdate) {
      throw new BadRequestException(
        'Você já possui uma solicitação de alteração de documentos em andamento.',
      );
    }

    const pendingInitial = requests.find(
      (request) =>
        request.status === LicenseRequestStatus.PENDING && request.type === LicenseRequestType.INITIAL,
    );

    if (pendingInitial) {
      await this.repository.update((pendingInitial as any)._id.toString(), {
        status: LicenseRequestStatus.CANCELLED,
        cancellationReason: 'document_update',
      });
    }

    const request = await this.repository.create({
      studentId,
      type: LicenseRequestType.UPDATE,
      status: LicenseRequestStatus.PENDING,
      rejectionReason: null,
      cancellationReason: null,
      rejectedAt: null,
      approvedByEmployeeId: null,
      rejectedByEmployeeId: null,
      licenseId: null,
      pendingImages: Object.entries(pendingImages).map(
        ([photoType, dataUrl]) => ({ photoType, dataUrl }),
      ),
      changedDocuments,
    });

    await this.auditLog.record({
      action: 'license_request.create_update',
      outcome: 'success',
      target: { studentId },
      metadata: { changedDocuments },
    });

    return request;
  }

  async approve(
    requestId: string,
    employeeId: string,
    dto: ApproveLicenseRequestDto,
  ): Promise<LicenseRequest> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    const approvable = [LicenseRequestStatus.PENDING];
    if (!approvable.includes(request.status)) {
      throw new BadRequestException('Solicitação não pode ser aprovada no status atual');
    }

    let validityMonths = 6;
    let reservedPeriodId: string | null = null;
    let busIncremented = false;
    let busIdForIncrement: string | null = null;
    let uniIdForIncrement: string | null = null;
    let session: ClientSession | undefined = undefined;
    let usedSession = false;
    const cardContext = await this.resolveCardContextForApproval(request);
    const approvedBus = await this.resolveApprovedBus(dto.bus);
    const approvedBusId = this.toStringId((approvedBus as any)._id);
    const approvedBusIdentifier = (approvedBus as any).identifier ?? dto.bus;
    const finalCardContext = {
      cardNote: cardContext.cardNote,
      accessBusIdentifiers: approvedBusIdentifier ? [approvedBusIdentifier] : [],
    };
    if (request.type === LicenseRequestType.INITIAL && request.enrollmentPeriodId) {
      const period = await this.enrollmentPeriodService.findById(
        request.enrollmentPeriodId,
      );
      validityMonths = period?.licenseValidityMonths ?? 6;

      // Try to start a mongoose session for transactional update. If unavailable, fall back to non-transactional path.
      // Only start a session if mongoose is connected. In test environment mongoose
      // may not be connected which would cause startSession to hang or behave
      // unexpectedly. Fall back to non-transactional path when not connected.
      if (mongoose?.connection?.readyState === 1) {
        try {
          session = await mongoose.startSession();
        } catch (err) {
          session = undefined;
        }
      } else {
        session = undefined;
      }

      if (session) {
        try {
          usedSession = true;
          await session.withTransaction(async () => {
              // increment enrollment period within transaction
              await this.enrollmentPeriodService.incrementFilled(request.enrollmentPeriodId as string, session);
              reservedPeriodId = request.enrollmentPeriodId;

              if (approvedBusId && (request as any).universityId) {
                const rawUni = (request as any).universityId;
                busIdForIncrement = approvedBusId;
                uniIdForIncrement = typeof rawUni === 'string' ? rawUni : rawUni?.toString?.();
                if (busIdForIncrement && uniIdForIncrement) {
                  await this.busService.incrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement, session);
                  busIncremented = true;
                }
              }

              // create license (will use session in repository)
              let licenseCreated: any;
              if (request.type === LicenseRequestType.UPDATE) {
                // update license path handled below outside transaction creation path
              } else {
                licenseCreated = await this.licenseService.create(
                  {
                    id: request.studentId,
                    institution: dto.institution,
                    bus: approvedBusIdentifier ?? dto.bus,
                    photo: dto.photo,
                  },
                  employeeId,
                  validityMonths,
                  request.enrollmentPeriodId ?? null,
                  true,
                  session,
                  finalCardContext,
                );
              }

            // Update request as approved within transaction
            const licenseIdStr = (licenseCreated as any)?._id?.toString?.();
            await this.repository.update(requestId, {
              status: LicenseRequestStatus.APPROVED,
              approvedByEmployeeId: employeeId,
              licenseId: licenseIdStr ?? null,
              busId: approvedBusId ? new Types.ObjectId(approvedBusId) : null,
              accessBusIdentifiers: finalCardContext.accessBusIdentifiers,
              pendingImages: [],
            }, session);
          });
        } finally {
          session.endSession();
        }
      } else {
        // Fallback non-transactional path (existing logic)
        await this.enrollmentPeriodService.incrementFilled(
          request.enrollmentPeriodId as string,
        );
        reservedPeriodId = request.enrollmentPeriodId;

        if (approvedBusId && (request as any).universityId) {
          const rawUni = (request as any).universityId;
          busIdForIncrement = approvedBusId;
          uniIdForIncrement = typeof rawUni === 'string' ? rawUni : rawUni?.toString?.();
          if (busIdForIncrement && uniIdForIncrement) {
            await this.busService.incrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement);
            busIncremented = true;
          }
        }
      }
    }

    let license: { _id: { toString(): string } } | null = null;
    try {
      if (usedSession) {
        // When usedSession is true, license creation and request update were already handled inside the transaction above.
        // We still need to retrieve the license id for audit logging; set license = null to indicate already processed.
        license = null;
      } else if (request.type === LicenseRequestType.UPDATE) {
        const changedDocuments = request.changedDocuments ?? [];
        const images = await this.imagesService.findByStudentId(request.studentId);
        const pendingMap = Object.fromEntries(
          (request.pendingImages ?? []).map((p) => [p.photoType, p.dataUrl]),
        );

        for (const photoType of changedDocuments) {
          const image = images.find((item) => item.photoType === photoType);
          if (!image) {
            throw new NotFoundException(
              `Imagem do tipo ${photoType} não encontrada para arquivamento`,
            );
          }

          const imageId = (image as any)._id.toString();
          await this.imagesService.archiveToHistory(imageId);
        }

        const updatedLicense = await this.licenseService.regenerateExistingForStudent(
          request.studentId,
          {
            institution: dto.institution,
            bus: approvedBusIdentifier ?? dto.bus,
            photo: dto.photo,
          },
          employeeId,
          validityMonths,
          finalCardContext,
        );

        for (const photoType of changedDocuments) {
          const pendingDataUrl = pendingMap[photoType];
          if (!pendingDataUrl) continue;

          await this.studentService.createOrUpdateImage(
            request.studentId,
            photoType,
            this.dataUrlToUploadedFile(pendingDataUrl, photoType),
          );
        }

        license = updatedLicense as any;
        } else {
        const createdLicense = await this.licenseService.create(
          {
            id: request.studentId,
            institution: dto.institution,
            bus: approvedBusIdentifier ?? dto.bus,
            photo: dto.photo,
          },
          employeeId,
          validityMonths,
          request.enrollmentPeriodId ?? null,
          true,
          undefined,
          finalCardContext,
        );

        license = createdLicense as any;
      }
    } catch (error) {
      if (!usedSession) {
        if (reservedPeriodId) {
          await this.enrollmentPeriodService.decrementFilled(reservedPeriodId);
        }
        if (busIncremented && busIdForIncrement && uniIdForIncrement) {
          await this.busService.decrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement);
        }
      }
      throw error;
    }

    if (!usedSession) {
      const licenseId = license!._id.toString();

      const updated = await this.repository.update(requestId, {
        status: LicenseRequestStatus.APPROVED,
        approvedByEmployeeId: employeeId,
        licenseId,
        busId: approvedBusId ? new Types.ObjectId(approvedBusId) : null,
        accessBusIdentifiers: finalCardContext.accessBusIdentifiers,
        pendingImages: [],
      });

      if (request.type === LicenseRequestType.UPDATE) {
        const student = await this.studentService.findOneOrFail(request.studentId);

        await this.mailService
          .sendDocumentUpdateApproved(
            student.email,
            student.name,
            request.changedDocuments ?? [],
          )
          .catch(() => {});
      }

      await this.auditLog.record({
        action: 'license_request.approve',
        outcome: 'success',
        actor: { id: employeeId, role: 'employee' },
        target: { studentId: request.studentId, requestId },
        metadata: {
          enrollmentPeriodId: request.enrollmentPeriodId,
          validityMonths,
        },
      });

      return updated!;
    }

    // If used session, fetch the updated request to return
    const updatedRequest = await this.repository.findById(requestId);
    // If this was an update request and we used a DB session, send notification after commit
    if (request.type === LicenseRequestType.UPDATE) {
      try {
        const student = await this.studentService.findOneOrFail(request.studentId);
        await this.mailService
          .sendDocumentUpdateApproved(
            student.email,
            student.name,
            request.changedDocuments ?? [],
          )
          .catch(() => {});
      } catch (err) {
        this.logger.warn(
          `Falha ao enviar email de aprovacao de update para ${request.studentId}: ${(err as Error)?.message}`,
        );
      }
    }
    await this.auditLog.record({
      action: 'license_request.approve',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: request.studentId, requestId },
      metadata: {
        enrollmentPeriodId: request.enrollmentPeriodId,
        validityMonths,
      },
    });

    return updatedRequest!;
  }

  async reject(
    requestId: string,
    employeeId: string,
    reason: string,
  ): Promise<LicenseRequest> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    const rejectable = [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED];
    if (!rejectable.includes(request.status)) {
      throw new BadRequestException('Solicitação não pode ser recusada no status atual');
    }

    const updated = await this.repository.update(requestId, {
      status: LicenseRequestStatus.REJECTED,
      rejectionReason: reason,
      rejectedAt: new Date(),
      rejectedByEmployeeId: employeeId,
    });

    const student = await this.studentService.findOneOrFail(request.studentId);

    if (request.type === LicenseRequestType.UPDATE) {
      await this.mailService
        .sendDocumentUpdateRejected(student.email, student.name, reason)
        .catch(() => {});
    } else {
      await this.mailService
        .sendLicenseRejection(student.email, student.name, reason)
        .catch(() => {});
    }

    await this.auditLog.record({
      action: 'license_request.reject',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: request.studentId, requestId },
      metadata: { reason },
    });

    return updated!;
  }

  async findAll(): Promise<LicenseRequest[]> {
    return this.repository.findAll();
  }

  async findPending(): Promise<LicenseRequest[]> {
    return this.repository.findAllByStatus(LicenseRequestStatus.PENDING);
  }

  async findByStudentId(studentId: string): Promise<LicenseRequest[]> {
    return this.repository.findByStudentId(studentId);
  }

  async findMyLatest(studentId: string): Promise<LicenseRequest | null> {
    const requests = await this.repository.findByStudentId(studentId);
    return requests[0] ?? null;
  }

  private assertPeriodWindow(startDateRaw: Date, endDateRaw: Date): void {
    const now = new Date();
    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);

    if (now < startDate) {
      throw new BadRequestException('O período de inscrições ainda não começou.');
    }

    if (now > endDate) {
      throw new BadRequestException('O período de inscrições foi encerrado.');
    }
  }

  private parseChangedDocuments(changedDocumentsRaw: string): PhotoType[] {
    try {
      const parsed = JSON.parse(changedDocumentsRaw);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('changedDocuments deve ser um array JSON');
      }

      const allowed = new Set(Object.values(PhotoType));
      const invalid = parsed.filter((item) => !allowed.has(item));

      if (invalid.length > 0) {
        throw new BadRequestException('changedDocuments contém photoTypes inválidos');
      }

      return parsed as PhotoType[];
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('changedDocuments deve ser um JSON válido');
    }
  }

  private toDataUrl(file: UploadedImageFile): string {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  private dataUrlToUploadedFile(
    dataUrl: string,
    photoType: PhotoType,
  ): UploadedImageFile {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new BadRequestException(
        `Arquivo pendente inválido para o tipo ${photoType}`,
      );
    }

    return {
      mimetype: match[1],
      buffer: Buffer.from(match[2], 'base64'),
      originalname: `${photoType}`,
    };
  }
}
