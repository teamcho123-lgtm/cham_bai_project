import numpy as np
import cv2

def warp_paper(img_original, TL, TR, BR, BL,
               out_w=1000,
               out_h=1400,
               expand=20,
               pad=30):

    TL = np.array(TL, dtype=np.float32) + np.array([-expand, -expand])
    TR = np.array(TR, dtype=np.float32) + np.array([ expand, -expand])
    BR = np.array(BR, dtype=np.float32) + np.array([ expand,  expand])
    BL = np.array(BL, dtype=np.float32) + np.array([-expand,  expand])

    src = np.array(
        [TL, TR, BR, BL],
        dtype=np.float32
    )

    dst = np.array(
        [
            [pad, pad],
            [out_w-pad, pad],
            [out_w-pad, out_h-pad],
            [pad, out_h-pad]
        ],
        dtype=np.float32
    )

    M = cv2.getPerspectiveTransform(src, dst)

    warp = cv2.warpPerspective(
        img_original,
        M,
        (out_w, out_h)
    )

    return warp, M