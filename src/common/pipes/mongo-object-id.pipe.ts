/*
    Tem a funcao de validar se o valor passado eh um ObjectId valido do MongoDB. 
    Se o valor for invalido, ele lanca uma exceção BadRequestException. Caso contrario, ele retorna o valor original. 
    Util para garantir que os parametros de rota ou outros valores que devem ser ObjectIds sejam validados corretamente antes de serem usados em operacoes de banco de dados.
*/


import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { Types } from "mongoose";

@Injectable()
export class MongoObjectIdPipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException(`Invalid MongoDB ObjectId: ${value}`);
        }
        return value;
    }
}
