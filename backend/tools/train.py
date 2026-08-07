import argparse
import os

from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_YAML = os.path.join(BASE_DIR, "dataset", "data.yaml")


def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLOv8n cho nhận diện ô đáp án (bubble)")

    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--device", type=str, default="0")
    parser.add_argument("--patience", type=int, default=20)
    # dataset co mat do bounding box rat cao (~860 box/anh trung binh);
    # batch/workers lon hon se OOM (GPU) hoac crash paging file (Windows).
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--name", type=str, default="bubbles_yolov8n")
    parser.add_argument("--weights", type=str, default="yolov8n.pt")

    return parser.parse_args()


def main():
    args = parse_args()

    if args.resume:
        last_pt = os.path.join(BASE_DIR, "runs", "train", args.name, "weights", "last.pt")
        model = YOLO(last_pt)

        model.train(resume=True)
        return

    model = YOLO(args.weights)

    model.train(
        data=DATA_YAML,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=args.patience,
        workers=args.workers,
        project=os.path.join(BASE_DIR, "runs", "train"),
        name=args.name,
    )


if __name__ == "__main__":
    main()
