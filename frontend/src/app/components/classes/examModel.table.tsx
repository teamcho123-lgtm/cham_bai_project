"use client"

import Image from "next/image";


import { Button, Descriptions, DescriptionsProps, Form, Input, Modal, Table } from "antd";
import { ChevronDown } from "lucide-react";
import { DiffOutlined, EditTwoTone, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import ShowCreateListExamps from "../examps/action.examp";
import ShowTableExams from "../examps/exams.table";

interface ICreateExamBasic {
    id: string;
    name: string;

    classId: string;
    subjectId: string;
    teacherId: string;

    createdAt: string;
    updatedAt: string;

    examDate: string;
    durationMinutes: number;
    note: string;

    status: "draft" | "ready" | "completed";
}

interface IProps {
    classroom: IClassRoom;
    exams: IExam[] | [];
    allExam: IExam[] | [];
}

const TableModelExamps = ({ classroom, exams, allExam }: IProps) => {
    const student = classroom.students

    const items: DescriptionsProps['items'] = [
        {
            label: 'Tên lớp học',
            children: classroom.name,
        },
        {
            label: 'Lớp học',
            children: classroom.grade,
        },
        {
            label: "Số lượng học sinh",
            children: classroom.students?.length ?? 0,
        },
    ];

    const columns = [
        {
            title: "Số báo danh",
            dataIndex: "sbd",
        },
        {
            title: "Họ và tên",
            dataIndex: "name",
        },
    ];

    return (
        <div className="flex h-screen bg-[#fff0f3] font-sans">
            <main className="flex-1 flex flex-col">
                {/* Nội dung */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="bg-white rounded-3xl p-8 shadow border border-pink-100">
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Descriptions title="Thông tin lớp học" />
                            <Button icon={<EditTwoTone twoToneColor="#cfd4d3" />}
                                style={{ background: "#da8495", color: "white", width: "130px" }}>Sửa thông tin</Button>
                        </div>

                        <Descriptions items={items} /><br></br>
                        <Table rowKey={"id"}
                            columns={columns}
                            dataSource={classroom.students}
                        /><br></br>

                        <ShowTableExams
                            classroom={classroom}
                            exams={(exams as any) || null}
                            listExams={allExam ? allExam : []}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default TableModelExamps;