import json
import cv2

# ==========================
# ĐỌC ĐÁP ÁN ĐÃ LƯU
# ==========================

with open("answers.json", "r", encoding="utf-8") as f:
    exams = json.load(f)


# ==========================
# TẠM THỜI LẤY MÃ ĐỀ
# sau này OCR đọc từ phiếu
# ==========================

# md = ""

# answer_key = exams.get(md)

# if answer_key is None:
#     print("Không tìm thấy mã đề:", md)
#     exit()
detector = "app4"


# ==========================
# CHỌN DETECTOR
# ==========================

# detector = answer_key["detector"]

# print("Detector:", detector)


if detector == "app1":

    import app1
    result = app1.detect()

elif detector == "app2":

    import app2
    result = app2.detect()

elif detector == "app3":

    import app3
    result = app3.detect()

elif detector == "app4":

    import app4
    result = app4.detect()

elif detector == "app5":

    import app5
    result = app5.detect()

else:

    print("Không có detector")
    exit()


# ==========================
# LẤY KẾT QUẢ OCR
# ==========================

sbd = result["sbd"]

md = result["md"]

mcq_answer = result["mcq"]

tf_answer = result["tf"]

essay_answer = result["essay"]

print("SBD:", sbd)
print("Mã đề:", md)


tong_diem = 0


# ==========================
# PHẦN 1 TRẮC NGHIỆM
# ==========================

correct_questions_part1 = []
wrong_questions_part1 = []

for q, ans in mcq_answer.items():

    if ans == answer_key["mcq"].get(str(q)):

        correct_questions_part1.append(q)

    else:

        wrong_questions_part1.append(q)


print("====== PART1 ======")

print("Đúng:", correct_questions_part1)

print("Sai:", wrong_questions_part1)


# ==========================
# PHẦN 2 ĐÚNG SAI
# ==========================

correct_tf = []

wrong_tf = []

for q in range(
    1,
    len(answer_key["tf"]) + 1
):

    data = answer_key["tf"][str(q)]

    expected = []

    for choice in ['a', 'b', 'c', 'd']:

        expected.append(

            f"{q}Đ"

            if data.get(choice, False)

            else f"{q}S"

        )

    start = (q - 1) * 4

    user = tf_answer[start:start + 4]

    if user == expected:

        correct_tf.append(q)

    else:

        wrong_tf.append(q)


print("====== PART2 ======")

print("Đúng:", correct_tf)

print("Sai:", wrong_tf)


# ==========================
# PHẦN 3 TỰ LUẬN
# ==========================

correct_essay = []

wrong_essay = []

for i, ans in enumerate(
    essay_answer,
    start=1
):

    right_ans = answer_key["essay"].get(str(i))

    if str(ans).strip() == str(right_ans).strip():

        correct_essay.append(i)

    else:

        wrong_essay.append(i)


print("====== PART3 ======")

print("Đúng:", correct_essay)

print("Sai:", wrong_essay)


# ==========================
# TÍNH Ý ĐÚNG PHẦN ĐÚNG SAI
# ==========================

so_y_dung = 0

for q in range(
    1,
    len(answer_key["tf"]) + 1
):

    data = answer_key["tf"][str(q)]

    expected = []

    for choice in ['a', 'b', 'c', 'd']:

        expected.append(

            f"{q}Đ"

            if data.get(choice, False)

            else f"{q}S"

        )

    start = (q - 1) * 4

    user = tf_answer[start:start+4]

    for i in range(4):

        if i < len(user):

            if user[i] == expected[i]:

                so_y_dung += 1


print("Số ý đúng:", so_y_dung)


# ==========================
# TÍNH ĐIỂM
# ==========================

diem_part1 = len(correct_questions_part1) * 0.25

diem_part2 = so_y_dung * 0.25

diem_part3 = len(correct_essay) * 0.5


tong_diem = (

    diem_part1

    + diem_part2

    + diem_part3

)


print("=====================")

print("Điểm phần 1:", diem_part1)

print("Điểm phần 2:", diem_part2)

print("Điểm phần 3:", diem_part3)

print("TỔNG ĐIỂM:", round(tong_diem,2))

print("=====================")