"use client";

import { BookOutlined, CalendarOutlined, DeleteOutlined, PlusOutlined, RightOutlined, ScheduleOutlined, ToolOutlined, } from "@ant-design/icons";
import { Avatar, Button, Card, Col, Modal, Row, Space, Tag, Typography, } from "antd";
import { useState } from "react";
import ShowActionExamSessionModal from "./actionExamSession";
import ShowModalDeleteExamSession from "./deleteExamSession";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const { Paragraph, Text, Title } = Typography;


const coverGradients: string[] = [
    "linear-gradient(135deg,#72a7ca 0%, #cfbdf0 50%, #7bbdfc 100%)",
    "linear-gradient(135deg, #113b55 0%, #b85f78 52%, #e6a0aa 100%)",
    "linear-gradient(135deg, #8f3c4a 0%, #d75d73 52%, #ff9aaa 100%)",
    "linear-gradient(135deg, #a84b55 0%, #ee7b69 52%, #ffc38e 100%)",
    "linear-gradient(135deg, #713b55 0%, #a85f78 52%, #e6a0aa 100%)",
];

interface Iprop {
    examPeriods: IExamPeriod[];
}

const ShowExamSession = (prop: Iprop) => {
    const { examPeriods } = prop;
    const listExamPeriods: IExamPeriod[] = Array.isArray(examPeriods) ? examPeriods : [];
    const [showModal, setShowModal] = useState<boolean>(false)
    const [targetDefaultExamSession, setTargetDefaultExamSession] = useState<IExamPeriod | null>(null)
    const [showModalDelte, setShowModalDelte] = useState<boolean>(false)

    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    //HANDLE ACTION
    const handleClose = () => {
        setShowModal(false)
        setTargetDefaultExamSession(null)
    }

    const handleCloseModalDelete = () => {
        setShowModalDelte(false)
        setTargetDefaultExamSession(null)
    }

    const handleUpdateExamSession = (prop: IExamPeriod) => {
        setShowModal(true)
        setTargetDefaultExamSession(prop)
    }

    const handleShowModalDeleteExamSession = (prop: IExamPeriod) => {
        setShowModalDelte(true)
        setTargetDefaultExamSession(prop)
    }

    const handleExamRoomRoute = (propId: any) => {
        router.push(`/examination/${propId.id}`);
    }

    return (
        <main className="min-h-screen w-full bg-[#fff7f5] p-4 md:p-7">
            <div className="mx-auto w-full max-w-7xl">
                <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <Text className="!font-semibold !uppercase !tracking-[0.18em] !text-[#d75d73]">
                            Quản lý thi tập trung
                        </Text>
                        <Title level={2} className="!mb-1 !mt-2 !text-stone-900">
                            Các kỳ thi toàn trường
                        </Title>
                        <Paragraph className="!mb-0 !text-stone-500">
                            Theo dõi kỳ thi, môn thi, phòng thi và danh sách thí sinh.
                        </Paragraph>
                    </div>

                    <Button
                        onClick={() => setShowModal(true)}
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        className="!h-11 !rounded-full !border-none !bg-[#8f3c4a] !px-6 !font-semibold !shadow-md hover:!bg-[#75313d]"
                    >
                        Tạo kỳ thi mới
                    </Button>
                </div>

                <Row gutter={[20, 20]}>
                    {listExamPeriods.map((e: IExamPeriod, index: number) => (
                        <Col xs={24} md={12} xl={8} key={e.id} className="!flex">
                            <Card
                                hoverable
                                className="!flex h-full w-full !flex-col overflow-hidden !rounded-2xl !border !border-pink-100 shadow-[0_8px_24px_rgba(143,60,74,0.10)] transition-transform hover:-translate-y-1 [&_.ant-card-cover]:shrink-0"
                                styles={{ body: { display: "flex", flex: "1 1 auto", minHeight: 280, flexDirection: "column", padding: 22, }, }}
                                cover={
                                    <div className="relative h-44 overflow-hidden p-5 text-white"
                                        style={{ background: coverGradients[index], }}
                                    >
                                        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
                                        <div className="absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-white/10" />

                                        <div className="relative z-10 flex items-start justify-between gap-3">
                                            <Avatar.Group size={40}
                                                max={{
                                                    count: 3,
                                                    style: { color: '#e26479', backgroundColor: '#fff7f5', fontWeight: "bold" },
                                                }}
                                            >
                                                {e.gradeLevels.map((eGrade: number) => (
                                                    <Avatar

                                                        key={eGrade}
                                                        className="border-2 border-white !bg-[#fff7f5] font-bold !text-[#8f3c4a]"
                                                    >
                                                        {eGrade}
                                                    </Avatar>
                                                ))}
                                            </Avatar.Group>

                                            <div className="flex flex-col items-end gap-2">
                                                <Space size={8}>
                                                    <Button
                                                        onClick={() => handleUpdateExamSession(e)}
                                                        type="text"
                                                        shape="circle"
                                                        icon={<ToolOutlined />}
                                                        title="Sửa kỳ thi"
                                                        aria-label="Sửa kỳ thi"
                                                        className="!bg-white/90 !text-[#8f3c4a] !shadow-md hover:!bg-white"
                                                    />
                                                    <Button
                                                        onClick={() => handleShowModalDeleteExamSession(e)}
                                                        type="text"
                                                        shape="circle"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        title="Xóa kỳ thi"
                                                        aria-label="Xóa kỳ thi"
                                                        className="!bg-white/90 !shadow-md hover:!bg-white"
                                                    />
                                                </Space>

                                                <Tag className="!m-0 !rounded-full !bg-white/90 !px-3 !py-1 !font-semibold !text-[#8f3c4a]">
                                                    {e.type}
                                                </Tag>
                                            </div>
                                        </div>

                                        <div className="absolute inset-x-5 bottom-5 z-10 flex items-end justify-between">
                                            <div>
                                                <Text className="!text-xs !font-medium !uppercase !tracking-wider !text-white/75"> Năm học : {e.schoolYear}</Text>
                                                <div className="mt-1 text-lg font-bold"> Học kỳ {e.semester} </div>
                                            </div>

                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm">
                                                <ScheduleOutlined />
                                            </div>
                                        </div>
                                    </div>
                                }
                            >
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <Title level={4} className="!mb-0 !text-[#8f3c4a]">
                                        {e.name}
                                    </Title>
                                    <Tag className="!m-0 !shrink-0">{e.status} </Tag>
                                </div>

                                <Paragraph className="!mb-5 !min-h-11 !text-stone-500">
                                    {e.description}
                                </Paragraph>

                                <div className="mt-auto mb-5 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-[#fff1f3] p-3">
                                        <Space size={8}>
                                            <CalendarOutlined className="text-[#d75d73]" />
                                            <div>
                                                <div className="text-xs text-stone-400"> Bắt đầu </div>
                                                <div className="text-sm font-semibold text-stone-700">  {e.startDate}</div>
                                            </div>
                                        </Space>
                                    </div>

                                    <div className="rounded-xl bg-[#fff1f3] p-3">
                                        <Space size={8}>
                                            <BookOutlined className="text-[#d75d73]" />
                                            <div>
                                                <div className="text-xs text-stone-400"> Kết thúc</div>
                                                <div className="text-sm font-semibold text-stone-700"> {e.endDate} </div>
                                            </div>
                                        </Space>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => handleExamRoomRoute(e)}
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<RightOutlined />}
                                    className="!mt-auto !h-11 !rounded-xl !border-none !bg-[#8f3c4a] !font-semibold !shadow-md hover:!bg-[#75313d]">

                                    Quản lý kỳ thi
                                </Button>
                            </Card>
                        </Col>
                    ))}


                </Row>
            </div>
            <ShowActionExamSessionModal
                show={showModal}
                handleClose={handleClose}
                allExamSession={examPeriods}
                targetDefaultExamSession={targetDefaultExamSession}
            />
            <ShowModalDeleteExamSession
                show={showModalDelte}
                handleClose={handleCloseModalDelete}
                targetDefaultExamSession={targetDefaultExamSession}
            />
        </main>

    );
};

export default ShowExamSession;
