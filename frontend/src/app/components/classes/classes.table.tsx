"use client";

import { DeleteTwoTone, EditFilled, EditOutlined, EditTwoTone, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, ConfigProvider, DatePicker, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Upload, message, type TablePaginationConfig, type UploadFile, } from "antd";
import {
    usePathname,
    useRouter,
    useSearchParams,
} from "next/navigation";
import { use, useState } from "react";
import ActionExamPage from "./Action-examp-class";
import handleDeleteUser from "./delete-examp-class";

interface IProps {
    classRoom: IClassRoom[];

    meta: {
        current: number,
        pageSize: number,
        total: number
    }

}

const ClassesTable = ({ classRoom, meta }: IProps) => {

    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();


    const [show, setShow] = useState<boolean>(false)

    const [defaultAllClass, setDefaultAllClass] = useState<IClassRoom[] | []>([])

    const [defaultClass, setDefaultClass] = useState<IClassRoom | null>(null)

    const onChange = (pagination: any) => {
        console.log(pagination.current)

        const params = new URLSearchParams(
            searchParams.toString()
        );

        params.set("page", pagination.current.toString());

        router.replace(`${pathname}?${params.toString()}`);
    }

    const handleClickRow = (record: IClassRoom) => {
        router.push(`/class/${record.id}`);
    };

    const handleCloseModal = () => {
        setDefaultClass(null)
        setShow(false)
    }

    const handleOpenModal = () => {
        setDefaultClass(null)
        setDefaultAllClass(classRoom)
        setShow(true)
    }

    const handleUpdateClass = (pclass: IClassRoom) => {
        setDefaultClass(pclass)
        setShow(true)
    }

    const modalCreateClass = () => {
        return (
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="m-0 text-2xl font-bold text-stone-900 md:text-3xl">Tạo danh sách lớp học</h1>
                <Button type="primary" className=" !h-11 !rounded-full !border-none !bg-[#ff7185] !px-6 !font-semibold !shadow-md hover:!bg-[#f45f76]"
                    onClick={handleOpenModal}
                >
                    TẠO DANH SÁCH LỚP HỌC MỚI
                </Button>
            </div>
        )
    }

    const columns = [
        {
            title: "ID",
            dataIndex: "id",
        },
        {
            title: "Name",
            dataIndex: "name",
        },
        {
            title: "Khối",
            dataIndex: "grade",
        },
        {
            title: "Tạo lúc",
            dataIndex: "createdAt",
        },
        {
            title: "Thao tác",
            render: (_value: any, record: IClassRoom) => (
                <Space onClick={(event) => event.stopPropagation()}>
                    <Popconfirm title="Bạn có chắc muốn xóa?" onConfirm={() => handleDeleteUser(record)}>
                        <Button>
                            <DeleteTwoTone twoToneColor="#ff0000" />
                        </Button>
                    </Popconfirm>

                    <Button onClick={() => handleUpdateClass(record)}>
                        <EditTwoTone twoToneColor="#6df5ff" />
                    </Button>
                </Space>
            ),
        }
    ];

    return (
        <>
            <main className="min-h-screen w-full bg-[#fff7f5] p-4 md:p-7">
                <div className="mx-auto w-full max-w-7xl">
                    <Card className=" overflow-hidden !rounded-2xl !border-none! shadow-[0_4px_20px_rgba(143,60,74,0.14)]" styles={{ body: { padding: 0, }, }}>
                        <Form>
                            <div className="p-5 md:p-7">
                                <Table
                                    title={modalCreateClass}
                                    rowKey="id"
                                    columns={columns}
                                    dataSource={classRoom}
                                    style={{ background: "transparent", borderRadius: "16px", }}
                                    rowClassName={() =>
                                        "cursor-pointer transition-colors"
                                    }
                                    onRow={(record) => ({
                                        onClick: () =>
                                            handleClickRow(record),
                                    })}

                                    onChange={onChange}
                                    pagination={{
                                        ...meta,
                                        showTotal: (total, range) =>
                                            `${range[0]}-${range[1]} of ${total} items`
                                    }
                                    }

                                />
                            </div>
                        </Form>
                    </Card>
                </div>
            </main>
            <ActionExamPage
                show={show}
                handleCloseModal={handleCloseModal}
                defaultAllClass={defaultAllClass}
                defaultClass={defaultClass}
            />
        </>
    );
};

export default ClassesTable;