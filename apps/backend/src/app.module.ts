import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { ChatModule } from './chat/chat.module';
import { MultimodalModule } from './multimodal/multimodal.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CacheModule,
    HealthModule,
    ChatModule,
    MultimodalModule,
  ],
})
export class AppModule {}
