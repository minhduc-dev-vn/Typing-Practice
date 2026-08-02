import { findBlockedKeyword } from "@/lib/ai/blocked-keywords";
import { createStaticFallback } from "@/lib/ai/fallback";
import { generateAiContent } from "@/lib/ai/generate";
import type { AiContentRepository } from "@/lib/ai/repository";
import type { GenerateRequest, GenerateResponse } from "@/lib/ai/types";

export const DAILY_GENERATION_LIMIT = 20;

export class GenerateServiceError extends Error {
  constructor(
    message: string,
    readonly code: "BLOCKED_TOPIC" | "RATE_LIMITED",
    readonly status: number,
    readonly resetAt?: string
  ) {
    super(message);
    this.name = "GenerateServiceError";
  }
}

interface GenerateDependencies {
  repository: AiContentRepository | null;
  generate?: (request: GenerateRequest) => Promise<string[]>;
  now?: () => Date;
  onOperationalError?: (error: unknown) => void;
}

function fallbackResponse(request: GenerateRequest, message: string): GenerateResponse {
  return {
    content: createStaticFallback(request),
    cached: false,
    fallback: true,
    message
  };
}

export async function generatePracticeContent(
  request: GenerateRequest,
  sessionId: string,
  dependencies: GenerateDependencies
): Promise<GenerateResponse> {
  if (findBlockedKeyword(request.topic)) {
    throw new GenerateServiceError(
      "Chủ đề này không thể dùng để tạo nội dung luyện gõ.",
      "BLOCKED_TOPIC",
      403
    );
  }

  const { repository } = dependencies;
  if (!repository) {
    return fallbackResponse(
      request,
      "AI chưa được cấu hình. Bạn đang luyện bằng nội dung tĩnh."
    );
  }

  try {
    const cachedContent = await repository.findCached(request);
    if (cachedContent) {
      return { content: cachedContent, cached: true };
    }
  } catch (error) {
    dependencies.onOperationalError?.(error);
    return fallbackResponse(
      request,
      "Không thể truy cập bộ nhớ AI. Bạn đang luyện bằng nội dung tĩnh."
    );
  }

  let usage;
  try {
    usage = await repository.consumeUsage(
      sessionId,
      DAILY_GENERATION_LIMIT,
      dependencies.now?.() ?? new Date()
    );
  } catch (error) {
    dependencies.onOperationalError?.(error);
    return fallbackResponse(
      request,
      "Không thể kiểm tra lượt tạo nội dung. Bạn đang luyện bằng nội dung tĩnh."
    );
  }

  if (!usage.allowed) {
    throw new GenerateServiceError(
      "Bạn đã dùng hết 20 lượt tạo nội dung trong 24 giờ. Nội dung tĩnh vẫn sẵn sàng.",
      "RATE_LIMITED",
      429,
      usage.resetAt
    );
  }

  let content: string[];
  try {
    content = await (dependencies.generate ?? generateAiContent)(request);
  } catch (error) {
    dependencies.onOperationalError?.(error);
    return fallbackResponse(
      request,
      "AI đang tạm thời không phản hồi. Bạn đang luyện bằng nội dung tĩnh."
    );
  }

  try {
    await repository.saveCached(request, content);
  } catch (error) {
    dependencies.onOperationalError?.(error);
  }

  return { content, cached: false };
}
