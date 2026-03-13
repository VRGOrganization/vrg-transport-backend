import { License } from "../schemas/license.schema";

export interface ILicenseRepository<T> {
    create(license: License): Promise<License>;
    findAll(): Promise<License[]>;
    findOne(id: string): Promise<License | null>;
    update(id: string, license: License): Promise<License>;
    remove(id: string): Promise<void>;
}