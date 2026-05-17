import { volcanoEngineConfig, validateConfig, getHeaders } from './config';

export interface SeedreamResponse {
  id?: string;
  created?: number;
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

export async function generateVirtualTryOn(
  personImageUrl: string,
  clothingImageUrls: string[]
): Promise<{ taskId: string; status: string; imageUrl?: string }> {
  validateConfig();

  if (!personImageUrl) {
    throw new Error("Person image is required");
  }

  if (clothingImageUrls.length === 0 || clothingImageUrls.length > 3) {
    throw new Error("Need 1-3 clothing images");
  }

  const allImages = [personImageUrl, ...clothingImageUrls];

  const payload = {
    model: "doubao-seedream-5-0-lite-260128",
    prompt: "将提供的服装自然地穿在人物身上，保持人物姿态和面部特征不变，确保服装贴合身体轮廓，光照自然，整体效果逼真。",
    image: allImages,
    response_format: "url",
  };

  try {
    console.log("[Seedream] Calling API with", clothingImageUrls.length, "clothing items");

    const response = await fetch(
      `${volcanoEngineConfig.apiUrl}/images/generations`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Seedream API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as SeedreamResponse;

    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
    if (!imageUrl) {
      throw new Error("Seedream returned no image data");
    }

    return {
      taskId: data.id || crypto.randomUUID(),
      status: "completed",
      imageUrl,
    };
  } catch (error) {
    console.error("[Seedream] API error:", error);
    throw error;
  }
}

export async function querySeedreamStatus(taskId: string): Promise<SeedreamResponse> {
  validateConfig();

  const response = await fetch(
    `${volcanoEngineConfig.apiUrl}/images/generations/${taskId}`,
    {
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to query Seedream status: ${response.status}`);
  }

  return response.json();
}
