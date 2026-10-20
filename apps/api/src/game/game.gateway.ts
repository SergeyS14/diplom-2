import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  WS_EVENTS,
  type AnswerSubmitPayload,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type WsAck,
} from '@quiz/shared';
import { GameError, GameService } from './game.service';

function corsOrigins(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === '*') {
    return true;
  }
  return raw.split(',').map((item) => item.trim());
}

@WebSocketGateway({
  cors: { origin: corsOrigins(), credentials: true },
})
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly game: GameService) {}

  afterInit() {
    this.game.setBroadcasts({
      emitToRoom: (code, event, payload) => {
        this.server.to(this.roomName(code)).emit(event, payload);
      },
    });
  }

  handleDisconnect(client: Socket) {
    this.game.handleDisconnect(client.id).catch((err) => this.logger.error(err));
  }

  @SubscribeMessage(WS_EVENTS.PING)
  handlePing(@MessageBody() body: { ts?: number }) {
    return { ts: Date.now(), echo: body?.ts };
  }

  @SubscribeMessage(WS_EVENTS.ROOM_CREATE)
  async createRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomCreatePayload,
  ): Promise<WsAck> {
    return this.wrap(async () => {
      const result = await this.game.createRoom(
        client.id,
        body?.quizId,
        body?.as ?? 'tv',
        body?.accessToken,
        body?.tvPassword,
      );
      await client.join(this.roomName(result.code));
      return result;
    });
  }

  @SubscribeMessage(WS_EVENTS.ROOM_JOIN)
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomJoinPayload,
  ): Promise<WsAck> {
    return this.wrap(async () => {
      const result = await this.game.joinRoom(client.id, body);
      await client.join(this.roomName(result.state.code));
      return result;
    });
  }

  @SubscribeMessage(WS_EVENTS.ROOM_START)
  async start(@ConnectedSocket() client: Socket): Promise<WsAck> {
    return this.wrap(() => this.game.startGame(client.id));
  }

  @SubscribeMessage(WS_EVENTS.ROOM_NEXT)
  async next(@ConnectedSocket() client: Socket): Promise<WsAck> {
    return this.wrap(() => this.game.next(client.id));
  }

  @SubscribeMessage(WS_EVENTS.ANSWER_SUBMIT)
  async answer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AnswerSubmitPayload,
  ): Promise<WsAck> {
    return this.wrap(() => this.game.submitAnswer(client.id, body));
  }

  @SubscribeMessage(WS_EVENTS.ROOM_LEAVE)
  async leave(@ConnectedSocket() client: Socket): Promise<WsAck> {
    return this.wrap(async () => {
      const result = await this.game.leaveRoom(client.id);
      const rooms = [...client.rooms];
      await Promise.all(
        rooms.filter((name) => name.startsWith('game:')).map((name) => client.leave(name)),
      );
      return result;
    });
  }

  private roomName(code: string) {
    return `game:${code}`;
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<WsAck<T>> {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (err) {
      if (err instanceof GameError) {
        return { ok: false, error: err.message, code: err.code };
      }
      this.logger.error(err);
      return { ok: false, error: 'Внутренняя ошибка', code: 'INTERNAL' };
    }
  }
}
