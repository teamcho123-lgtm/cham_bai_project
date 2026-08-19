import { NextRequest, NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";
import path from "node:path";

const CAPTURE_BACKEND_URL = "http://127.0.0.1:8001";

export const runtime = "nodejs";

const writeCaptureLog = async (message: string) => {
    try {
        await appendFile(
            path.join(process.cwd(), "capture-upload.log"),
            `[${new Date().toISOString()}] ${message}\n`,
            "utf8"
        );
    } catch {
        // Nhật ký chỉ dùng chẩn đoán, không được làm hỏng luồng upload.
    }
};

interface IRouteContext {
    params: Promise<{ sessionId: string }>;
}

export const GET = async (_request: NextRequest, context: IRouteContext) => {
    const { sessionId } = await context.params;

    try {
        const response = await fetch(
            `${CAPTURE_BACKEND_URL}/capture-sessions/${sessionId}/images`,
            { cache: "no-store" }
        );
        const result = await response.json();

        if (Array.isArray(result.images)) {
            result.images = result.images.map((image: { id: string }) => ({
                ...image,
                downloadUrl: `/api/capture-sessions/${sessionId}/images/${image.id}`,
            }));
        }

        return NextResponse.json(result, { status: response.status });
    } catch {
        return NextResponse.json(
            { detail: "Không đọc được ảnh từ API camera", images: [] },
            { status: 502 }
        );
    }
};

export const POST = async (request: NextRequest, context: IRouteContext) => {
    const { sessionId } = await context.params;

    try {
        const incomingFormData = await request.formData();
        const file = incomingFormData.get("file");

        if (!(file instanceof File)) {
            await writeCaptureLog(`${sessionId} - request không có file hợp lệ`);

            return NextResponse.json(
                { detail: "Không tìm thấy file ảnh" },
                { status: 400 }
            );
        }

        await writeCaptureLog(
            `${sessionId} - nhận ${file.name} | ${file.type || "không có MIME"} | ${file.size} bytes`
        );

        const backendFormData = new FormData();
        backendFormData.append("file", file, file.name);

        const response = await fetch(
            `${CAPTURE_BACKEND_URL}/capture-sessions/${sessionId}/images`,
            {
                method: "POST",
                body: backendFormData,
                cache: "no-store",
            }
        );
        const result = await response.json();

        await writeCaptureLog(
            `${sessionId} - backend trả HTTP ${response.status} | ${JSON.stringify(result)}`
        );

        return NextResponse.json(result, { status: response.status });
    } catch (error) {
        await writeCaptureLog(
            `${sessionId} - lỗi proxy | ${error instanceof Error ? error.message : String(error)}`
        );

        return NextResponse.json(
            { detail: "Không gửi được ảnh tới API camera" },
            { status: 502 }
        );
    }
};
