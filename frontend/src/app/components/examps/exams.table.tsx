"use client"

import React, { useState } from 'react';
import { DeleteTwoTone, EditOutlined, EditTwoTone, EllipsisOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Descriptions, Flex, Image, Switch } from 'antd';
import ShowActionListExamps from './action.examp';
import HandleDeleteExams from './delete.exam';
import { useRouter } from 'next/navigation';

interface IExamBasic {
    id: string;
    name: string;

    classId: string;
    subjectId: string;
    teacherId: string;
    templateId: string;

    createdAt: string;
    updatedAt: string;

    examDate: string;
    durationMinutes: number;
    note: string;

    status: "draft";
}

interface IProps {
    classroom: IClassRoom;
    exams: IExamBasic;
    listExams: IExam[] | [];
}

const templates = [
    {
        id: "template-000",
        name: "Mẫu App5 - Phiếu OMR B",
        image: "/Image/image.png",

        mcq: 40,
        tf: 8,
        essay: 12,

        detector: "app"
    },
    {
        id: "template-001",
        name: "Mẫu App1 - THPT Quốc Gia",
        image: "/Image/image1.png",

        mcq: 40,
        tf: 8,
        essay: 6,

        detector: "app1" // file xử lý
    },

    {
        id: "template-002",
        name: "Mẫu App2 - Đánh Giá Năng Lực",
        image: "/Image/image2.png",

        mcq: 24,
        tf: 6,
        essay: 16,

        detector: "app2"
    },

    {
        id: "template-003",
        name: "Mẫu App3 - Cuối Kỳ",
        image: "/Image/image3.png",

        mcq: 120,
        tf: 0,
        essay: 0,

        detector: "app3"
    },

    {
        id: "template-004",
        name: "Mẫu App4 - Phiếu OMR A",
        image: "/Image/image4.png",

        mcq: 40,
        tf: 8,
        essay: 8,

        detector: "app4"
    },


];


const ShowTableExams = (props: IProps) => {
    const router = useRouter()

    const { exams, classroom, listExams } = props

    const [showExamp, setShowExamp] = useState<boolean>(false)

    const [selectedExam, setSelectedExam] = useState<IExamBasic | null>(null);

    const [showModalDelete, setShowModalDelete] = useState<boolean>(false)

    const handleCloseModelDelete = () => {
        setShowModalDelete(false)
    }

    const handleCloseExamp = () => {

        setSelectedExam(null);
        setShowExamp(false)
    }

    const handleOpenUpdate = (exam: IExamBasic) => {
        setSelectedExam(exam);
        setShowExamp(true);
    };

    const handleOpenDeleteModel = (exam: IExamBasic) => {
        setSelectedExam(exam);
        setShowModalDelete(true)
    };

    const handleClickRow = (record: IExam) => {
        router.push(`/class/${record.id}/exams`);
    };



    // console.log(typeof (listExams))
    console.log(selectedExam)
    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", }}>
                <Button icon={<PlusOutlined />}
                    style={{ background: "#97616c", color: "white" }}
                    onClick={() => setShowExamp(true)}>Thêm danh đọt thi</Button>
            </div>
            <Flex gap="medium" align="start" vertical>
                <br></br>
                <Descriptions title="Danh sách đợt thi " />

                {(Array.isArray(exams) ? exams : [exams]).map((e, index) => {
                    const templateSelected = templates.find(
                        (temp) => temp.id === e.templateId
                    );
                    return (
                        <Card actions={[
                            <EditTwoTone
                                key="edit"
                                twoToneColor="#e236a0"
                                onClick={() => handleOpenUpdate(e)}
                            />,
                            <DeleteTwoTone
                                key="delete"
                                twoToneColor="#d80000"
                                onClick={() => handleOpenDeleteModel(e)}
                            />,

                            <SettingOutlined
                                key="setting"
                                style={{ color: "#961e00" }}
                                onClick={() => handleClickRow(e)}
                            />]}


                            key={e.id || index}
                            style={{ width: "100%" }}
                        >
                            <Card.Meta
                                avatar={<Image width={70} height={100} src={templateSelected?.image} />}
                                style={{ display: "flex" }}
                                title={e.name}
                                description={
                                    <div>
                                        <p>
                                            Sử dụng mẫu phiếu trắc nghiệm -{" "}{templateSelected?.name}
                                        </p>

                                        <p>Ngày tạo: {e.createdAt}</p>
                                    </div>
                                }
                            />
                        </Card>
                    );
                })}

            </Flex>
            <ShowActionListExamps
                show={showExamp}
                handleClose={handleCloseExamp}
                classroom={classroom}
                listDefaultExams={selectedExam ? selectedExam : null}
                listAllExamps={listExams ? listExams : []}
            />
            <HandleDeleteExams
                show={showModalDelete}
                handleClose={handleCloseModelDelete}
                listDefaultExams={selectedExam ? selectedExam : null}
            />
        </>
    );
}

export default ShowTableExams;