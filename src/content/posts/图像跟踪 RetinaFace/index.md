---
title: 图像跟踪-RetinaFace
published: 2026-10-11
tags:
  - OpenCV
  - Python
  - 机器学习
  - 深度学习
category: 开发笔记
description: https://github.com/biubug6/Pytorch_Retinaface/tree/master
---
# [参考项目:github.com/biubug6/Pytorch_Retinaface](https://github.com/biubug6/Pytorch_Retinaface/tree/master)


# 图像模型资源地址
**[rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo?utm_source=chatgpt.com)**

![](images/Pasted%20image%2020261011143034.png)
该模型的训练数据集来自于[WIDER FACE](https://complexity.cecs.ucf.edu/wider-face/)

# 原码解析

## 预处理函数 : 将opencv的接受图像处理成适合模型检测的图像
```python
def preprocess(frame: NDArray) -> tuple:  

    h, w = frame.shape[:2]  
    scale = min(SIZE / w, SIZE / h)  
  
    nw, nh = int(w * scale), int(h * scale)  
    resized = cv2.resize(frame, (nw, nh))  
  
    canvas = np.full(  
        (SIZE, SIZE, 3), 114, dtype=np.uint8  
    )  
    px = (SIZE - nw) // 2  
    py = (SIZE - nh) // 2  
    canvas[py:py + nh, px:px + nw] = resized  
  
    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)  
    data = rgb.astype(np.float32)  
    data -= np.array([104, 117, 123], dtype=np.float32)  
  
    data = data.transpose(2, 0, 1)[None]  
    return np.ascontiguousarray(data), scale, px, py
    
```

### 缩放
```python
h, w = frame.shape[:2]  
scale = min(SIZE / w, SIZE / h)  

nw, nh = int(w * scale), int(h * scale)  
resized = cv2.resize(frame, (nw, nh))  
```

opencv: 640x480 -> 320x240


### 生成画布
- 缩放之后的大小不满足模型需要的大小，那么就需要将缺失部分填充出来
- 代码上的逻辑是先生成一个320x320的“画布”再将缩放的图片“贴”上去

```python
canvas = np.full(  
	(SIZE, SIZE, 3), 114, dtype=np.uint8  
)  
px = (SIZE - nw) // 2  
py = (SIZE - nh) // 2  
canvas[py:py + nh, px:px + nw] = resized  
```

### 做适配
剩下的操作都是在做数据结构和类型的适配
主要有以下几个问题：
- cv2特有的通道分布BGR ->RGB
- cv2接受的矩阵是整数矩阵，神经网络训练的时候是浮点数矩阵
- 当时的网络训练时采取了均值化，现在送入检测的图像也应该均值化
- cv2的接收通道是`HWC` ，网络中需要接收的参数是 `NCHW`
```python
rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)  
data = rgb.astype(np.float32)  
data -= np.array([104, 117, 123], dtype=np.float32)  

data = data.transpose(2, 0, 1)[None]  
```

## 去除多重框 非极大值抑制
整套逻辑就是经典计算iou去除除置信度最高的其他的所有框，保证一个目标一个框
```python
def nms(boxes, scores: NDArray[np.intp], threshold: float=0.4) -> list[int]:  

    order: NDArray[np.intp] = scores.argsort()[::-1]  # 对索引排序  
    keep: list[int] = []  
  
    while order.size > 0:  
        i = order[0]  
        keep.append(i)  
        others = order[1:]  
  
        if others.size == 0:  
            break  
  
        # 交集的左上角点  
        xx1: int = np.maximum(boxes[i, 0], boxes[others, 0])  
        yy1: int = np.maximum(boxes[i, 1], boxes[others, 1])  
  
        # 交集的右下角点  
        xx2: int = np.minimum(boxes[i, 2], boxes[others, 2])  
        yy2: int = np.minimum(boxes[i, 3], boxes[others, 3])  
  
        # 计算交集面积  
        inter = (  
            np.maximum(0, xx2 - xx1)  
            * np.maximum(0, yy2 - yy1)  
        )  
  
        area_a = (  
            (boxes[i, 2] - boxes[i, 0])  
            * (boxes[i, 3] - boxes[i, 1])  
        )  
        area_b = (  
            (boxes[others, 2] - boxes[others, 0])  
            * (boxes[others, 3] - boxes[others, 1])  
        )  
  
        iou = inter / (area_a + area_b - inter + 1e-6)  # +1e-6防止除0报错  
        order = others[iou <= threshold]  
  
    return keep
```
## 检测函数
```python
def detect(frame: NDArray, session: ort.InferenceSession) -> list:  

    tensor, scale, px, py = preprocess(frame)  
    input_name = session.get_inputs()[0].name  
  
    outputs = session.run(None, {input_name: tensor})  
    loc, conf, _ = outputs  
  
    loc = np.asarray(loc).reshape(-1, 4)  
    conf = np.asarray(conf).reshape(-1, 2)  
  
    if len(loc) != len(PRIORS):  
        raise ValueError(  
            f"模型输出 {len(loc)} 个先验框，"  
            f"预期 {len(PRIORS)}，请检查模型版本"  
        )  
  
    scores = conf[:, 1]  
    indices = np.where(scores >= THRESHOLD)[0]  
  
    if len(indices) == 0:  
        return []  
  
    p = PRIORS[indices]  
    l = loc[indices]  
    scores = scores[indices]  
  
    centers = p[:, :2] + 0.1 * l[:, :2] * p[:, 2:]  
    sizes = p[:, 2:] * np.exp(0.2 * l[:, 2:])  
  
    boxes = np.concatenate(  
        [centers - sizes / 2, centers + sizes / 2],  
        axis=1  
    ) * SIZE  
  
    boxes[:, 0::2] = (boxes[:, 0::2] - px) / scale  
    boxes[:, 1::2] = (boxes[:, 1::2] - py) / scale  
  
    h, w = frame.shape[:2]  
    boxes[:, 0::2] = np.clip(boxes[:, 0::2], 0, w - 1)  
    boxes[:, 1::2] = np.clip(boxes[:, 1::2], 0, h - 1)  
  
    keep = nms(boxes, scores)  
  
    return [  
        (boxes[i].astype(int), float(scores[i]))  
        for i in keep  
    ]
```

### 预处理
```python
tensor, scale, px, py = preprocess(frame)  
input_name = session.get_inputs()[0].name  
```
### 推理+解析输出结果
- 运行，得到结果的数据结构
```
outputs = [
    loc_array,       # 人脸框位置偏移
    conf_array,      # 背景/人脸分类分数
    landmark_array,  # 人脸关键点坐标
]
```
- 从结果中提取先验框和置信度
- 提取检测为脸部的分数，置信度是一个2xN的数据，每行的第一个分数是判断为背景的置信度，第二个分数是判断为人脸的置信度
- 筛选置信度以上的结果，根据结果将先验框和回归量，置信度删选出来
```python
outputs = session.run(None, {input_name: tensor})  
loc, conf, _ = outputs  

loc = np.asarray(loc).reshape(-1, 4)  
conf = np.asarray(conf).reshape(-1, 2)  

scores = conf[:, 1]  
indices = np.where(scores >= THRESHOLD)[0]  

p = PRIORS[indices]  
l = loc[indices]  
scores = scores[indices]  
```
### 建框+复原
```python
centers = p[:, :2] + 0.1 * l[:, :2] * p[:, 2:]  
sizes = p[:, 2:] * np.exp(0.2 * l[:, 2:])  

boxes = np.concatenate(  
	[centers - sizes / 2, centers + sizes / 2],  
	axis=1  
) * SIZE  

boxes[:, 0::2] = (boxes[:, 0::2] - px) / scale  
boxes[:, 1::2] = (boxes[:, 1::2] - py) / scale  

h, w = frame.shape[:2]  
boxes[:, 0::2] = np.clip(boxes[:, 0::2], 0, w - 1)  
boxes[:, 1::2] = np.clip(boxes[:, 1::2], 0, h - 1)  
```