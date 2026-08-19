import { NextRequest, NextResponse } from "next/server";

const CAPTURE_BACKEND_URL = "http://127.0.0.1:8001";

interface IRouteContext {
    params: Promise<{
        sessionId: string;
        imageId: string;
    }>;
}

export const GET = async (_request: NextRequest, context: IRouteContext) => {
    const { sessionId, imageId } = await context.params;

    try {
        const response = await fetch(
            `${CAPTURE_BACKEND_URL}/capture-sessions/${sessionId}/images/${imageId}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            const detail = await response.text();

            return NextResponse.json(
                { detail: detail || "Không tìm thấy ảnh" },
                { status: response.status }
            );
        }

        return new NextResponse(await response.arrayBuffer(), {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return NextResponse.json(
            { detail: "Không tải được ảnh từ API camera" },
            { status: 502 }
        );
    }
};
