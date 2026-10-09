# Canvas (Konva.js)

## Location
Canvas logic is located in `src/components/CanvasViewport.tsx`

## Key Patterns

### Coordinate Transforms
Be mindful of zoom/pan levels when calculating coordinates. Use:
```typescript
stage.getAbsoluteTransform().copy().invert()
```
to map mouse positions to canvas space.

### Thumbnails
Layer thumbnails are generated synchronously by resetting stage transforms.
