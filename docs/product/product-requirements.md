# OpenViz MVP - Product Requirements Document (PRD)

**Product Name:** OpenViz  
**Version:** 1.0 MVP  
**Date:** January 16, 2026  
**Target Platform:** Web (Desktop, responsive)  
**Primary Tech Stack:** React.js, Canvas/Konva.js, Tailwind CSS  

---

## 1. PRODUCT OVERVIEW

### 1.1 Vision
OpenViz is an AI-powered design application that transforms hand-sketched drawings and imported images into photorealistic renders using advanced text-to-image models. The MVP provides a fast, intuitive workflow for designers, architects, and product creators to explore design iterations visually in seconds.

### 1.2 Product Goals
1. Enable users to sketch designs and instantly generate professional renders.
2. Provide a lightweight, responsive interface optimized for creative workflow.
3. Support multiple input types (hand sketches, imported images, text descriptions).
4. Deliver an iteration-friendly environment with layer-based composition.

### 1.3 Target Users
- Product designers
- Architects and interior designers
- Concept artists
- Industrial designers
- Design students

---

## 2. FEATURE SCOPE & SPECIFICATIONS

### 2.1 Core Features (MVP-Required)

#### **Feature 1: Project Canvas (Center Viewport)**
**Purpose:** Interactive drawing and design workspace.

**Specifications:**
- **Canvas Engine:** HTML5 Canvas or Konva.js (preferred for layer support).
- **Dimensions:** Responsive to window size; initial default 1024x768px.
- **Aspect Ratios:** Support 3 preset modes:
  - Square (1:1)
  - Landscape (16:9)
  - Portrait (9:16)
- **Viewport Controls:**
  - **Zoom:** Mouse wheel to zoom in/out. Range: 10% - 500%. Default: 100%.
  - **Pan:** Right-click drag or spacebar + left-click drag to pan across infinite canvas.
  - **Reset:** Double-click canvas to center and reset zoom to 100%.
- **Visual Feedback:**
  - Grid overlay (optional toggle): Light grey grid at 10px intervals.
  - Zoom level indicator: Bottom-right corner displays current zoom percentage (e.g., "72%").
  - Canvas bounds: Subtle border outline showing drawable area.

**User Interactions:**
- Single-click to activate drawing mode on canvas.
- Escape key to deselect any active tool.

---

#### **Feature 2: Top Toolbar (Drawing Tools)**
**Purpose:** Primary input tools for creating and editing sketches.

**Layout:** Horizontal floating pill-shaped toolbar centered at the top of the viewport.

**Tools Included:**

| Tool | Icon | Shortcut | Functionality |
|------|------|----------|---------------|
| **Cursor/Select** | Arrow icon | S | Switch to selection mode (move/transform objects). |
| **Brush** | Paintbrush | B | Draw freehand lines on canvas. Supports pressure sensitivity (stylus). |
| **Eraser** | Eraser icon | E | Remove brush strokes (true eraser, not white paint). |
| **Circle/Ellipse** | Circle icon | O | Draw perfect or freeform circles and ellipses. |
| **Rectangle** | Square icon | R | Draw rectangles and squares. Hold Shift for perfect squares. |
| **Line** | Line icon | L | Draw straight lines. Hold Shift to snap to 45° angles. |
| **Symmetry** | Mirrored triangle icon | Y | Toggle symmetry mode (vertical or horizontal mirror). |
| **Undo** | Curved left arrow | Ctrl+Z | Undo last action. |
| **Redo** | Curved right arrow | Ctrl+Y | Redo last undone action. |
| **Workbench Toggle** | Grid icon | — | Switch to Workbench collaboration view (future feature, disabled in MVP). |

**Tool Properties Panel (Inline):**
When a tool is selected, display contextual options:
- **Brush:** Size (1-100px), Opacity (0-100%), Color picker (default black).
- **Eraser:** Size (1-100px).
- **Shapes:** Fill color, Stroke color, Stroke width.

**Visual Feedback:**
- Active tool is highlighted in purple/indigo.
- Hovering over a tool shows a tooltip with name and shortcut.

---

#### **Feature 3: Left Panel - Layers Manager**
**Purpose:** Manage visual hierarchy and composition of design elements.

**Layout:** Floating left sidebar (300px width). Split into two sections:

**3.1 Project Header (Top Section)**
- **File Name Display:** Current project name (editable, default: "Untitled Project").
- **Project Menu:** Dropdown button for:
  - New Project
  - Open Project
  - Save Project (local storage)
  - Export as PNG/JPG
  - Project Settings

**3.2 Layers Panel (Main Section)**

**Header:**
- Title: "Layers"
- **Add Layer Button (+):** Creates a new blank layer.

**Layer Stack:**
- **Vertical List:** Shows all layers from top to bottom (top layer = foreground).
- **Drag Handles (::):** Click and drag to reorder layers.
- **Visibility Toggle (Eye Icon):** 
  - Visible: Eye icon shown, layer renders.
  - Hidden: Eye icon with slash, layer hidden (excluded from render generation).
- **Layer Thumbnail:** 32x32px preview of layer content (auto-generated).
- **Layer Name:** Editable text field. Default names: "Layer 1", "Layer 2", etc.
- **Blend Mode & Opacity:**
  - Blend Mode: Dropdown (Normal, Multiply, Screen, Overlay). Default: Normal.
  - Opacity: Slider 0-100%. Default: 100%.
- **Layer Menu (...):** Right-click context menu:
  - Duplicate Layer
  - Delete Layer
  - Merge Down
  - Rename Layer
  - Lock/Unlock Layer

**Active Layer Indicator:**
- Selected layer has a subtle purple/blue background highlight.
- Only the active layer can be drawn on.

**Background Layer:**
- Automatically created on project startup.
- Always at the bottom of the stack.
- Cannot be deleted; can be hidden.
- Default: White fill.

**State Management:**
- Minimum 1 layer, maximum 50 layers (MVP limit).
- Layer limit warning: "You've reached the maximum layer count."

---

#### **Feature 4: Right Panel - Render Engine Controls**
**Purpose:** Configure and trigger AI-powered rendering.

**Layout:** Floating right sidebar (380px width).

**4.1 Mode Selector (Tabs)**
Two tabs at the top:
- **Render (Active in MVP):** Default tab for sketch-to-render generation.
- **Refine (Disabled/Greyed out):** Future feature for iterative refinement.

**4.2 Prompt Section**

**Label:** "Prompt" with a "Describe" link (opens AI-assisted prompt generator—future feature, disabled in MVP).

**Input Field:**
- Multi-line text area (400px height).
- Placeholder text: "Describe your design in detail... e.g., 'Minimalist line art of a trumpet with simplified geometric shapes and lines, emphasizing the instrument's beautiful tone quality...'"
- Max characters: 2000 (soft limit with warning).
- Real-time character counter: "X / 2000".

**Prompt Guidelines (Inline Help):**
- Collapsible section with best practices:
  - Start with descriptive adjectives (color, material, style).
  - Include context (setting, mood, lighting).
  - Avoid contradictions.
  - Use commas to separate concepts.

---

**4.3 Style Section**

**Palette Selector:**
- Label: "Palette"
- Dropdown showing current style preset.
- Available presets (MVP set):
  - Photorealistic
  - Sketch / Line Art
  - Cyberpunk / Neon
  - Minimalist
  - Watercolor
  - 3D Render
  - Custom (user-defined, future feature)

**Palette Value Display:** Shows preset name and opacity multiplier (e.g., "Photorealistic v2, 100%").

**Image Reference (Optional):**
- Label: "Image"
- Button: "Add..." to upload a reference image (JPG/PNG).
- Thumbnail display: 60x60px preview of uploaded image.
- Functionality: Acts as a style guide; AI uses colors and textures from reference.

---

**4.4 Drawing Influence Section**

**Label:** "Influence"

**Slider Control:**
- Range: 0.0 to 1.0 (displayed as 0% - 100%).
- Default: 100%.
- Real-time value display: "100%"

**Semantics:**
- **0% (Left):** AI ignores sketch lines; pure text-to-image generation. Icon: "🎨" (paintbrush, creative freedom).
- **50% (Middle):** Balanced influence between sketch and prompt. Icon: "⚖️" (balanced).
- **100% (Right):** AI strictly adheres to sketch lines (image2image). Icon: "📐" (technical/precise).

**Visual Feedback:**
- Slider thumb color: Purple/indigo when dragging.
- Tooltip on hover: "Controls how closely the AI follows your sketch lines."

---

**4.5 Output Settings Section**

**Label:** "Images"

**Number Selector:**
- Spinner control (up/down buttons or text input).
- Range: 1 - 4 images per generation (MVP constraint).
- Default: 1.
- Radio buttons or visual button group:
  - 1 (default)
  - 2
  - 3
  - 4 (with purple checkmark when selected)

**Tooltip:** "How many variations should OpenViz generate? (More = slower generation)."

---

**4.6 Generate Button (Primary CTA)**

**Design:**
- Full-width button at the bottom of the right panel.
- Background: Gradient purple/indigo (`#5D5FEF` to `#4A4CD9`).
- Text: White, bold, 16px.
- Padding: 16px vertical.
- Border Radius: 8px.
- Hover State: Slight brightness increase, subtle shadow.
- Active/Loading State:
  - Text: "Generating..." (animated dots: "Generating.", "Generating..", "Generating...").
  - Button disabled (greyed out, cursor: not-allowed).
  - Show progress bar overlay (0-100% completion estimate).

**On Click Behavior:**
1. Validate prompt (non-empty).
2. Flatten visible layers into a single image (base64).
3. Disable all controls (prevent duplicate requests).
4. Show loading indicator (spinning icon + "Generating...").
5. Send API request with payload:
   ```json
   {
     "prompt": "User text input",
     "init_image": "base64_encoded_canvas_image",
     "strength": "value_from_influence_slider (0.0-1.0)",
     "style_preset": "selected_palette_id",
     "num_images": 1-4
   }
   ```
6. On success: Create new layer(s) with returned image(s).
7. On error: Show error toast notification and re-enable controls.

---

#### **Feature 5: Bottom Right - Zoom & Navigation Controls**
**Purpose:** Quick viewport manipulation.

**Layout:** Floating pill-shaped button group at bottom-right corner.

**Controls:**

| Button | Icon | Function |
|--------|------|----------|
| **Fullscreen** | Expand arrow | Toggle fullscreen mode for canvas only. |
| **Fit to Screen** | Shrink/fit icon | Auto-zoom to fit entire canvas in viewport. |
| **Zoom Display** | "72%" | Current zoom level (read-only, clickable to reset to 100%). |
| **Zoom In** | Plus icon | Increase zoom by 10%. |
| **Zoom Out** | Minus icon | Decrease zoom by 10%. |
| **Help** | Question mark | Open help/documentation overlay. |

**Zoom Constraints:**
- Minimum: 10%
- Maximum: 500%
- Increment: 10%

---

#### **Feature 6: Bottom Left - History/Undo**
**Purpose:** Quick access to undo history.

**Layout:** Floating circular button at bottom-left.

**Icon:** Clock or history icon.

**Functionality (MVP):**
- Click to open a vertical timeline panel.
- Shows last 20 actions as clickable snapshots.
- Hover to preview canvas state before action.
- Click to revert to that state.
- Tooltip: "Undo History (Ctrl+H)"

---

### 2.2 Image Upload Feature

#### **Feature 7: Import Image from Disk**

**Access Point:** 
- Top toolbar "Import" button (or drag-and-drop onto canvas).

**Behavior:**
1. User clicks "Import Image" or drags a JPG/PNG file onto canvas.
2. System file picker opens (filter: *.jpg, *.jpeg, *.png, *.webp).
3. User selects file.
4. Image is placed on a new layer in the center of the canvas.
5. Layer name auto-generates: "Image 1", "Image 2", etc.
6. New layer is automatically set as active.
7. Image layer is movable and resizable using the Transform tool.

**Constraints:**
- Max file size: 20MB.
- Supported formats: JPG, PNG, WebP, SVG (raster only).
- If image exceeds canvas bounds, auto-scale to fit (maintain aspect ratio).
- If image is too small (<100px width), scale up with warning.

---

### 2.3 Data Persistence (MVP Scope)

#### **Feature 8: Local Storage & Export**

**Save to Browser:**
- Auto-save every 30 seconds to browser `localStorage`.
- Save key: `openviz_project_${timestamp}`.
- Store compressed JSON of:
  - Canvas state (dimensions, zoom level).
  - Layer stack (order, visibility, opacity, blend mode).
  - Layer pixel data (base64 encoded).
  - Project metadata (name, created date, last modified date).

**Manual Save:**
- File → Save Project (Ctrl+S).
- Prompts user for project name.
- Saves to localStorage with custom key.

**Load Project:**
- File → Open Project.
- Shows list of auto-saved and manual projects.
- Click to load.

**Export Render:**
- File → Export as PNG (or JPG).
- Downloads final canvas view (all visible layers flattened) as image file.
- Filename format: `OpenViz_Project_Name_YYYY_MM_DD_HH_MM_SS.png`.

**Project Backup:**
- Download Project (as JSON): Exports entire project state as `.openviz` file (JSON format).
- Upload Project: Import `.openviz` file to restore full project state.

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Technology Stack

**Frontend:**
- **Framework:** React 18+ with TypeScript
- **Canvas Engine:** Konva.js (layer-based rendering with transformation support)
- **State Management:** Redux Toolkit or Zustand
- **Styling:** Tailwind CSS + CSS Modules
- **UI Components:** Radix UI or Headless UI
- **HTTP Client:** Axios or Fetch API
- **Real-time:** WebSocket (future collaboration feature)

**Backend (External API):**
- **AI Model Provider:** Stability AI, OpenAI DALL-E, or Hugging Face Inference API
- **Endpoint:** `/api/generate` (text-to-image with init image)
- **Model:** Stable Diffusion XL or equivalent (supports image2image with strength parameter)

**Development Tools:**
- **Build Tool:** Vite or Create React App
- **Package Manager:** npm or yarn
- **Version Control:** Git
- **Testing:** Jest + React Testing Library
- **Code Quality:** ESLint, Prettier

---

### 3.2 Data Models

#### **Project State (Redux/Zustand Store)**

```typescript
interface Project {
  id: string;
  name: string;
  createdAt: Date;
  lastModifiedAt: Date;
  canvas: CanvasState;
  layers: Layer[];
  history: HistoryEntry[];
}

interface CanvasState {
  width: number;          // pixels
  height: number;         // pixels
  aspectRatio: 'square' | 'landscape' | 'portrait';
  zoomLevel: number;      // 0.1 to 5.0
  panX: number;
  panY: number;
  backgroundColor: string; // hex color
}

interface Layer {
  id: string;
  name: string;
  type: 'sketch' | 'image' | 'render';
  visible: boolean;
  locked: boolean;
  opacity: number;        // 0-100
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  pixelData: string;      // base64 encoded canvas data
  thumbnail: string;      // base64 encoded thumbnail
  order: number;          // z-index equivalent
  created: Date;
  modified: Date;
}

interface RenderConfig {
  prompt: string;
  palettePreset: string;
  drawingInfluence: number; // 0.0-1.0
  numImages: number;       // 1-4
  referenceImage?: string; // base64 or URL
  timestamp: Date;
}

interface HistoryEntry {
  id: string;
  action: string;
  timestamp: Date;
  snapshot: CanvasSnapshot; // lightweight state
  canvasPreview: string;    // thumbnail
}
```

#### **API Request/Response**

```typescript
interface GenerateRequest {
  prompt: string;
  init_image: string;       // base64 encoded image
  strength: number;         // 0.0-1.0 (drawing influence)
  style_preset: string;     // palette ID
  num_images: number;       // 1-4
  seed?: number;            // optional for reproducibility
}

interface GenerateResponse {
  success: boolean;
  images: string[];         // array of base64 or URLs
  timeTaken: number;        // milliseconds
  error?: string;
}
```

---

### 3.3 Component Architecture

**High-Level Component Tree:**

```
App
├── TopToolbar
│   ├── ToolButton (Brush, Eraser, Shapes, etc.)
│   └── ToolProperties
├── LeftPanel
│   ├── ProjectHeader
│   └── LayersPanel
│       ├── LayerList
│       └── LayerItem (repeating)
├── CanvasViewport
│   ├── KonvaCanvas
│   │   ├── KonvaLayer (per layer)
│   │   │   ├── KonvaRect/Circle/etc. (shapes)
│   │   │   └── KonvaImage (imported images)
│   │   └── BrushStroke (dynamic)
│   └── CanvasOverlay (grid, guides)
├── RightPanel
│   ├── ModeSelector (Render/Refine tabs)
│   ├── PromptInput
│   ├── StyleSection
│   ├── InfluenceSlider
│   ├── OutputSettings
│   └── GenerateButton
├── BottomRightControls
│   └── ZoomControls
├── BottomLeftControls
│   └── HistoryButton
└── Modal/Toast Notifications
    ├── LoadingOverlay
    ├── ErrorToast
    └── SuccessToast
```

---

### 3.4 State Management Flow

**Drawing Flow:**
```
User selects Brush Tool
  ↓
Tool state updated (Redux: toolState.active = 'brush')
  ↓
User draws on canvas (mouse down → drag → mouse up)
  ↓
Konva layer detects drawing
  ↓
Brush stroke added to active layer (Redux: layers[activeLayer].pixelData updated)
  ↓
Canvas re-renders with new stroke
  ↓
Auto-save to localStorage (debounced, 1s delay)
```

**Generation Flow:**
```
User clicks Generate button
  ↓
Validate: Check prompt non-empty, at least 1 visible layer
  ↓
Flatten visible layers to single image (canvas.toDataURL())
  ↓
Construct API payload (prompt, base64 image, influence, palette)
  ↓
Send POST request to /api/generate
  ↓
Show loading spinner, disable controls
  ↓
[API Processing: ~5-10 seconds]
  ↓
On success: Receive image URLs/base64
  ↓
Create new Layer(s) with returned image(s)
  ↓
Add to layer stack (above current active layer)
  ↓
Update localStorage
  ↓
Show success toast, re-enable controls
  ↓
Automatically set one of the new render layers as active
```

---

## 4. USER INTERFACE SPECIFICATIONS

### 4.1 Visual Design System

**Color Palette:**
- **Primary Background:** `#FFFFFF` (white canvas)
- **Panel Background:** `#1A1A1A` (dark charcoal)
- **Panel Text:** `#FFFFFF` (white)
- **Secondary Text:** `#B0B0B0` (light grey)
- **Accent Color:** `#5D5FEF` (purple/indigo) - for active states, buttons, highlights
- **Accent Hover:** `#4A4CD9` (darker purple)
- **Border:** `#333333` (dark grey)
- **Success:** `#10B981` (emerald green)
- **Error:** `#EF4444` (red)
- **Warning:** `#F59E0B` (amber)

**Typography:**
- **Font Family:** Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- **Heading Size:** 18px, bold
- **Body Size:** 14px, regular
- **Small Text:** 12px, regular
- **Monospace:** JetBrains Mono (for technical values like percentages)

**Spacing:**
- Base unit: 8px
- Padding inside panels: 16px
- Gap between elements: 8px or 16px
- Margin between sections: 24px

**Borders & Corners:**
- Border Radius (panels): 12-16px
- Border Radius (buttons): 8px
- Border Radius (inputs): 6px
- Border Width: 1px (subtle)

---

### 4.2 Responsive Design

**Breakpoints:**
- **Desktop (>1920px):** Full UI as described.
- **Laptop (1280-1919px):** Panels slightly narrower (250px left, 340px right).
- **Tablet (768-1279px):** Collapsible panels (hamburger menu). Canvas expands.
- **Mobile (<768px):** Stacked layout. Single-column. Panels overlay canvas.

**Mobile Considerations:**
- Touch-optimized brush (stylus detection not required).
- Toolbar buttons larger (44px minimum tap target).
- Layers panel becomes a modal (swipe up to open).
- Render controls become a bottom sheet.

---

### 4.3 Interaction Patterns

#### **Hover States:**
- Buttons: Brightness +10%, shadow appears.
- Layer item: Light grey background `#2A2A2A`.
- Tool icons: Purple outline.

#### **Focus States:**
- Outline: 2px solid `#5D5FEF` with 4px offset.
- Used for keyboard navigation (Tab key).

#### **Loading States:**
- Spinner animation (rotating circle, 2s duration).
- Button text changes to "Generating..." with animated ellipsis.
- Overlay semi-transparent dark layer (opacity 0.5) covers canvas during generation.

#### **Disabled States:**
- Opacity: 50%.
- Cursor: `not-allowed`.
- Color: Greyed out.

---

### 4.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **B** | Activate Brush tool |
| **E** | Activate Eraser tool |
| **R** | Activate Rectangle tool |
| **O** | Activate Circle tool |
| **L** | Activate Line tool |
| **Y** | Toggle Symmetry mode |
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Y** | Redo |
| **Ctrl/Cmd + S** | Save project |
| **Ctrl/Cmd + E** | Export as PNG |
| **Ctrl/Cmd + H** | Toggle History panel |
| **Escape** | Deselect tool / Close modal |
| **Tab** | Cycle through panels |
| **+/-** | Zoom in/out |
| **Spacebar + Drag** | Pan canvas |
| **Double-Click** | Reset zoom to 100% |
| **Shift + Shape Tool** | Constrain proportions (square/circle) |
| **Shift + Line Tool** | Snap to 45° angles |

---

## 5. FEATURE REQUIREMENTS (DETAILED)

### 5.1 Brush Engine

**Specifications:**
- **Min Brush Size:** 1px
- **Max Brush Size:** 100px
- **Hardness:** 0-100% (controls edge softness)
- **Opacity:** 0-100%
- **Color:** Hex picker (default: black `#000000`)
- **Pressure Sensitivity:** If stylus detected, apply pressure curve to opacity and size.
- **Anti-Aliasing:** Enabled (smooth brush edges).
- **Performance:** 60 FPS target for brush strokes.

**Brush Styles (Preset):**
- Round (default)
- Square
- Soft (feathered)
- Hard (sharp)

---

### 5.2 Eraser Tool

**Specifications:**
- **Mode:** True eraser (removes alpha channel, transparency).
- **Size Range:** 1-100px (same as brush).
- **Hardness:** Same controls as brush.
- **Performance:** No stroke limit; deletes pixel data on each stroke.

---

### 5.3 Shape Tools

#### **Rectangle Tool**
- Click to place start corner, click again to place end corner (or drag).
- Hold Shift during drag to constrain to square.
- Options: Fill color, stroke color, stroke width.

#### **Circle/Ellipse Tool**
- Click to place center, drag to expand radius.
- Hold Shift during drag to constrain to perfect circle.
- Same fill/stroke options as rectangle.

#### **Line Tool**
- Click start point, click end point (or drag).
- Hold Shift to snap to 0°, 45°, 90°, 135°, etc.
- Stroke color and width configurable.

---

### 5.4 Symmetry Mode

**Functionality:**
- Toggle via toolbar button or Y key.
- When active: Drawing on one side mirrors to the opposite side (vertical or horizontal).
- Mode selector: Dropdown to choose vertical or horizontal mirror.
- Visual indicator: Mirror axis line shown in faint color on canvas.
- Works with all drawing tools (brush, eraser, shapes).

---

### 5.5 Layer System

**Add Layer:**
- Click "+" in Layers panel header.
- New blank layer created at top of stack.
- Automatically named "Layer N" (next available number).

**Select Layer:**
- Click layer item in panel.
- Active layer highlighted in purple.
- Only active layer can be drawn on.
- Visual feedback: Outline of active layer shown on canvas (optional, subtle).

**Reorder Layers:**
- Drag layer item up/down in panel.
- Update z-index on canvas in real-time.
- Cannot drag background layer (stays at bottom).

**Toggle Visibility:**
- Click eye icon next to layer.
- Hidden layers do not render on canvas.
- Hidden layers excluded from AI generation (important: flattening only includes visible layers).

**Adjust Opacity:**
- Slider in layer item (0-100%).
- Real-time update: Layer transparency changes on canvas immediately.
- Stored in layer data.

**Adjust Blend Mode:**
- Dropdown in layer item.
- Options: Normal, Multiply, Screen, Overlay.
- Real-time blend mode change on canvas.
- Used for compositing effects.

**Delete Layer:**
- Right-click layer → Delete, or backspace key (when layer selected).
- Cannot delete last layer; show warning "You must have at least one layer."
- Confirmation modal: "Delete layer? This cannot be undone."

**Duplicate Layer:**
- Right-click layer → Duplicate.
- Exact copy created above original.
- Named "Layer Copy N".

**Rename Layer:**
- Double-click layer name to edit in-place.
- Press Enter to confirm, Escape to cancel.
- Max 50 characters.

**Lock/Unlock Layer:**
- Icon toggle in layer item (lock/unlock icon).
- Locked layers cannot be drawn on or modified (greyed out).
- Used to protect finished layers from accidental changes.

**Thumbnail Update:**
- Auto-generated 32x32px preview of layer content.
- Updated after each drawing action (debounced 500ms).
- Useful for quick layer identification.

---

### 5.6 Transform Tool (Move/Scale/Rotate)

**Activation:** 
- Select cursor/arrow tool from toolbar (S key).
- Or press M key.

**Interactions:**
- **Move:** Click and drag an object (image layer) to reposition.
- **Scale:** Click corner handle and drag to resize (maintains aspect ratio).
- **Rotate:** Circle handle at center of object, drag to rotate.
- **Constrain Proportions:** Hold Shift while dragging corner to maintain aspect ratio.

**Visual Feedback:**
- Bounding box with 8 resize handles (4 corners + 4 sides).
- Center rotation handle.
- Faint guidelines showing alignment.

**Double-Click Reset:**
- Double-click object to reset transform (original size, 0° rotation, original position).

---

### 5.7 Grid & Guides (Optional MVP Feature)

**Grid Toggle:**
- Top toolbar button or Ctrl+G.
- 10px grid overlay (light grey lines, low opacity).
- Snap-to-grid option: Toggle to snap all drawing to grid.

**Guides:**
- Not in MVP; listed for future enhancement.

---

## 6. RENDER GENERATION WORKFLOW

### 6.1 Pre-Generation Validation

Before sending API request:
1. **Prompt Check:** Non-empty, max 2000 chars.
2. **Canvas Check:** At least 1 visible layer with content.
3. **Influence Value:** Valid range 0.0-1.0.
4. **Images Count:** Valid range 1-4.
5. **Palette:** Valid selection from preset list.

If validation fails: Show inline error message (red text below field).

---

### 6.2 Canvas Flattening Logic

**Process:**
1. Create a temporary canvas (same dimensions as project canvas).
2. Iterate through layers from bottom to top.
3. For each visible layer:
   - Draw layer pixel data to temp canvas.
   - Apply layer opacity and blend mode.
4. Skip hidden and locked layers.
5. Export temp canvas to base64 PNG.
6. Clear temp canvas.

**Output:** Base64-encoded image string to send to API.

---

### 6.3 API Integration

**Endpoint:** `POST https://api.stability.ai/v1/generate` (example for Stability AI)

**Request Headers:**
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "User's prompt text",
  "init_image": "data:image/png;base64,iVBORw0KGgo...",
  "strength": 0.75,
  "style_preset": "photorealistic-v2",
  "samples": 1,
  "steps": 30,
  "guidance_scale": 7,
  "seed": null
}
```

**Expected Response:**
```json
{
  "artifacts": [
    {
      "base64": "iVBORw0KGgo...",
      "finish_reason": "SUCCESS"
    }
  ]
}
```

**Error Handling:**
- Network timeout (>30s): Show "Request timed out. Please try again."
- 401 Unauthorized: "API key invalid. Contact administrator."
- 429 Rate limit: "Generation queue full. Please wait a moment."
- 500 Server error: "Service temporarily unavailable. Try again later."
- Show error toast (red background, 5s duration, with retry button).

---

### 6.4 Result Layer Creation

**On Successful Generation:**
1. Convert returned base64 image to Konva Image object.
2. Create new Layer object:
   - Name: "Render 1", "Render 2", etc. (auto-incremented).
   - Type: 'render'.
   - Visible: true.
   - Position: Above currently active layer.
3. Add layer to Redux state.
4. Set new render layer as active.
5. Update canvas to display new layer.
6. Update localStorage.

**Multiple Image Handling:**
- If numImages = 4, create 4 separate layers.
- Name them "Render 1", "Render 2", "Render 3", "Render 4".
- Stack them in order (Render 1 at top).
- Only first render visible by default; others are hidden until user toggles visibility.

---

### 6.5 Post-Generation UI

**Success State:**
- Toast notification: "✓ Render generated successfully!" (green, 3s duration).
- New render layer(s) added to Layers panel.
- Layers automatically scrolled to show new render layer.
- Generate button re-enabled.

**User can now:**
- Toggle visibility between sketch and render to compare.
- Modify the render layer (paint over it, erase parts).
- Adjust opacity to blend sketch and render.
- Generate again with different prompt or influence settings.

---

## 7. FILE & PROJECT MANAGEMENT

### 7.1 Project Structure (JSON Schema)

```json
{
  "projectId": "uuid-string",
  "projectName": "My Design Project",
  "version": "1.0",
  "createdAt": "2026-01-16T10:00:00Z",
  "lastModifiedAt": "2026-01-16T10:30:00Z",
  "canvasState": {
    "width": 1024,
    "height": 768,
    "aspectRatio": "landscape",
    "zoomLevel": 1.0,
    "panX": 0,
    "panY": 0,
    "backgroundColor": "#FFFFFF"
  },
  "layers": [
    {
      "layerId": "layer-uuid-1",
      "name": "Render 1",
      "type": "render",
      "visible": true,
      "locked": false,
      "opacity": 100,
      "blendMode": "normal",
      "pixelData": "data:image/png;base64,...",
      "thumbnail": "data:image/png;base64,...",
      "order": 2,
      "createdAt": "2026-01-16T10:15:00Z",
      "modifiedAt": "2026-01-16T10:15:00Z"
    },
    {
      "layerId": "layer-uuid-2",
      "name": "Sketch Layer",
      "type": "sketch",
      "visible": true,
      "locked": false,
      "opacity": 100,
      "blendMode": "normal",
      "pixelData": "data:image/png;base64,...",
      "thumbnail": "data:image/png;base64,...",
      "order": 1,
      "createdAt": "2026-01-16T10:00:00Z",
      "modifiedAt": "2026-01-16T10:10:00Z"
    },
    {
      "layerId": "layer-uuid-3",
      "name": "Background",
      "type": "sketch",
      "visible": true,
      "locked": false,
      "opacity": 100,
      "blendMode": "normal",
      "pixelData": "data:image/png;base64,...",
      "thumbnail": "data:image/png;base64,...",
      "order": 0,
      "createdAt": "2026-01-16T10:00:00Z",
      "modifiedAt": "2026-01-16T10:00:00Z"
    }
  ],
  "history": [
    {
      "actionId": "action-uuid-1",
      "action": "draw_brush",
      "timestamp": "2026-01-16T10:05:00Z",
      "canvasPreview": "data:image/png;base64,..."
    }
  ],
  "renderHistory": [
    {
      "renderId": "render-uuid-1",
      "prompt": "Minimalist line art of a trumpet...",
      "palette": "photorealistic-v2",
      "influence": 0.75,
      "timestamp": "2026-01-16T10:15:00Z",
      "result": "data:image/png;base64,..."
    }
  ]
}
```

---

### 7.2 Save & Load

**Auto-Save:**
- Every 30 seconds to `localStorage` with key `openviz_autosave`.
- Also after major actions (layer addition, generation completion).
- Silent save (no UI notification unless error).

**Manual Save:**
- File → Save Project (Ctrl+S).
- Prompt for project name (if unnamed).
- Save to localStorage with key `openviz_project_${name}_${timestamp}`.
- Show toast: "Project saved successfully."

**Load Project:**
- File → Open Project.
- Modal showing list of all saved projects (sorted by modified date, newest first).
- Display project thumbnail, name, modified date.
- Click to load.
- Confirm if current project has unsaved changes: "You have unsaved changes. Load anyway?"

**Export Project (as JSON):**
- File → Export Project.
- Downloads `.openviz` file (JSON).
- Can be imported later to restore full project state.

**Import Project:**
- File → Import Project.
- File picker for `.openviz` files.
- Load project into application.

---

### 7.3 Export Render as Image

**Export Options:**
- File → Export as PNG
- File → Export as JPG

**Process:**
1. Flatten all visible layers.
2. Open save dialog.
3. Default filename: `OpenViz_${projectName}_${YYYY_MM_DD_HH_MM_SS}.png`
4. User chooses destination folder.
5. Download completes.

**Image Settings (PNG):**
- Format: PNG-24 (full color, 8-bit alpha).
- Compression: Standard (level 6).
- Metadata: Embed project name and timestamp in EXIF.

**Image Settings (JPG):**
- Format: JPEG RGB (no transparency).
- Quality: 95% (high quality).
- Metadata: Embed project name and timestamp in EXIF.

---

## 8. PERFORMANCE SPECIFICATIONS

### 8.1 Target Metrics

| Metric | Target |
|--------|--------|
| **Canvas Render FPS** | 60 FPS during drawing |
| **Brush Latency** | <16ms (60 FPS = 16.67ms per frame) |
| **Layer Flattening Time** | <1s (10 layers) |
| **Generation Response Time** | 5-15 seconds (depends on API) |
| **App Load Time** | <2 seconds (on 4G connection) |
| **Memory Usage** | <500MB (with 50 layers) |
| **File Size (JSON)** | <50MB per project |

---

### 8.2 Optimization Strategies

1. **Canvas Rendering:**
   - Use Konva.js built-in performance optimizations.
   - Batch updates (debounce redraws).
   - Use WebGL rendering if available.

2. **Layer Data:**
   - Compress pixel data with gzip before localStorage.
   - Lazy-load layer thumbnails.
   - Limit history snapshots to 20 entries.

3. **Image Optimization:**
   - Resize large imported images (max 2048x2048).
   - Convert to WebP format for storage.
   - Show progress bar during large file uploads.

4. **API Calls:**
   - Debounce slider changes (500ms before API call).
   - Cache generation results (same prompt/influence = same output, if deterministic).
   - Implement request queuing (max 1 concurrent generation per session).

---

## 9. TESTING REQUIREMENTS

### 9.1 Unit Tests

- **Canvas Rendering:** Test brush stroke geometry, layer composition.
- **Layer Management:** Test add, delete, reorder, visibility toggle.
- **Transform Tool:** Test move, scale, rotate operations.
- **Data Persistence:** Test save/load from localStorage.
- **Image Import:** Test file validation, image placement.

### 9.2 Integration Tests

- **Drawing Flow:** Sketch → Flatten → Generate → New Layer.
- **UI Interactions:** Tool selection, panel toggling, slider adjustment.
- **API Integration:** Mock API requests and responses.

### 9.3 E2E Tests

- **Happy Path:** New project → Draw → Import image → Generate → Export.
- **Error Handling:** Invalid API key, network timeout, file too large.
- **Edge Cases:** Max layers reached, max history entries, unsaved changes.

---

## 10. SECURITY & COMPLIANCE

### 10.1 Data Privacy

- **Local Storage Only:** No server-side storage of project data (MVP).
- **API Keys:** Stored securely on backend (never exposed to client).
- **No Tracking:** No analytics or user tracking in MVP.
- **GDPR Compliance:** No personal data collected.

### 10.2 Input Validation

- **Prompt Input:** Escape HTML entities to prevent XSS.
- **File Upload:** Validate MIME type and file size server-side.
- **Canvas Dimensions:** Constrain to reasonable limits (max 4096x4096).
- **User Input:** Sanitize all text fields.

---

## 11. BROWSER & DEVICE SUPPORT

### 11.1 Target Browsers

- **Desktop:**
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+
- **Mobile:**
  - Safari iOS 14+
  - Chrome Android 90+

### 11.2 Feature Detection

- Graceful degradation if WebGL unavailable (fall back to 2D canvas).
- Detect stylus support; show relevant UI.
- Detect touch support; optimize for touch vs. mouse.

---

## 12. DEPLOYMENT & HOSTING

### 12.1 Hosting

- **Frontend:** Vercel, Netlify, or AWS S3 + CloudFront.
- **Backend API Gateway:** AWS API Gateway or Cloudflare Workers.
- **AI Model API:** Third-party (Stability AI, OpenAI, Hugging Face).

### 12.2 Environment Variables

```env
# Frontend (.env)
REACT_APP_API_BASE_URL=https://api.openviz.example.com
REACT_APP_VERSION=1.0.0

# Backend (.env)
STABILITY_AI_API_KEY=sk-xxxx
OPENAI_API_KEY=sk-xxxx
DATABASE_URL=postgresql://...
```

### 12.3 CI/CD Pipeline

- **Build:** Vite build, ESLint check, TypeScript compilation.
- **Test:** Jest unit tests, E2E tests with Playwright/Cypress.
- **Deploy:** Automated to staging on PR, to production on merge to main.

---

## 13. FUTURE ENHANCEMENTS (POST-MVP)

1. **Collaboration:**
   - Real-time multi-user editing via WebSocket.
   - Workbench mode (node-based workflow).
   - Comment/annotation system.

2. **Advanced Rendering:**
   - Refine mode (iterative refinement).
   - 3D generation (sketch → 3D model).
   - Animation generation.
   - Batch generation (multiple prompts).

3. **Content Library:**
   - Save and organize prompts.
   - Preset templates.
   - Community prompt marketplace.

4. **Smart Features:**
   - AI-assisted prompt writing.
   - Automatic palette detection from uploaded image.
   - Style transfer suggestions.

5. **Integrations:**
   - Adobe Creative Cloud integration (export to Photoshop).
   - Figma plugin.
   - Slack integration.

6. **Monetization:**
   - Freemium model (limited generations per day).
   - Subscription tiers (Pro, Premium).
   - Credit system for API costs.

---

## 14. ACCEPTANCE CRITERIA

### MVP Launch Checklist

- [ ] Canvas viewport with infinite pan/zoom functional.
- [ ] All 9 drawing tools (Brush, Eraser, Shapes, etc.) working.
- [ ] Layer management (add, delete, reorder, visibility, opacity) functional.
- [ ] Image upload feature working (JPG, PNG support).
- [ ] Right panel render controls (prompt, palette, influence, images count) functional.
- [ ] Generate button triggers API call and receives response.
- [ ] New render layers created and displayed on canvas.
- [ ] Local storage save/load working.
- [ ] Export as PNG/JPG functional.
- [ ] Keyboard shortcuts implemented (B, E, R, O, L, Ctrl+Z, Ctrl+S, etc.).
- [ ] Responsive design works on desktop (1280px+).
- [ ] Loading states and error handling implemented.
- [ ] All UI elements styled per design system (colors, typography, spacing).
- [ ] Browser compatibility tested (Chrome, Firefox, Safari, Edge).
- [ ] Performance benchmarks met (60 FPS drawing, <2s page load).
- [ ] Unit tests for core functions (layer management, canvas flattening).
- [ ] Documentation complete (code comments, README, user guide).
- [ ] No console errors or warnings.
- [ ] Accessibility baseline (keyboard navigation, ARIA labels).

---

## 15. DOCUMENTATION ARTIFACTS

### 15.1 Developer Documentation (README.md)

- Project setup (npm install, development server).
- Architecture overview (component tree, data flow).
- API integration guide.
- State management patterns (Redux/Zustand).
- Testing instructions.
- Deployment guide.
- Common issues & troubleshooting.

### 15.2 User Documentation (Help/Onboarding)

- Getting started tutorial (5-10 minute walkthrough).
- Tool descriptions (brush, eraser, shapes).
- Keyboard shortcuts reference card.
- FAQ (common questions).
- Video tutorials (optional, post-MVP).

### 15.3 API Documentation

- Endpoint specifications.
- Request/response schemas.
- Error codes and messages.
- Rate limiting policies.
- Example cURL and JavaScript requests.

---

## 16. SUCCESS METRICS

**MVP Success defined as:**

1. **Functionality:** All 14 core features fully implemented and bug-free.
2. **Performance:** 60 FPS during drawing, <2s load time.
3. **User Experience:** Intuitive workflow; 90% of users can generate a render in <5 minutes.
4. **Code Quality:** >80% test coverage, no critical linting violations.
5. **Browser Support:** Works flawlessly on Chrome, Firefox, Safari, Edge (latest versions).
6. **Accessibility:** WCAG AA compliance for keyboard navigation and screen readers.
7. **Documentation:** Complete technical and user documentation.

---

**Document Version:** 1.0  
**Last Updated:** January 16, 2026  
**Status:** Ready for Development  
**Author:** OpenViz Product Team
