import axios, { AxiosError } from "axios";

const API_KEY = process.env.VOLCANO_ENGINE_API_KEY;
const API_BASE_URL = process.env.VOLCANO_ENGINE_API_URL;

export interface SeedreamImage {
  role: "person" | "clothing";
  image: string; // data:image/...;base64,...
}

export interface SeedreamRequest {
  model: string;
  images: SeedreamImage[];
  parameters?: {
    negative_prompt?: string;
    steps?: number;
    guidance_scale?: number;
  };
}

export interface SeedreamResponse {
  task_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output?: {
    image: string; // Base64 or URL
  };
  error?: string;
  message?: string;
}

/**
 * Generate virtual try-on using Seedream API
 * @param personImageBase64 Person image (data:image/...;base64,...)
 * @param clothingImagesBase64 Clothing images array (1-3 items)
 * @returns taskId and status
 */
export async function generateVirtualTryOn(
  personImageBase64: string,
  clothingImagesBase64: string[]
): Promise<{ taskId: string; status: string }> {
  if (!API_KEY || !API_BASE_URL) {
    throw new Error("Seedream API credentials not configured");
  }

  if (!personImageBase64) {
    throw new Error("Person image is required");
  }

  if (clothingImagesBase64.length === 0 || clothingImagesBase64.length > 3) {
    throw new Error("Need 1-3 clothing images");
  }

  const images: SeedreamImage[] = [
    {
      role: "person",
      image: personImageBase64,
    },
    ...clothingImagesBase64.map(img => ({
      role: "clothing" as const,
      image: img,
    })),
  ];

  const payload: SeedreamRequest = {
    model: "seedream-5.0-lite",
    images: images,
    parameters: {
      negative_prompt: "blurry, low quality, distorted",
      steps: 20,
      guidance_scale: 7.5,
    },
  };

  try {
    console.log("[Seedream] Calling API with", clothingImagesBase64.length, "clothing items");

    const response = await axios.post<SeedreamResponse>(
      `${API_BASE_URL}/text_to_image`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    console.log("[Seedream] API response:", {
      taskId: response.data.task_id,
      status: response.data.status,
    });

    return {
      taskId: response.data.task_id,
      status: response.data.status,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("[Seedream] API error:", {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      message: axiosError.message,
    });

    throw new Error(
      `Seedream API error: ${axiosError.response?.status || axiosError.message}`
    );
  }
}

/**
 * Query Seedream task status
 */
export async function querySeedreamStatus(taskId: string): Promise<SeedreamResponse> {
  if (!API_KEY || !API_BASE_URL) {
    throw new Error("Seedream API credentials not configured");
  }

  try {
    console.log("[Seedream] Querying task status:", taskId);

    const response = await axios.get<SeedreamResponse>(
      `${API_BASE_URL}/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );

    console.log("[Seedream] Task status:", response.data.status);

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("[Seedream] Query status error:", {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      message: axiosError.message,
    });

    throw new Error(
      `Failed to query Seedream status: ${axiosError.response?.status || axiosError.message}`
    );
  }
}
