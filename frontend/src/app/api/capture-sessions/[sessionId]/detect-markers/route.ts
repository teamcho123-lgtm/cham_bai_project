import { NextRequest, NextResponse } from "next/server";

const CAPTURE_BACKEND_URL = "http://127.0.0.1:8001";

export const runtime = "nodejs";

interface IRouteContext {
    params: Promise<{ sessionId: string }>;
}

export const POST = async (
    request: NextRequest,
    context: IRouteContext
) => {
    const { sessionId } = await context.params;

    try {
        const incomingFormData = await request.formData();
        const file = incomingFormData.get("file");
        const templateId = String(
            incomingFormData.get("templateId") ?? ""
        ).trim();

        if (!(file instanceof File)) {
            return NextResponse.json(
                { detail: "Không tìm thấy khung hình camera" },
                { status: 400 }
            );
        }

        if (!templateId) {
            return NextResponse.json(
                { detail: "Không xác định được mẫu phiếu" },
                { status: 400 }
            );
        }

        const backendFormData = new FormData();
        backendFormData.append("file", file, file.name);
        backendFormData.append("templateId", templateId);

        const response = await fetch(
            `${CAPTURE_BACKEND_URL}/capture-sessions/${sessionId}/detect-markers`,
            {
                method: "POST",
                body: backendFormData,
                cache: "no-store",
            }
        );
        const result = await response.json();

        return NextResponse.json(result, { status: response.status });
    } catch {
        return NextResponse.json(
            { detail: "Không kết nối được bộ nhận diện marker" },
            { status: 502 }
        );
    }
};
