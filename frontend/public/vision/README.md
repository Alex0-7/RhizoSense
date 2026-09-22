# Edge Vision Video Asset Placeholder

Place your simulated plant or crop canopy camera MP4 video in this folder:

```text
frontend/public/vision/plant-feed.mp4
```

### Recommended Video Specifications:
- **Filename**: `plant-feed.mp4`
- **Format**: MP4 (H.264 video codec, AAC audio or muted)
- **Resolution**: 720p (1280x720) or 1080p (1920x1080)
- **Aspect Ratio**: 16:9
- **Framerate**: 24 - 30 fps

When `plant-feed.mp4` is placed in this folder, the RhizoSense Edge Vision panel automatically detects, loops, autoplays, and displays the video stream in the dashboard. If the file is not yet provided, the panel gracefully displays a real-time simulated edge camera canopy scan with viewfinder HUD.
