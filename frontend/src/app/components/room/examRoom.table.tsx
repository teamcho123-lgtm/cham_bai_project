"use client"

import { Button, Card, Col, Progress, Row, Space, Statistic, Tag } from "antd";
import { DeleteOutlined, ToolOutlined } from "@ant-design/icons";
import { ApartmentOutlined, ArrowLeftOutlined, BookOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, Paragraph, PlusOutlined, RightOutlined, SettingOutlined, TeamOutlined, Text, Title } from "../examination/examPeriodAntd";
import { useMemo, useState } from "react";
import ShowActionExamRoom from "./actionExamRoom";
import ShowDeleteExamRoom from "./deleteExamRoom";

const coverGradients: string[] = [
    "linear-gradient(135deg,#72a7ca 0%, #cfbdf0 50%, #7bbdfc 100%)",
    "linear-gradient(135deg, #113b55 0%, #b85f78 52%, #e6a0aa 100%)",
    "linear-gradient(135deg, #8f3c4a 0%, #d75d73 52%, #ff9aaa 100%)",
    "linear-gradient(135deg, #a84b55 0%, #ee7b69 52%, #ffc38e 100%)",
    "linear-gradient(135deg, #713b55 0%, #a85f78 52%, #e6a0aa 100%)",
];

type ExamRoomStatus = "ready" | "in_progress" | "completed" | "duplicate";

const roomStatusMeta: Record<ExamRoomStatus, { label: string; color: string; progress: number }> = {
    ready: { label: "Sẵn sàng", color: "blue", progress: 33 },
    in_progress: { label: "Đang thi", color: "processing", progress: 67 },
    completed: { label: "Đã kết thúc", color: "success", progress: 100 },
    duplicate: { label: "Bị trùng", color: "error", progress: 0 },
};

const normalizeRoomStatus = (status: string): ExamRoomStatus => {
    const normalizedStatus = status.trim().toLocaleLowerCase("vi");

    if (normalizedStatus === "completed" || normalizedStatus === "đã kết thúc") {
        return "completed";
    }

    if (normalizedStatus === "in_progress" || normalizedStatus === "đang thi") {
        return "in_progress";
    }

    // Dữ liệu cũ như "Sẵn sàng" và "Đã lên lịch" được xem là ready.
    return "ready";
};

interface Iprop {
    targetId: string
    dataExamPeriods: IExamPeriod[];
    dataExamRooms: IExamRoom[];
    examCandidates: IExamCandidates[];
    dataExam: IExam[]
}

const formatDate = (value?: string | Date | null) => {
    if (!value) return "";

    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleDateString("vi-VN");
};

const formatTime = (value?: string | Date | null) => {
    if (!value) return "";

    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const ShowListExamRoom = ({ targetId, dataExamPeriods, dataExamRooms, examCandidates, dataExam }: Iprop) => {

    //KHAI BÁO BIẾN
    const [showModalCreateExamRoom, setShowModalCreateExamRoom] = useState<boolean>(false)
    const [showModalDeleteExamRoom, setShowModalDeleteExamRoom] = useState<boolean>(false)
    const [defaultExamRoom, setDefaultExamRoom] = useState<IExamRoom | null>(null)
    const [targetDeleteExamRoom, setTargetDeleteExamRoom] = useState<IExamRoom | null>(null)


    //USEMEMO
    const { allExamRooms, roomGroups, allExamCandidates, sectionStyle, subCount, roomCount, statusCounts, examProgress, stCount } = useMemo(() => {

        const rooms = dataExamRooms.filter((room) => room.periodId === targetId);

        const roomIds = new Set(rooms.map((room) => room.id));

        const roomubjeccts = new Set(rooms.map((room) => room.subjects));

        const groupedRooms = new Map<number, IExamRoom[]>();

        rooms.forEach((room) => {
            const gradeRooms = groupedRooms.get(room.grade) ?? [];
            gradeRooms.push(room);
            groupedRooms.set(room.grade, gradeRooms);
        });

        const roomGroups = Array.from(groupedRooms.entries())
            .sort(([gradeA], [gradeB]) => gradeA - gradeB)
            .map(([grade, gradeRooms]) => ({ grade, rooms: gradeRooms }));

        const candidates = examCandidates.filter((candidate) =>
            roomIds.has(candidate.examRoomId)
        );

        let stCount = 0;
        let index = 0;
        while (index < candidates.length) {
            const current = candidates[index];

            const isDuplicate = candidates.some((candidate, candidateIndex) =>
                candidate.sbd === current.sbd && candidateIndex !== index
            );

            if (!isDuplicate) {
                stCount += 1;
            }

            index += 1;
        }

        const statusCounts = rooms.reduce<Record<ExamRoomStatus, number>>(
            (counts, room) => {
                counts[normalizeRoomStatus(room.status)] += 1;
                return counts;
            },
            { ready: 0, in_progress: 0, completed: 0, duplicate: 0 }
        );

        const totalProgress = rooms.reduce(
            (total, room) => total + roomStatusMeta[normalizeRoomStatus(room.status)].progress,
            0
        );

        const sectionStyle = { background: coverGradients[4] }


        return {
            allExamRooms: rooms,
            roomGroups,
            allExamCandidates: candidates,
            sectionStyle: sectionStyle,
            stCount,
            subCount: roomubjeccts.size,
            roomCount: roomIds.size,
            statusCounts,
            examProgress: rooms.length === 0 ? 0 : Math.round(totalProgress / rooms.length),
        };

    }, [dataExamRooms, examCandidates, targetId])

    //HANDLE ACTION
    const handleCloseModalActionExamRoom = () => {
        setShowModalCreateExamRoom(false)
        setDefaultExamRoom(null)
    }

    const handleOpenModalActionExamRoom = (room?: IExamRoom) => {
        setDefaultExamRoom(room ?? null)
        setShowModalCreateExamRoom(true)
    }

    const handleOpenModalDeleteExamRoom = (room: IExamRoom) => {
        setTargetDeleteExamRoom(room)
        setShowModalDeleteExamRoom(true)
    }

    const handleCloseModalDeleteExamRoom = () => {
        setShowModalDeleteExamRoom(false)
        setTargetDeleteExamRoom(null)
    }


    return (

        <main className="min-h-screen w-full bg-[#fff7f5] p-4 md:p-7">
            <div className="mx-auto w-full max-w-7xl">

                <section
                    style={sectionStyle}
                    className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-[0_14px_35px_rgba(143,60,74,0.22)] md:p-8" >
                    <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/10" />
                    <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/10" />

                    <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <Space wrap className="mb-4">
                                <Tag className="!m-0 !rounded-full !border-white/40 !bg-white/90 !px-3 !py-1 !font-semibold !text-[#8f3c4a]">
                                    {dataExamPeriods[0].type}
                                </Tag>
                                <Tag className="!m-0 !rounded-full !border-white/40 !bg-white/15 !px-3 !py-1 !text-white">
                                    {dataExamPeriods[0].status}
                                </Tag>
                            </Space>

                            <Title level={1} className="!mb-3 !text-3xl !font-bold !text-white md:!text-4xl">
                                {dataExamPeriods[0].name}
                            </Title>
                            <Paragraph className="!mb-5 !max-w-2xl !text-base !leading-7 !text-white/80">
                                {dataExamPeriods[0].description || "Theo dõi lịch thi, phòng thi và danh sách thí sinh trong kỳ thi."}
                            </Paragraph>

                            <Space size={[20, 10]} wrap>
                                <span><CalendarOutlined className="mr-2" />
                                    {formatDate(dataExamPeriods[0].startDate)} - {formatDate(dataExamPeriods[0].endDate)}
                                </span>
                                <span><BookOutlined className="mr-2" />
                                    Học kỳ {dataExamPeriods[0].semester}
                                </span>
                                <span><TeamOutlined className="mr-2" />
                                    Khối {dataExamPeriods[0].gradeLevels.join(", ")}
                                </span>
                            </Space>
                        </div>

                        <Space wrap>
                            <Button
                                href="/examination"
                                size="large"
                                icon={<ArrowLeftOutlined />}
                                className="!h-11 !rounded-xl !border-white/40 !bg-white/10 !font-semibold !text-white hover:!bg-white/20"
                            >
                                Quay lại
                            </Button>
                            <Button
                                size="large"
                                icon={<SettingOutlined />}
                                className="!h-11 !rounded-xl !border-none !font-semibold !text-[#8f3c4a]"
                            >
                                Cài đặt kỳ thi
                            </Button>
                        </Space>
                    </div>
                </section>

                <Row gutter={[16, 16]} className="mb-6">
                    <Col xs={24} sm={12} xl={6}>
                        <Card className="h-full !rounded-2xl !border-pink-100 shadow-sm">
                            <Statistic title="Môn thi" value={subCount} prefix={<BookOutlined className="text-[#d75d73]" />} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card className="h-full !rounded-2xl !border-pink-100 shadow-sm">
                            <Statistic title="Phòng thi" value={roomCount} prefix={<ApartmentOutlined className="text-[#d75d73]" />} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card className="h-full !rounded-2xl !border-pink-100 shadow-sm">
                            <Statistic title="Thí sinh" value={stCount} prefix={<TeamOutlined className="text-[#d75d73]" />} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card className="h-full !rounded-2xl !border-pink-100 shadow-sm">
                            <Statistic title="Đã lên lịch" value={statusCounts.ready} prefix={<CheckCircleOutlined className="text-[#d75d73]" />} />
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[20, 20]} align="stretch">
                    <Col xs={24} xl={17}>
                        <Card
                            className="h-full !rounded-2xl !border-pink-100 shadow-sm"
                            title={
                                <div>
                                    <Title level={4} className="!mb-0 !text-[#8f3c4a]">Ca thi và phòng thi</Title>
                                    <Text type="secondary" className="!font-normal">Danh sách phòng đã được sử dụng trong kỳ thi này</Text>
                                </div>
                            }
                            extra={
                                <Button
                                    onClick={() => handleOpenModalActionExamRoom()}
                                    type="primary" icon={<PlusOutlined />} className="!rounded-lg !border-none !bg-[#8f3c4a]">
                                    Thêm ca thi
                                </Button>
                            }
                        >

                            {/* <Empty description="Chưa có ca thi hoặc phòng thi nào" /> */}

                            {roomGroups.map(({ grade, rooms }) => (
                                <section key={grade} className="mb-6 last:mb-0">
                                    <div className="mb-3 flex items-center justify-between border-b border-pink-100 pb-2">
                                        <Title level={5} className="!mb-0 !text-[#8f3c4a]">
                                            Khối {grade}
                                        </Title>
                                        <Tag color="magenta" className="!m-0 !rounded-full">
                                            {rooms.length} phòng
                                        </Tag>
                                    </div>
                                    <Row gutter={[16, 16]}>

                                        {rooms.map((e) => (

                                            <Col xs={24} md={12} className="!flex" key={e.id}>
                                                <Card
                                                    hoverable
                                                    className="h-full w-full !rounded-2xl !border-[#f6d9df] !bg-[#fffafb]"
                                                    styles={{ body: { display: "flex", height: "100%", flexDirection: "column", padding: 20 } }}
                                                >
                                                    <div className="mb-4 flex items-start justify-between gap-3">
                                                        <Space align="start">
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe7eb] text-xl text-[#8f3c4a]">
                                                                <ApartmentOutlined />
                                                            </div>
                                                            <div>
                                                                <Title level={5} className="!mb-0 !text-stone-800">
                                                                    {e.name}  -  <span className="font-semibold text-stone-700"> Lớp {e.grade}</span>
                                                                </Title>
                                                                <Text type="secondary">
                                                                    {e.subjects || "Chưa chọn môn"}
                                                                </Text>
                                                            </div>
                                                        </Space>
                                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                                            <Space size={8}>
                                                                <Button
                                                                    onClick={() => handleOpenModalActionExamRoom(e)}
                                                                    type="text"
                                                                    shape="circle"
                                                                    icon={<ToolOutlined />}
                                                                    title="Sửa phòng thi"
                                                                    aria-label={`Sửa phòng thi ${e.name}`}
                                                                    className="!bg-white !text-[#8f3c4a] !shadow-sm hover:!bg-[#fff0f2]"
                                                                />
                                                                <Button
                                                                    onClick={() => handleOpenModalDeleteExamRoom(e)}
                                                                    type="text"
                                                                    shape="circle"
                                                                    icon={<DeleteOutlined />}
                                                                    title="Xóa phòng thi"
                                                                    aria-label={`Xóa phòng thi ${e.name}`}
                                                                    className="!bg-white !shadow-sm hover:!bg-red-50"
                                                                />
                                                            </Space>
                                                            <Tag
                                                                color={roomStatusMeta[normalizeRoomStatus(e.status)].color}
                                                                className="!m-0 !rounded-full"
                                                            >
                                                                {roomStatusMeta[normalizeRoomStatus(e.status)].label}
                                                            </Tag>
                                                        </div>
                                                    </div>

                                                    <div className="mb-5 grid grid-cols-2 gap-3">
                                                        <div className="rounded-xl bg-white p-3">
                                                            <Text type="secondary" className="!text-xs">Ngày thi</Text>
                                                            <div className="mt-1 font-semibold text-stone-700">
                                                                <CalendarOutlined className="mr-2 text-[#d75d73]" />
                                                                {formatDate(e.startAt)}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-xl bg-white p-3">
                                                            <Text type="secondary" className="!text-xs">Bắt đầu</Text>
                                                            <div className="mt-1 font-semibold text-stone-700">
                                                                <ClockCircleOutlined className="mr-2 text-[#d75d73]" />
                                                                {formatTime(e.startAt)} - {formatTime(
                                                                    e.startAt
                                                                        ? new Date(new Date(e.startAt).getTime() + e.durationMinutes * 60 * 1000)
                                                                        : null
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mb-4 flex items-center justify-between text-sm">
                                                        <span className="text-stone-500"><TeamOutlined className="mr-2" />
                                                            {/* {roomCandidateCount} thí sinh */}
                                                        </span>
                                                        <span className="text-stone-500">
                                                            {e.durationMinutes} phút
                                                        </span>
                                                    </div>

                                                    <Button
                                                        href={`/examination/${targetId}/${e.examId}`}
                                                        block
                                                        icon={<RightOutlined />}
                                                        className="!mt-auto !h-10 !rounded-xl !border-[#d75d73] !font-semibold !text-[#8f3c4a]"
                                                    >
                                                        Quản lý phòng thi
                                                    </Button>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                </section>
                            ))}
                        </Card>
                    </Col>

                    <Col xs={24} xl={7}>
                        <Space orientation="vertical" size={20} className="w-full">


                            <Card
                                title={<span className="font-semibold text-[#8f3c4a]">Tiến độ kỳ thi</span>}
                                className="!rounded-2xl !border-pink-100 shadow-sm"
                            >
                                <Progress
                                    percent={examProgress}
                                    strokeColor="#d75d73"
                                    railColor="#fde8ec"
                                />
                                <div className="mt-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Text type="secondary">Sẵn sàng</Text>
                                        <Tag color="blue">{statusCounts.ready} phòng</Tag>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Text type="secondary">Đang thi</Text>
                                        <Tag color="processing">{statusCounts.in_progress} phòng</Tag>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Text type="secondary">Đã kết thúc</Text>
                                        <Tag color="success">{statusCounts.completed} phòng</Tag>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Text type="secondary">Bị trùng lịch</Text>
                                        <Tag color="error">{statusCounts.duplicate} phòng</Tag>
                                    </div>
                                </div>
                            </Card>
                        </Space>
                    </Col>
                </Row>

                {showModalCreateExamRoom && (
                    <ShowActionExamRoom
                        show={showModalCreateExamRoom}
                        handleClose={handleCloseModalActionExamRoom}
                        dataExam={dataExam}
                        dataExamRooms={dataExamRooms}
                        dataExamPeriods={dataExamPeriods}
                        examCandidates={examCandidates}
                        defaultExamRoom={defaultExamRoom}
                    />
                )}
                <ShowDeleteExamRoom
                    show={showModalDeleteExamRoom}
                    handleClose={handleCloseModalDeleteExamRoom}
                    targetExamRoom={targetDeleteExamRoom}
                />
            </div>
        </main >
    );
}
export default ShowListExamRoom
