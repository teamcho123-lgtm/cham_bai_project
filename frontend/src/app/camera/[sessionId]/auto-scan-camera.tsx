"use client";

import {
    Camera,
    CameraOff,
    CheckCircle2,
    LoaderCircle,
    ScanLine,
    Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CornerName =
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight";

type NormalizedPoint = [number, number];

interface IMarkerDetectionResponse {
    success: boolean;
    detected: boolean;
    ready: boolean;
    markerCount: number;
    normalizedPoints: Record<CornerName, NormalizedPoint | null>;
    geometry: {
        valid: boolean;
        horizontalRatio: number | null;
        verticalRatio: number | null;
    };
    quality: {
        sharpness: number;
        brightness: number;
    };
    detail?: string;
}

interface IProps {
    sessionId: string;
    onSessionExpired: () => void;
}

interface ICameraCapabilities extends MediaTrackCapabilities {
    exposureMode?: string[];
    focusMode?: string[];
    whiteBalanceMode?: string[];
}

interface ICameraConstraintSet extends MediaTrackConstraintSet {
    exposureMode?: string;
    focusMode?: string;
    whiteBalanceMode?: string;
}

type ScanStatus =
    | "inactive"
    | "starting"
    | "searching"
    | "aligning"
    | "stabilizing"
    | "uploading"
    | "waiting-removal"
    | "error"
    | "unsupported";

const TARGET_WIDTH = 1536;
const TARGET_HEIGHT = 2048;
// Camera thường công bố kích thước theo chiều ngang của cảm biến dù điện
// thoại đang cầm dọc. Yêu cầu 4:3 giúp tránh luồng 16:9 phải cắt quá nhiều
// trước khi chuẩn hóa thành phiếu dọc 3:4.
const REQUEST_WIDTH = 3840;
const REQUEST_HEIGHT = 2880;
const DETECTION_INTERVAL_MS = 450;
const REQUIRED_STABLE_FRAMES = 2;
const REQUIRED_MISSING_FRAMES = 3;
const MAX_NORMALIZED_MOVEMENT = 0.012;
// Ảnh mờ thực tế từ iPhone trong thư mục capture_sessions chỉ đạt khoảng
// 90-100, trong khi ảnh đọc rõ thường vượt 1.000. Ngưỡng cũ 85 khiến ảnh mờ
// vẫn được gửi đi.
const MIN_SHARPNESS = 400;
const MIN_BRIGHTNESS = 35;
const MAX_BRIGHTNESS = 235;

const EMPTY_CORNERS: Record<CornerName, boolean> = {
    topLeft: false,
    topRight: false,
    bottomLeft: false,
    bottomRight: false,
};

const drawVideoFrame = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
) => {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (sourceWidth === 0 || sourceHeight === 0) {
        return false;
    }

    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    const context = canvas.getContext("2d", {
        alpha: false,
    });

    if (!context) {
        return false;
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
    let sourceX = 0;
    let sourceY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    // Cat giua giong object-cover cua video, de toa do marker tren API
    // trung voi khung huong dan ma giao vien dang nhin thay.
    if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        sourceX = (sourceWidth - cropWidth) / 2;
    } else {
        cropHeight = sourceWidth / targetRatio;
        sourceY = (sourceHeight - cropHeight) / 2;
    }

    context.drawImage(
        video,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        TARGET_WIDTH,
        TARGET_HEIGHT
    );

    return true;
};

const canvasToBlob = (
    canvas: HTMLCanvasElement,
    quality: number
) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
        (blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error("Không tạo được ảnh từ camera"));
        },
        "image/jpeg",
        quality
    );
});

const takeHighResolutionPhoto = async (
    videoTrack: MediaStreamTrack
) => {
    if (typeof ImageCapture === "undefined") {
        return null;
    }

    try {
        const imageCapture = new ImageCapture(videoTrack);
        const capabilities = await imageCapture.getPhotoCapabilities();
        const photoSettings: PhotoSettings = {};

        if (capabilities.imageWidth?.max) {
            photoSettings.imageWidth = capabilities.imageWidth.max;
        }

        if (capabilities.imageHeight?.max) {
            photoSettings.imageHeight = capabilities.imageHeight.max;
        }

        const photoBlob = await imageCapture.takePhoto(photoSettings);

        if (
            photoBlob.size > 0
            && ["image/jpeg", "image/png"].includes(photoBlob.type)
        ) {
            return photoBlob;
        }
    } catch (error) {
        console.warn(
            "Không lấy được ảnh tĩnh độ phân giải cao, dùng khung video:",
            error
        );
    }

    return null;
};

const applyCameraQualityConstraints = async (
    videoTrack: MediaStreamTrack
) => {
    if (typeof videoTrack.getCapabilities !== "function") {
        return;
    }

    const capabilities = (
        videoTrack.getCapabilities() as ICameraCapabilities
    );
    const qualityConstraints: ICameraConstraintSet = {};

    if (capabilities.focusMode?.includes("continuous")) {
        qualityConstraints.focusMode = "continuous";
    }

    if (capabilities.exposureMode?.includes("continuous")) {
        qualityConstraints.exposureMode = "continuous";
    }

    if (capabilities.whiteBalanceMode?.includes("continuous")) {
        qualityConstraints.whiteBalanceMode = "continuous";
    }

    if (Object.keys(qualityConstraints).length === 0) {
        return;
    }

    try {
        await videoTrack.applyConstraints({
            advanced: [qualityConstraints],
        });
    } catch (error) {
        // Một số phiên bản Safari báo có capability nhưng không cho áp dụng.
        // Không làm hỏng camera; bộ lọc độ nét phía dưới vẫn bảo vệ ảnh gửi đi.
        console.warn("Không bật được lấy nét camera liên tục:", error);
    }
};

const calculateMovement = (
    previousPoints: NormalizedPoint[],
    currentPoints: NormalizedPoint[]
) => {
    const totalMovement = currentPoints.reduce(
        (total, currentPoint, index) => {
            const previousPoint = previousPoints[index];

            return total + Math.hypot(
                currentPoint[0] - previousPoint[0],
                currentPoint[1] - previousPoint[1]
            );
        },
        0
    );

    return totalMovement / currentPoints.length;
};

const isCaptureQualityReady = (result: IMarkerDetectionResponse) => (
    result.detected
    && result.geometry.valid
    && result.quality.sharpness >= MIN_SHARPNESS
    && result.quality.brightness >= MIN_BRIGHTNESS
    && result.quality.brightness <= MAX_BRIGHTNESS
);

const AutoScanCamera = ({ sessionId, onSessionExpired }: IProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const frameCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectionTimerRef = useRef<number | null>(null);
    const detectionRunningRef = useRef(false);
    const scanActiveRef = useRef(false);
    const captureLockedRef = useRef(false);
    const waitingForRemovalRef = useRef(false);
    const previousPointsRef = useRef<NormalizedPoint[] | null>(null);
    const stableFramesRef = useRef(0);
    const missingFramesRef = useRef(0);

    const [scanStatus, setScanStatus] = useState<ScanStatus>("inactive");
    const [isScanning, setIsScanning] = useState(false);
    const [templateId, setTemplateId] = useState("");
    const [cameraResolution, setCameraResolution] = useState("");
    const [cornerState, setCornerState] = useState(EMPTY_CORNERS);
    const [stableProgress, setStableProgress] = useState(0);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [statusMessage, setStatusMessage] = useState(
        "Bấm bắt đầu rồi đưa bốn marker của phiếu vào bốn góc."
    );

    const resetTracking = useCallback(() => {
        previousPointsRef.current = null;
        stableFramesRef.current = 0;
        missingFramesRef.current = 0;
        setStableProgress(0);
    }, []);

    const stopCamera = useCallback(() => {
        scanActiveRef.current = false;
        setIsScanning(false);

        if (detectionTimerRef.current !== null) {
            window.clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        detectionRunningRef.current = false;
        captureLockedRef.current = false;
        waitingForRemovalRef.current = false;
        resetTracking();
        setCornerState(EMPTY_CORNERS);
        setCameraResolution("");
        setScanStatus("inactive");
        setStatusMessage("Đã dừng camera tự động.");
    }, [resetTracking]);

    const uploadCurrentFrame = useCallback(async () => {
        const video = videoRef.current;
        const canvas = frameCanvasRef.current;

        if (!video || !canvas || captureLockedRef.current) {
            return;
        }

        captureLockedRef.current = true;
        setScanStatus("uploading");
        setStatusMessage("Đã giữ đúng vị trí. Đang gửi ảnh về máy tính...");

        try {
            if (!drawVideoFrame(video, canvas)) {
                throw new Error("Camera chưa sẵn sàng để chụp");
            }

            const videoTrack = streamRef.current?.getVideoTracks()[0];
            const highResolutionBlob = videoTrack
                ? await takeHighResolutionPhoto(videoTrack)
                : null;
            const imageBlob = highResolutionBlob
                ?? await canvasToBlob(canvas, 1);
            const captureSource = highResolutionBlob
                ? "ảnh tĩnh độ phân giải cao"
                : `khung video ${video.videoWidth}×${video.videoHeight}`;
            const imageFile = new File(
                [imageBlob],
                `auto-scan-${Date.now()}.jpg`,
                { type: imageBlob.type || "image/jpeg" }
            );
            const validationData = new FormData();
            validationData.append("file", imageFile, imageFile.name);
            validationData.append("templateId", templateId);

            // Frame dùng để tìm marker và ảnh tĩnh cuối cùng không hoàn toàn
            // giống nhau. Kiểm tra lại đúng file sắp gửi để tránh camera mất
            // nét đúng thời điểm takePhoto()/canvas chụp ảnh.
            const validationResponse = await fetch(
                `/api/capture-sessions/${sessionId}/detect-markers`,
                {
                    method: "POST",
                    body: validationData,
                    cache: "no-store",
                }
            );
            const validationResult: IMarkerDetectionResponse = (
                await validationResponse.json()
            );

            if (validationResponse.status === 404) {
                stopCamera();
                onSessionExpired();
                return;
            }

            if (!validationResponse.ok) {
                throw new Error(
                    validationResult.detail
                    ?? "Không kiểm tra được độ nét của ảnh chụp"
                );
            }

            if (!isCaptureQualityReady(validationResult)) {
                throw new Error(
                    `Ảnh chụp cuối vẫn bị mờ (${Math.round(validationResult.quality.sharpness)}/${MIN_SHARPNESS}). Giữ yên để camera lấy nét lại.`
                );
            }

            const formData = new FormData();
            formData.append("file", imageFile, imageFile.name);

            const response = await fetch(
                `/api/capture-sessions/${sessionId}/images`,
                {
                    method: "POST",
                    body: formData,
                }
            );
            const result = await response.json();

            if (response.status === 404) {
                stopCamera();
                onSessionExpired();
                return;
            }

            if (!response.ok) {
                throw new Error(result.detail ?? "Không gửi được ảnh");
            }

            setUploadedCount((count) => count + 1);
            waitingForRemovalRef.current = true;
            missingFramesRef.current = 0;
            previousPointsRef.current = null;
            stableFramesRef.current = 0;
            setStableProgress(100);
            setScanStatus("waiting-removal");
            setStatusMessage(
                `Đã gửi ${captureSource}. Lấy phiếu cũ ra để quét phiếu tiếp theo.`
            );
        } catch (error) {
            captureLockedRef.current = false;
            resetTracking();
            setScanStatus("error");
            setStatusMessage(
                error instanceof Error
                    ? error.message
                    : "Không gửi được ảnh tự động"
            );
        }
    }, [onSessionExpired, resetTracking, sessionId, stopCamera, templateId]);

    const processDetection = useCallback((
        result: IMarkerDetectionResponse
    ) => {
        const points = result.normalizedPoints;
        const nextCornerState = {
            topLeft: points.topLeft !== null,
            topRight: points.topRight !== null,
            bottomLeft: points.bottomLeft !== null,
            bottomRight: points.bottomRight !== null,
        };
        setCornerState(nextCornerState);

        if (waitingForRemovalRef.current) {
            // Chỉ cần phiếu rời khỏi vị trí nhận diện đủ lâu. Không bắt buộc
            // phải mất cả bốn marker vì khi giáo viên đổi phiếu nhanh, camera
            // thường vẫn nhìn thấy hai hoặc ba marker ở khung hình chuyển tiếp.
            if (!result.detected) {
                missingFramesRef.current += 1;
            } else {
                missingFramesRef.current = 0;
            }

            if (missingFramesRef.current >= REQUIRED_MISSING_FRAMES) {
                waitingForRemovalRef.current = false;
                captureLockedRef.current = false;
                resetTracking();
                setCornerState(EMPTY_CORNERS);
                setScanStatus("searching");
                setStatusMessage(
                    "Sẵn sàng. Đưa phiếu tiếp theo vào khung và giữ yên."
                );
            }

            return;
        }

        if (!result.detected) {
            resetTracking();
            setScanStatus("searching");
            setStatusMessage(
                `Đã thấy ${result.markerCount}/4 marker. Căn lại phiếu vào bốn góc.`
            );
            return;
        }

        if (!result.geometry.valid) {
            resetTracking();
            setScanStatus("aligning");
            setStatusMessage("Đã đủ marker nhưng phiếu đang lệch. Căn thẳng lại phiếu.");
            return;
        }

        const qualityReady = isCaptureQualityReady(result);

        if (!qualityReady) {
            resetTracking();
            setScanStatus("aligning");
            setStatusMessage(
                result.quality.brightness < MIN_BRIGHTNESS
                    ? "Ảnh đang tối. Bổ sung ánh sáng rồi giữ yên."
                    : result.quality.brightness > MAX_BRIGHTNESS
                        ? "Ảnh đang bị chói. Đổi góc camera rồi thử lại."
                        : `Ảnh đang mờ (${Math.round(result.quality.sharpness)}/${MIN_SHARPNESS}). Giữ yên và chờ camera lấy nét.`
            );
            return;
        }

        const currentPoints = [
            points.topLeft,
            points.topRight,
            points.bottomRight,
            points.bottomLeft,
        ];

        if (currentPoints.some((point) => point === null)) {
            resetTracking();
            return;
        }

        const validCurrentPoints = currentPoints as NormalizedPoint[];
        const previousPoints = previousPointsRef.current;

        if (previousPoints === null) {
            stableFramesRef.current = 1;
        } else {
            const movement = calculateMovement(
                previousPoints,
                validCurrentPoints
            );

            stableFramesRef.current = (
                movement <= MAX_NORMALIZED_MOVEMENT
                    ? stableFramesRef.current + 1
                    : 1
            );
        }

        previousPointsRef.current = validCurrentPoints;

        const progress = Math.min(
            stableFramesRef.current / REQUIRED_STABLE_FRAMES * 100,
            100
        );
        setStableProgress(progress);
        setScanStatus("stabilizing");
        setStatusMessage(
            `Đã đủ 4 marker. Giữ yên... ${Math.round(progress)}%`
        );

        if (
            stableFramesRef.current >= REQUIRED_STABLE_FRAMES
            && !captureLockedRef.current
        ) {
            void uploadCurrentFrame();
        }
    }, [resetTracking, uploadCurrentFrame]);

    useEffect(() => {
        if (!isScanning || !scanActiveRef.current) {
            return;
        }

        let cancelled = false;

        const detectNextFrame = async () => {
            if (
                cancelled
                || !scanActiveRef.current
                || detectionRunningRef.current
            ) {
                return;
            }

            const video = videoRef.current;
            const canvas = frameCanvasRef.current;

            if (!video || !canvas || video.readyState < 2) {
                detectionTimerRef.current = window.setTimeout(
                    detectNextFrame,
                    DETECTION_INTERVAL_MS
                );
                return;
            }

            detectionRunningRef.current = true;

            try {
                if (!drawVideoFrame(video, canvas)) {
                    return;
                }

                const frameBlob = await canvasToBlob(canvas, 0.62);
                const frameFile = new File(
                    [frameBlob],
                    "marker-frame.jpg",
                    { type: "image/jpeg" }
                );
                const formData = new FormData();
                formData.append("file", frameFile, frameFile.name);
                formData.append("templateId", templateId);

                const response = await fetch(
                    `/api/capture-sessions/${sessionId}/detect-markers`,
                    {
                        method: "POST",
                        body: formData,
                        cache: "no-store",
                    }
                );
                const result: IMarkerDetectionResponse = await response.json();

                if (response.status === 404) {
                    stopCamera();
                    onSessionExpired();
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        result.detail ?? "Không nhận diện được marker"
                    );
                }

                processDetection(result);
            } catch (error) {
                resetTracking();
                setScanStatus("error");
                setStatusMessage(
                    error instanceof Error
                        ? error.message
                        : "Mất kết nối với bộ nhận diện marker"
                );
            } finally {
                detectionRunningRef.current = false;

                if (!cancelled && scanActiveRef.current) {
                    detectionTimerRef.current = window.setTimeout(
                        detectNextFrame,
                        DETECTION_INTERVAL_MS
                    );
                }
            }
        };

        void detectNextFrame();

        return () => {
            cancelled = true;

            if (detectionTimerRef.current !== null) {
                window.clearTimeout(detectionTimerRef.current);
                detectionTimerRef.current = null;
            }
        };
    }, [
        isScanning,
        onSessionExpired,
        processDetection,
        resetTracking,
        sessionId,
        stopCamera,
        templateId,
    ]);

    const startCamera = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setScanStatus("unsupported");
            setStatusMessage(
                "Trình duyệt chưa cho phép camera trực tiếp. Hãy dùng HTTPS hoặc chụp thủ công bên dưới."
            );
            return;
        }

        setScanStatus("starting");
        setStatusMessage("Đang mở camera sau...");

        try {
            const queryTemplateId = new URLSearchParams(
                window.location.search
            ).get("templateId")?.trim();

            setTemplateId(queryTemplateId || "template-000");

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: REQUEST_WIDTH },
                    height: { ideal: REQUEST_HEIGHT },
                    aspectRatio: { ideal: REQUEST_WIDTH / REQUEST_HEIGHT },
                    frameRate: { ideal: 24, max: 30 },
                },
            });
            const videoTrack = stream.getVideoTracks()[0];

            if (!videoTrack) {
                throw new Error("Không tìm thấy camera sau");
            }

            // Ưu tiên chi tiết văn bản/ô tô thay vì tối ưu luồng cho chuyển
            // động như video thông thường. Trình duyệt không hỗ trợ sẽ bỏ qua.
            if ("contentHint" in videoTrack) {
                videoTrack.contentHint = "detail";
            }

            await applyCameraQualityConstraints(videoTrack);
            const video = videoRef.current;

            if (!video) {
                stream.getTracks().forEach((track) => track.stop());
                throw new Error("Không tạo được màn hình camera");
            }

            streamRef.current = stream;
            video.srcObject = stream;
            await video.play();

            const trackSettings = videoTrack.getSettings();
            const actualWidth = video.videoWidth || trackSettings.width || 0;
            const actualHeight = video.videoHeight || trackSettings.height || 0;
            const resolutionText = actualWidth > 0 && actualHeight > 0
                ? `${actualWidth}×${actualHeight}`
                : "không xác định";

            setCameraResolution(resolutionText);
            scanActiveRef.current = true;
            setIsScanning(true);
            captureLockedRef.current = false;
            waitingForRemovalRef.current = false;
            resetTracking();
            setScanStatus("searching");
            setStatusMessage(
                `Camera ${resolutionText}. Đưa đủ bốn marker vào khung.`
            );
        } catch (error) {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            scanActiveRef.current = false;
            setIsScanning(false);
            setScanStatus("error");
            setStatusMessage(
                error instanceof Error
                    ? error.message
                    : "Không mở được camera sau"
            );
        }
    };

    useEffect(() => () => {
        scanActiveRef.current = false;

        if (detectionTimerRef.current !== null) {
            window.clearTimeout(detectionTimerRef.current);
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
    }, []);

    const isCameraVisible = ![
        "inactive",
        "unsupported",
    ].includes(scanStatus);
    const allCornersDetected = Object.values(cornerState).every(Boolean);

    const cornerClassName = (corner: CornerName) => {
        const positionClass = {
            topLeft: "left-4 top-4 border-l-4 border-t-4",
            topRight: "right-4 top-4 border-r-4 border-t-4",
            bottomLeft: "bottom-4 left-4 border-b-4 border-l-4",
            bottomRight: "bottom-4 right-4 border-b-4 border-r-4",
        }[corner];
        const colorClass = cornerState[corner]
            ? "border-emerald-400 bg-emerald-400/10"
            : "border-rose-300 bg-black/5";

        return `absolute h-20 w-20 rounded-lg transition-colors ${positionClass} ${colorClass}`;
    };

    return (
        <section className="mb-5 rounded-3xl border border-rose-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                        <ScanLine size={20} className="text-[#9f3f50]" />
                        Quét tự động
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {templateId
                            ? `Mẫu ${templateId}: `
                            : ""}
                        tự chụp khi đủ 4 marker và phiếu đứng yên.
                    </p>
                    {cameraResolution && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                            Luồng camera: {cameraResolution} · lọc ảnh mờ đang bật
                        </p>
                    )}
                </div>

                {uploadedCount > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Đã gửi {uploadedCount}
                    </span>
                )}
            </div>

            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-950">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${isCameraVisible ? "block" : "hidden"
                        }`}
                />

                {!isCameraVisible && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                        <Camera size={46} className="mb-4 text-rose-200" />
                        <strong>Camera quét phiếu</strong>
                        <span className="mt-2 text-sm leading-6 text-slate-300">
                            Giữ điện thoại thẳng đứng và đặt trọn phiếu trong khung.
                        </span>
                    </div>
                )}

                {isCameraVisible && (
                    <div className="pointer-events-none absolute inset-0">
                        <div className={cornerClassName("topLeft")} />
                        <div className={cornerClassName("topRight")} />
                        <div className={cornerClassName("bottomLeft")} />
                        <div className={cornerClassName("bottomRight")} />

                        <div className={`absolute inset-x-12 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center text-xs font-bold text-white backdrop-blur-sm ${allCornersDetected
                            ? "bg-emerald-600/75"
                            : "bg-slate-900/65"
                            }`}>
                            {allCornersDetected
                                ? "Đủ 4 marker — giữ yên"
                                : "Căn 4 marker vào 4 góc"}
                        </div>
                    </div>
                )}
            </div>

            <canvas ref={frameCanvasRef} className="hidden" />

            <div className="mt-3 rounded-xl bg-rose-50/70 px-3 py-3">
                <div className="flex items-start gap-2 text-sm text-slate-700">
                    {scanStatus === "uploading" || scanStatus === "starting" ? (
                        <LoaderCircle
                            size={18}
                            className="mt-0.5 shrink-0 animate-spin text-[#9f3f50]"
                        />
                    ) : scanStatus === "waiting-removal" ? (
                        <CheckCircle2
                            size={18}
                            className="mt-0.5 shrink-0 text-emerald-600"
                        />
                    ) : (
                        <Square
                            size={16}
                            className="mt-0.5 shrink-0 text-[#9f3f50]"
                        />
                    )}
                    <span>{statusMessage}</span>
                </div>

                {scanStatus === "stabilizing" && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-100">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-[width]"
                            style={{ width: `${stableProgress}%` }}
                        />
                    </div>
                )}
            </div>

            {isCameraVisible ? (
                <button
                    type="button"
                    onClick={stopCamera}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 font-semibold text-[#8f3c4a]"
                >
                    <CameraOff size={18} />
                    Dừng quét tự động
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#9f3f50] px-4 py-3 font-semibold text-white"
                >
                    <Camera size={18} />
                    Bắt đầu quét tự động
                </button>
            )}
        </section>
    );
};

export default AutoScanCamera;
