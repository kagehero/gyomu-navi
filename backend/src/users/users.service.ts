import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { UserEntity } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  /**
   * Look up an active user by email (case-insensitive). Soft-deleted rows
   * are filtered out. Used by AuthService.validate().
   */
  findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOne({
      where: { email: email.toLowerCase(), deletedAt: IsNull() },
    });
  }

  /**
   * Look up by id for the `/auth/me` round-trip. Returns null on missing
   * or soft-deleted rows so the caller can 401.
   */
  findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }
}
