import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Bet, BetSchema } from './schemas/bet.schema';
import { Player, PlayerSchema } from './schemas/player.schema';
import { BackofficeService } from './backoffice.service';

@Global()
@Module({
  imports: [
    // Conexión separada para la base de datos del backoffice
    MongooseModule.forRootAsync({
      connectionName: 'backoffice',
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DB_BACKOFFICE_URL'),
      }),
      inject: [ConfigService],
    }),
    // Registrar los schemas en la conexión del backoffice
    MongooseModule.forFeature(
      [
        { name: Bet.name, schema: BetSchema },
        { name: Player.name, schema: PlayerSchema },
      ],
      'backoffice',
    ),
  ],
  providers: [BackofficeService],
  exports: [BackofficeService],
})
export class BackofficeModule {}
