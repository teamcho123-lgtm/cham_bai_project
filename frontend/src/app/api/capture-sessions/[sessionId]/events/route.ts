import { NextRequest, NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

interface IRouteContext {
    params: Promise<{ sessionId: string }>;
}

export const POST = async (request: NextRequest, context: IRouteContext) => {
    const { sessionId } = await context.params;

    try {
        const payload = await request.json();
        const event = String(payload.event ?? "unknown").slice(0, 100);
        const detail = String(payload.detail ?? "").slice(0, 1000);

        await appendFile(
            path.join(process.cwd(), "capture-upload.log"),
            `[${new Date().toISOString()}] ${sessionId} - mobile:${event} | ${detail}\n`,
            "utf8"
        );

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false }, { status: 400 });
    }
};
