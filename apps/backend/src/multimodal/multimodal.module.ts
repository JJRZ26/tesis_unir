import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { openaiConfig } from './openai.config';
import { OpenAIService } from './openai.service';
import { MultimodalService } from './multimodal.service';
import { MultimodalController } from './multimodal.controller';

@Module({
  imports: [ConfigModule.forFeature(openaiConfig)],
  controllers: [MultimodalController],
  providers: [OpenAIService, MultimodalService],
  exports: [OpenAIService, MultimodalService],
})
export class MultimodalModule {}
