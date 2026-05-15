import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUser } from "@/lib/auth/session";
import { getUserCredits } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const access = await getActiveSessionUser(request.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const credits = await getUserCredits(access.user.id);

    return NextResponse.json({ credits });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
