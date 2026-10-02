import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { ImageNode } from '../nodes/ImageNode';
import { VideoNode } from '../nodes/VideoNode';
import { AnimateNode } from '../nodes/AnimateNode';
import { RenderNode } from '../nodes/RenderNode';
import { ModifyNode } from '../nodes/ModifyNode';
import { FreehandNode } from '../nodes/FreehandNode';
import { ArrowNode } from '../nodes/ArrowNode';
import { TextNode } from '../nodes/TextNode';
import { NoteNode } from '../nodes/NoteNode';
import { MediaNode } from '../nodes/MediaNode';
import { VariateNode } from '../nodes/VariateNode';
import { NewViewNode } from '../nodes/NewViewNode';
import { ExtractNode } from '../nodes/ExtractNode';
import { SectionNode } from '../nodes/SectionNode';
import { CustomEdge } from '../nodes/CustomEdge';

export const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    videoNode: VideoNode,
    animateNode: AnimateNode,
    renderNode: RenderNode,
    modifyNode: ModifyNode,
    freehandNode: FreehandNode,
    arrowNode: ArrowNode,
    textNode: TextNode,
    noteNode: NoteNode,
    mediaNode: MediaNode,
    variateNode: VariateNode,
    newViewNode: NewViewNode,
    extractNode: ExtractNode,
    sectionNode: SectionNode,
};

export const edgeTypes: EdgeTypes = { customEdge: CustomEdge };
