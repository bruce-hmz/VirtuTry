import { volcanoEngineConfig, validateConfig, getHeaders } from './config';

export interface SeedreamResponse {
  id?: string;
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

export async function generateVirtualTryOn(
  personImageBase64: string,
  clothingImagesBase64: string[]
): Promise<{ taskId: string; status: string }> {
  validateConfig();

  if (!personImageBase64) {
    throw new Error("Person image is required");
  }

  if (clothingImagesBase64.length === 0 || clothingImagesBase64.length > 3) {
    throw new Error("Need 1-3 clothing images");
  }

  const images = [
    { role: "person" as const, image: personImageBase64 },
    ...clothingImagesBase64.map(img => ({
      role: "clothing" as const,
      image: img,
    })),
  ];

  const payload = {
    model: "seedream-5.0-lite",
    images,
    response_format: "url",
  };

  try {
    console.log("[Seedream] Calling API with", clothingImagesBase64.length, "clothing items");

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
