import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  VisionContent,
  VisionRequestOptions,
  VisionAnalysisResult,
} from './interfaces/vision.types';

@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('openai.apiKey');

    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured. Vision features will be unavailable.');
      return;
    }

    this.client = new OpenAI({ apiKey });
    this.defaultModel = this.configService.get<string>('openai.model') || 'gpt-4o';
    this.defaultMaxTokens = this.configService.get<number>('openai.maxTokens') || 4096;
    this.defaultTemperature = this.configService.get<number>('openai.temperature') || 0.7;

    this.logger.log(`OpenAI service initialized with model: ${this.defaultModel}`);
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async analyzeWithVision(
    content: VisionContent[],
    options?: VisionRequestOptions,
  ): Promise<VisionAnalysisResult> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY.');
    }

    const model = options?.model || this.defaultModel;
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;
    const temperature = options?.temperature || this.defaultTemperature;

    const messages: ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: content as any,
    });

    this.logger.debug(`Sending vision request to ${model}`);

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason || 'unknown',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async chat(
    messages: ChatCompletionMessageParam[],
    options?: Omit<VisionRequestOptions, 'systemPrompt'>,
  ): Promise<VisionAnalysisResult> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY.');
    }

    const model = options?.model || this.defaultModel;
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;
    const temperature = options?.temperature || this.defaultTemperature;

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason || 'unknown',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  buildImageUrl(base64: string, mimeType: string = 'image/jpeg'): string {
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Chat with web search capability using OpenAI's web search preview model
   * This allows GPT-4 to search the internet for real-time information
   */
  async chatWithWebSearch(
    messages: ChatCompletionMessageParam[],
    options?: Omit<VisionRequestOptions, 'systemPrompt'>,
  ): Promise<VisionAnalysisResult> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY.');
    }

    // Use the search-enabled model
    const model = 'gpt-4o-search-preview';
    const maxTokens = options?.maxTokens || this.defaultMaxTokens;

    this.logger.debug(`Sending chat request with web search to ${model}`);

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages,
        web_search_options: {
          search_context_size: 'medium',
        },
      } as any);

      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason || 'unknown',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.warn(`Web search model failed, falling back to regular chat: ${error.message}`);
      // Fallback to regular chat if search model is not available
      return this.chat(messages, options);
    }
  }
}
