import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteVirtualTryOn } from "@/lib/virtualtry";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Try-on ID required" }, { status: 400 });
    }

    await deleteVirtualTryOn(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TryOnDelete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete record" },
      { status: 500 }
    );
  }
}
