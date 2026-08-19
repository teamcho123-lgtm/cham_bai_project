import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const CAPTURE_BACKEND_URL = "http://127.0.0.1:8001";

export const runtime = "nodejs";

const getCameraPublicOrigin = async () => {
    const configuredOrigin = process.env.CAMERA_PUBLIC_ORIGIN?.trim();
    let origin = configuredOrigin;

    if (!origin) {
        try {
            origin = (
                await readFile(
                    path.join(process.cwd(), ".camera-tunnel-url"),
                    "utf8"
                )
            ).trim();
        } catch {
            return null;
        }
    }

    try {
        const parsedOrigin = new URL(origin);

        if (parsedOrigin.protocol !== "https:") {
            return null;
        }

        return parsedOrigin.origin;
    } catch {
        return null;
    }
};

export const GET = async () => {
    const cameraOrigin = await getCameraPublicOrigin();

    if (!cameraOrigin) {
        return NextResponse.json(
            {
                success: false,
                cameraOrigin: null,
                detail: "HTTPS camera chưa sẵn sàng. Vui lòng đợi Cloudflare tạo URL mới.",
            },
            { status: 503 }
        );
    }

    return NextResponse.json({
        success: true,
        cameraOrigin,
    });
};

export const POST = async () => {
    try {
        const cameraOrigin = await getCameraPublicOrigin();

        if (!cameraOrigin) {
            return NextResponse.json(
                {
                    success: false,
                    detail: "HTTPS camera chưa sẵn sàng. Vui lòng đợi Cloudflare tạo URL mới.",
                },
                { status: 503 }
            );
        }

        const response = await fetch(
            `${CAPTURE_BACKEND_URL}/capture-sessions`,
            {
                method: "POST",
                cache: "no-store",
            }
        );
        const result = await response.json();

        return NextResponse.json(
            {
                ...result,
                cameraOrigin,
            },
            { status: response.status }
        );
    } catch {
        return NextResponse.json(
            { detail: "Không kết nối được API camera" },
            { status: 502 }
        );
    }
};
