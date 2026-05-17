import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/error-utils";
import { db } from "@/lib/db";
import { uploadedImage } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

export const maxDuration = 60;

async function getImageDimensions(buffer: Buffer, mimeType: string): Promise<{ width: number; height: number } | null> {
  try {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xFF) break;
          const marker = buffer[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          offset += 2 + buffer.readUInt16BE(offset + 2);
        }
      }
    }
    if (mimeType === 'image/png') {
      if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    }
    if (mimeType === 'image/webp') {
      if (buffer.toString('utf8', 0, 4) === 'RIFF') {
        const width = buffer.readUInt16LE(26) + 1;
        const height = buffer.readUInt16LE(28) + 1;
        return { width, height };
      }
    }
    return null;
  } catch (error) {
    console.error("Error detecting image dimensions:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await getActiveSessionUser(req.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const userId = access.user.id;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    try {
      const dimensions = await getImageDimensions(buffer, file.type);
      if (dimensions && (dimensions.width < 300 || dimensions.height < 300)) {
        return NextResponse.json({
          error: "Image must be at least 300x300 pixels for video generation"
        }, { status: 400 });
      }
    } catch (err) {
      console.warn("Could not validate image dimensions:", err);
    }

    // Compute MD5 hash for deduplication
    const hash = createHash("md5").update(buffer).digest("hex");

    // Check if this user already uploaded the same image
    const existing = await db
      .select()
      .from(uploadedImage)
      .where(and(eq(uploadedImage.userId, userId), eq(uploadedImage.hash, hash)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        url: existing[0].url,
        cached: true,
      });
    }

    // Not a duplicate — upload to R2
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = file.type.split('/')[1] || 'png';
    const filename = `uploads/${userId}/${timestamp}_${random}.${extension}`;

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || '';
    const STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY || '';
    const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
    const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'starter';
    const STORAGE_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || '';

    let publicUrl: string;

    if (!STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) {
      const base64 = buffer.toString('base64');
      publicUrl = `data:${file.type};base64,${base64}`;
    } else {
      const getEndpointUrl = () => {
        if (STORAGE_ENDPOINT.includes('.r2.cloudflarestorage.com')) {
          const parts = STORAGE_ENDPOINT.split('/');
          return parts[0] + '//' + parts[2];
        }
        return STORAGE_ENDPOINT;
      };

      const r2Client = new S3Client({
        region: "auto",
        endpoint: getEndpointUrl(),
        credentials: {
          accessKeyId: STORAGE_ACCESS_KEY_ID,
          secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: STORAGE_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      });

      await r2Client.send(command);
      publicUrl = `${STORAGE_PUBLIC_URL}/${filename}`;
    }

    // Record the upload for future deduplication
    await db.insert(uploadedImage).values({
      id: randomUUID(),
      userId,
      hash,
      url: publicUrl,
      mimeType: file.type,
      size: file.size,
    });

    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json({
      error: getErrorMessage(error, "Failed to upload file"),
    }, { status: 500 });
  }
}
