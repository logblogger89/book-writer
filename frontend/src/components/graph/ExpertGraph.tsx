import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type EdgeProps,
  type ReactFlowInstance,
  MarkerType,
  BaseEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../../store';
import { PHASE_ORDER, PHASE_DEPENDENCIES, PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { ExpertNode } from './ExpertNode';
import { LoopGroupNode } from './LoopGroupNode';
import { ModelSelectorPopover } from './ModelSelectorPopover';

// ── Geometry constants ──────────────────────────────────────────────────────
// ExpertNode: min-w-[140px] + px-3 padding → rendered width ~150px.
// All single-column nodes sit at x = NODE_COL.
// The loopback arc exits from NODE_RIGHT, curves to LOOP_ARC_X, and returns.
// Both loop groups share GROUP_X and GROUP_WIDTH so their right edges align.
const NODE_COL    = 110;   // x of node left edge
const NODE_WIDTH  = 150;   // approximate rendered node width
const NODE_RIGHT  = NODE_COL + NODE_WIDTH + 5;  // 265 — just past node right edge
const LOOP_ARC_X  = 298;   // arc peak — kept inside group right edge (300)
const GROUP_X     = 60;    // left edge of both loop group boxes
const GROUP_WIDTH = 240;   // width of both loop group boxes (right edge = 300)

// ── Loopback edge ──────────────────────────────────────────────────────────
// A "D"-shaped cubic bezier that exits the right side of the loop group,
// curves around, and re-enters. Uses fixed x-coords so it never overlaps nodes.
function LoopbackEdge({ sourceY, targetY, markerEnd, style }: EdgeProps) {
  const path =
    `M ${NODE_RIGHT} ${sourceY} ` +
    `C ${LOOP_ARC_X} ${sourceY}, ${LOOP_ARC_X} ${targetY}, ${NODE_RIGHT} ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

const nodeTypes = { expert: ExpertNode, loopGroup: LoopGroupNode };
const edgeTypes = { loopback: LoopbackEdge };

// ── Node positions ─────────────────────────────────────────────────────────
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  logline_creator:       { x: NODE_COL, y: 0   },
  world_builder:         { x: NODE_COL, y: 90  },
  scientific_advisor:    { x: 0,        y: 185 },
  persona_creator:       { x: 220,      y: 185 },
  chapter_beats_creator: { x: NODE_COL, y: 280 },
  scene_outliner:        { x: NODE_COL, y: 370 },
  prose_writer:          { x: NODE_COL, y: 470 },
  continuity_editor:     { x: NODE_COL, y: 560 },
  literary_editor:       { x: NODE_COL, y: 650 },
};

// Loop group bounding boxes — both identical width, tightly wrapping their nodes
const SCENE_GROUP   = { x: GROUP_X, y: 350, width: GROUP_WIDTH, height: 82  };
const CHAPTER_GROUP = { x: GROUP_X, y: 450, width: GROUP_WIDTH, height: 275 };

// ── Component ─────────────────────────────────────────────────────────────
export function ExpertGraph() {
  const phases         = useStore(s => s.phases);
  const activePhase    = useStore(s => s.activePhase);
  const darkMode       = useStore(s => s.darkMode);
  const modelConfig    = useStore(s => s.modelConfig);
  const projectId      = useStore(s => s.projectId);
  const chapterProgress = useStore(s => s.chapterProgress);

  const [popoverPhase, setPopoverPhase] = useState<string | null>(null);
  const [popoverPos,   setPopoverPos]   = useState({ x: 0, y: 0 });

  // Responsive fitView: re-fit whenever the container is resized (panel drag)
  const rfRef        = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        rfRef.current?.fitView({ padding: 0.2, duration: 200 });
      }, 50);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  const sceneLoopActive   = activePhase === 'scene_outliner';
  const chapterLoopActive = ['prose_writer', 'continuity_editor', 'literary_editor'].includes(activePhase ?? '');

  const progressLabel = chapterProgress
    ? `Ch ${chapterProgress.currentChapter} / ${chapterProgress.totalChapters}`
    : undefined;

  const nodes: Node[] = useMemo(() => {
    const agentNodes: Node[] = PHASE_ORDER.map(key => ({
      id: key,
      type: 'expert',
      position: NODE_POSITIONS[key] ?? { x: 0, y: 0 },
      data: {
        phase_key: key,
        status: phases[key]?.status ?? 'pending',
        iteration: phases[key]?.iteration ?? 1,
        isActive: activePhase === key,
        label: PHASE_DISPLAY_NAMES[key],
        modelAssignment: modelConfig[key] ?? { provider: 'gemini' as const, model: 'gemini-3.1-flash-lite-preview' },
      },
      draggable: false,
      zIndex: 1,
    }));

    const groupNodes: Node[] = [
      {
        id: '__scene_loop_group',
        type: 'loopGroup',
        position: { x: SCENE_GROUP.x, y: SCENE_GROUP.y },
        style: { width: SCENE_GROUP.width, height: SCENE_GROUP.height },
        data: {
          label: '× chapters',
          progress: sceneLoopActive ? progressLabel : undefined,
          isActive: sceneLoopActive,
        },
        draggable: false, selectable: false, zIndex: 0,
      },
      {
        id: '__chapter_loop_group',
        type: 'loopGroup',
        position: { x: CHAPTER_GROUP.x, y: CHAPTER_GROUP.y },
        style: { width: CHAPTER_GROUP.width, height: CHAPTER_GROUP.height },
        data: {
          label: '× chapters',
          progress: chapterLoopActive ? progressLabel : undefined,
          isActive: chapterLoopActive,
        },
        draggable: false, selectable: false, zIndex: 0,
      },
    ];

    return [...groupNodes, ...agentNodes];
  }, [phases, activePhase, modelConfig, sceneLoopActive, chapterLoopActive, progressLabel]);

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];

    // Regular DAG edges
    for (const [target, deps] of Object.entries(PHASE_DEPENDENCIES)) {
      for (const source of deps) {
        result.push({
          id: `${source}->${target}`,
          source, target,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          animated: phases[source]?.status === 'running',
          zIndex: 2,
        });
      }
    }

    // Scene loop: self-loop on scene_outliner
    result.push({
      id: 'loopback-scene',
      source: 'scene_outliner',
      target: 'scene_outliner',
      type: 'loopback',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 3', opacity: 0.75 },
      animated: sceneLoopActive,
      zIndex: 2,
    } as Edge);

    // Chapter loop: literary_editor → prose_writer
    result.push({
      id: 'loopback-chapter',
      source: 'literary_editor',
      target: 'prose_writer',
      type: 'loopback',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 3', opacity: 0.75 },
      animated: chapterLoopActive,
      zIndex: 2,
    } as Edge);

    return result;
  }, [phases, sceneLoopActive, chapterLoopActive]);

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll={false}
        className={darkMode ? 'dark' : ''}
        onInit={instance => { rfRef.current = instance; }}
        onNodeClick={(event, node) => {
          if (node.id.startsWith('__')) return;
          setPopoverPhase(node.id);
          setPopoverPos({ x: event.clientX, y: event.clientY });
        }}
      >
        <Background color={darkMode ? '#334155' : '#e2e8f0'} gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {popoverPhase && projectId && (
        <ModelSelectorPopover
          projectId={projectId}
          phaseKey={popoverPhase}
          currentAssignment={modelConfig[popoverPhase] ?? null}
          anchorPos={popoverPos}
          onClose={() => setPopoverPhase(null)}
        />
      )}
    </div>
  );
}
