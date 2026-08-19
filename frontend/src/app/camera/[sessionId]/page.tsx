"use client";

import { AlertTriangle, Camera, CheckCircle2, LoaderCircle, RotateCcw, Send, Smartphone } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AutoScanCamera from "./auto-scan-camera";

type UploadStatus = "idle" | "uploading" | "success";
type SessionStatus = "checking" | "active" | "expired" | "unavailable";

const sendMobileEvent = (
    sessionId: string,
    event: string,
    detail = ""
) => {
    const body = JSON.stringify({ event, detail });
    const url = `/api/capture-sessions/${sessionId}/events`;

    if (navigator.sendBeacon) {
        navigator.sendBeacon(
            url,
            new Blob([body], { type: "application/json" })
        );
        return;
    }

    void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    });
};

const CameraCapturePage = () => {
    const params = useParams<{ sessionId: string }>();
    const sessionId = params.sessionId;
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
    const formRef = useRef<HTMLFormElement>(null);
    const knownImageCountRef = useRef(0);
    const verifyTimerRef = useRef<number | null>(null);

    useEffect(() => {
        sendMobileEvent(sessionId, "page-ready", navigator.userAgent);

        let cancelled = false;

        const verifySession = async () => {
            try {
                const response = await fetch(
                    `/api/capture-sessions/${sessionId}/images`,
                    { cache: "no-store" }
                );
                const result = await response.json();

                if (cancelled) {
                    return;
                }

                if (!response.ok) {
                    setSessionStatus(
                        response.status === 404 ? "expired" : "unavailable"
                    );
                    return;
                }

                knownImageCountRef.current = Array.isArray(result.images)
                    ? result.images.length
                    : 0;
                setSessionStatus("active");
            } catch {
                if (!cancelled) {
                    setSessionStatus("unavailable");
                }
            }
        };

        void verifySession();

        return () => {
            cancelled = true;

            if (verifyTimerRef.current !== null) {
                window.clearTimeout(verifyTimerRef.current);
            }
        };
    }, [sessionId]);

    const handleSubmit = () => {
        setStatus("uploading");
        sendMobileEvent(sessionId, "native-form-submit");

        const verifyUpload = async (attempt = 0) => {
            try {
                const response = await fetch(
                    `/api/capture-sessions/${sessionId}/images`,
                    { cache: "no-store" }
                );
                const result = await response.json();

                if (response.status === 404) {
                    setSessionStatus("expired");
                    return;
                }

                if (!response.ok) {
                    throw new Error("Không kiểm tra được ảnh đã gửi");
                }

                const currentCount = Array.isArray(result.images)
                    ? result.images.length
                    : 0;

                if (currentCount > knownImageCountRef.current) {
                    knownImageCountRef.current = currentCount;
                    setStatus("success");
                    sendMobileEvent(sessionId, "native-form-complete");
                    return;
                }
            } catch {
                // Tiếp tục thử vì form upload có thể vẫn đang chạy trong iframe.
            }

            if (attempt < 120) {
                verifyTimerRef.current = window.setTimeout(
                    () => void verifyUpload(attempt + 1),
                    500
                );
            }
        };

        verifyTimerRef.current = window.setTimeout(
            () => void verifyUpload(),
            500
        );
    };

    const handleCaptureAnother = () => {
        formRef.current?.reset();
        setStatus("idle");
    };

    const handleSessionExpired = useCallback(() => {
        setSessionStatus("expired");
    }, []);

    if (sessionStatus !== "active") {
        const isChecking = sessionStatus === "checking";
        const isExpired = sessionStatus === "expired";

        return (
            <main className="flex min-h-dvh items-center justify-center bg-[#fff3f5] px-4 py-6 text-slate-800">
                <section className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-lg shadow-rose-100">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-[#9f3f50]">
                        {isChecking ? (
                            <LoaderCircle className="animate-spin" size={30} />
                        ) : (
                            <AlertTriangle size={30} />
                        )}
                    </div>
                    <h1 className="text-xl font-bold">
                        {isChecking
                            ? "Đang kiểm tra phiên camera"
                            : isExpired
                                ? "Phiên camera đã hết hạn"
                                : "Không kết nối được camera server"}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        {isChecking
                            ? "Vui lòng chờ trong giây lát..."
                            : isExpired
                                ? "Trên máy tính, mở lại mục Camera iPhone để hệ thống tạo mã QR mới rồi quét lại."
                                : "Kiểm tra FastAPI cổng 8001 và kết nối mạng, sau đó thử lại."}
                    </p>
                    {!isChecking && (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#9f3f50] px-5 py-3 font-semibold text-white"
                        >
                            <RotateCcw size={18} />
                            Kiểm tra lại
                        </button>
                    )}
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-[#fff3f5] px-4 py-6 text-slate-800">
            <div className="mx-auto max-w-md">
                <div className="mb-5 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9f3f50] text-white shadow-lg shadow-rose-200">
                        <Smartphone size={28} />
                    </div>
                    <h1 className="text-2xl font-bold">Chụp phiếu bài làm</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Đặt trọn phiếu trong khung hình, đủ sáng và thấy rõ bốn marker ở góc.
                    </p>
                </div>

                {status === "uploading" && (
                    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                        Đang gửi ảnh về máy tính, vui lòng giữ nguyên trang...
                    </div>
                )}

                {status === "success" && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={18} className="mr-2 inline" />
                        Ảnh đã được gửi. Hãy kiểm tra màn hình máy tính.
                    </div>
                )}

                <AutoScanCamera
                    sessionId={sessionId}
                    onSessionExpired={handleSessionExpired}
                />

                <section className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                        <h2 className="font-bold text-slate-800">
                            Chụp và gửi thủ công
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            Dùng cách này nếu trình duyệt không mở được chế độ quét tự động.
                        </p>
                    </div>

                    <form
                        ref={formRef}
                        action={`/api/capture-sessions/${sessionId}/images`}
                        method="post"
                        encType="multipart/form-data"
                        target="capture-upload-result"
                        onSubmit={handleSubmit}
                    >
                        <div className="flex min-h-[42dvh] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 px-5 text-center">
                            <Camera size={48} className="mb-4 text-[#9f3f50]" />
                            <strong className="text-lg">Mở camera sau</strong>
                            <span className="mt-2 text-sm leading-6 text-slate-500">
                                Sau khi bấm Sử dụng ảnh, kiểm tra tên file rồi bấm Gửi ảnh vừa chụp.
                            </span>

                            <input
                                type="file"
                                name="file"
                                accept="image/*"
                                capture="environment"
                                required
                                onClick={() => sendMobileEvent(sessionId, "native-camera-click")}
                                className="mt-5 block w-full rounded-xl border border-rose-200 bg-white p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#9f3f50] file:px-3 file:py-2 file:font-semibold file:text-white"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === "uploading"}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f3f50] px-4 py-3.5 font-semibold text-white disabled:opacity-60"
                        >
                            <Send size={18} />
                            {status === "uploading"
                                ? "Đang gửi..."
                                : "Gửi ảnh vừa chụp"}
                        </button>
                    </form>

                    <iframe
                        name="capture-upload-result"
                        title="Kết quả gửi ảnh"
                        className="hidden"
                    />
                </section>

                {status === "success" && (
                    <button
                        type="button"
                        onClick={handleCaptureAnother}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#9f3f50] bg-white px-4 py-3 font-semibold text-[#8f3c4a]"
                    >
                        <RotateCcw size={18} />
                        Chụp phiếu tiếp theo
                    </button>
                )}
            </div>
        </main>
    );
};

export default CameraCapturePage;
