# Model Weights Directory

Place your trained computer vision / plant disease detection model weights in this directory.

Supported formats:
- PyTorch: `*.pt`, `*.pth` (e.g. `best.pt` from YOLOv8 or torchvision)
- ONNX: `*.onnx` (recommended for fast edge/CPU inference)
- TensorFlow / TFLite: `*.tflite`, `*.h5`
- Qualcomm Neural Processing / Engine: `*.dlc`, `*.engine`

### Configuration
Set the path to your weights in `backend/.env` (or environment variables):
```env
RHIZOSENSE_ML_PROVIDER=real_ml
RHIZOSENSE_MODEL_PATH=backend/models/best.pt
```

Check the status via the API:
`GET /api/vision/config`
