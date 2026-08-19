"use client";

import { ArrowLeftOutlined, TeamOutlined, } from "@ant-design/icons";
import { Button, Card, Empty, Modal, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import ShowExamsCode from "../examps/examsCode";


const { Paragraph, Title } = Typography;

interface IProps {
    dataExamPeriods: IExamPeriod[];
    dataExam: IExam
    dataStudent: IExamCandidates[]
    dataAnswerSheet: IAnswerSheetTemplate;
}

const ShowSchoolExamCode = ({ dataExamPeriods, dataExam, dataStudent, dataAnswerSheet }: IProps) => {
    //KHAI BAO BIEN
    const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
    const stuRoom = dataStudent.filter((e) => e.examRoomId === dataExam.examRoomId);

    //KHAI BAO COL ATND TABLE
    const columns = [
        {
            title: 'SBD',
            dataIndex: 'sbd',
        },
        {
            title: 'Họ tên',
            dataIndex: 'studentName',
        },
        {
            title: 'Lớp',
            dataIndex: 'className',
        },
    ];

    //USEMEMO


    //SHOW MODAL
    const showListStudentModal = () => {
        return (
            <Modal
                title="Danh sách học sinh dự thi"
                open={showStudentModal}
                onCancel={() => setShowStudentModal(false)}
                footer={null}
                width={850}
            >
                <div className="mb-4 flex justify-end">
                    <Tag color="magenta" className="!m-0 !rounded-full !px-3 !py-1">
                        {stuRoom.length} học sinh
                    </Tag>
                </div>

                {stuRoom.length === 0 ? (
                    <Empty description="Chưa có học sinh trong phòng thi" />
                ) : (
                    <Table<IExamCandidates>
                        rowKey="id"
                        columns={columns}
                        dataSource={stuRoom}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 720 }}
                    />
                )}
            </Modal>
        )
    }

    return (

        <main className="min-h-screen bg-[#fff7f5] p-4 font-sans text-stone-800 md:p-7">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#8f3c4a_0%,#d75d73_55%,#ff9b8b_100%)] p-6 text-white shadow-[0_14px_35px_rgba(143,60,74,0.22)] md:p-8">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div>
                            <Space wrap className="mb-3">
                                <Tag className="!m-0 !rounded-full !border-white/40 !bg-white/90 !px-3 !text-[#8f3c4a]">
                                    {dataExamPeriods[0].name}
                                </Tag>

                                <Tag className="!m-0 !rounded-full !border-white/40 !bg-white/15 !px-3 !text-white">
                                    Khối {dataExam.gradeLevel}
                                </Tag>

                            </Space>
                            <Title level={1} className="!mb-2 !text-3xl !font-semibold !tracking-[-0.035em] !text-white md:!text-4xl">
                                {dataExamPeriods[0].name}
                            </Title>
                            <Paragraph className="!mb-0 !text-[15px] !font-normal !leading-6 !text-white/80">
                                Quản lý mã đề, đáp án và danh sách thí sinh của các phòng thi.
                            </Paragraph>
                        </div>

                        <Space wrap>
                            <Button
                                onClick={() => setShowStudentModal(true)}
                                size="large"
                                icon={<TeamOutlined />}
                                className="!h-11 !rounded-xl !border-white !bg-white !font-semibold !text-[#8f3c4a] hover:!bg-white/90"
                            >
                                Danh sách học sinh
                            </Button>

                            <Button
                                href={`/examination/${dataExamPeriods[0].id}`}
                                size="large"
                                icon={<ArrowLeftOutlined />}
                                className="!h-11 !rounded-xl !border-white/40 !bg-white/10 !font-semibold !text-white hover:!bg-white/20"
                            >
                                Quay lại phòng thi
                            </Button>
                        </Space>
                    </div>
                </section>

                <Card className="!rounded-2xl !border-pink-100 shadow-sm">
                    <ShowExamsCode
                        allCodeExams={dataAnswerSheet}
                        detailBasePath={`/examination/${dataExamPeriods[0].id}/${dataExam.id}/grading`}
                    />
                </Card>

                {showListStudentModal()}
            </div>

        </main>
    );
};

export default ShowSchoolExamCode;
