import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedUser } from "../auth/types";
import { BoardService } from "./board.service";
import {
  CreateBoardPostDto,
  ListBoardQueryDto,
  PatchBoardPostDto,
} from "./dto";

@Controller("board")
@UseGuards(JwtAuthGuard)
export class BoardController {
  constructor(private readonly svc: BoardService) {}

  @Get()
  list(@Query() q: ListBoardQueryDto, @CurrentUser() user: AuthedUser) {
    return this.svc.list(user, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateBoardPostDto, @CurrentUser() user: AuthedUser) {
    return this.svc.create(user, body);
  }

  @Patch(":id")
  patch(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: PatchBoardPostDto,
    @CurrentUser() user: AuthedUser,
  ) {
    return this.svc.patch(user, id, body);
  }

  @Delete(":id")
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthedUser,
  ) {
    await this.svc.remove(user, id);
    return { ok: true };
  }
}
