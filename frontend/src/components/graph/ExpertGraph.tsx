import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../../store';
import { PHASE_ORDER, PHASE_DEPENDENCIES, PHASE_DISPLAY_NAMES } from '../../types/pipeline';
import { ExpertNode } from './ExpertNode';
import { LoopGroupNode } from './LoopGroupNode';
import { ModelSelectorPopover } from './ModelSelectorPopover';

// Custom edge: curves out to the right side to show the per-chapter loop
function LoopbackEdge({ sourceX, sourceY, targetX, targetY, label, markerEnd, style }: EdgeProps) {
  // Both nodes are vertically stacked at the same X. We manually draw a cubic
  // bezier that exits right, loops around, and re-enters from the right.
  const offset = 55; // how far right the curve bulges
  const sx = sourceX + 10; // start from right side of source
  const sy = sourceY;
  const tx = targetX + 10; // end at right side of target
  const ty = targetY;
  const cx = Math.max(sx, tx) + offset;

  const path = `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`;
  const labelX = cx + 4;
  const labelY = (sy + ty) / 2;

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
          }}
          className="text-[9px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1 rounded"
        >
          {label as string}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { expert: ExpertNode, loopGroup: LoopGroupNode };
const edgeTypes = { loopback: LoopbackEdge };

// Fixed layout positions for the DAG
// Group nodes use zIndex -1 and are sized to enclose the relevant agent nodes.
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  logline_creator:       { x: 110, y: 0 },
  world_builder:         { x: 110, y: 90 },
  scientific_advisor:    { x: 0,   y: 185 },
  persona_creator:       { x: 220, y: 185 },
  chapter_beats_creator: { x: 110, y: 280 },
  scene_outliner:        { x: 110, y: 370 },
  prose_writer:          { x: 110, y: 470 },
  continuity_editor:     { x: 110, y: 560 },
  literary_editor:       { x: 110, y: 650 },
};

// Group bounding boxes — positioned behind the nodes they enclose
// Chapter loop is wider to accommodate the loopback curve on the right side
const SCENE_LOOP_GROUP = { x: 60, y: 350, width: 250, height: 80 };
const CHAPTER_LOOP_GROUP = { x: 60, y: 450, width: 310, height: 270 };

export function ExpertGraph() {
  const phases = useStore(s => s.phases);
  const activePhase = useStore(s => s.activePhase);
  const darkMode = useStore(s => s.darkMode);
  const modelConfig = useStore(s => s.modelConfig);
  const projectId = useStore(s => s.projectId);
  const chapterProgress = useStore(s => s.chapterProgress);

  const [popoverPhase, setPopoverPhase] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const sceneLoopActive = activePhase === 'scene_outliner';
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
        position: { x: SCENE_LOOP_GROUP.x, y: SCENE_LOOP_GROUP.y },
        style: { width: SCENE_LOOP_GROUP.width, height: SCENE_LOOP_GROUP.height },
        data: {
          label: '× chapters',
          progress: sceneLoopActive ? progressLabel : undefined,
          isActive: sceneLoopActive,
        },
        draggable: false,
        selectable: false,
        zIndex: 0,
      },
      {
        id: '__chapter_loop_group',
        type: 'loopGroup',
        position: { x: CHAPTER_LOOP_GROUP.x, y: CHAPTER_LOOP_GROUP.y },
        style: { width: CHAPTER_LOOP_GROUP.width, height: CHAPTER_LOOP_GROUP.height },
        data: {
          label: '× chapters',
          progress: chapterLoopActive ? progressLabel : undefined,
          isActive: chapterLoopActive,
        },
        draggable: false,
        selectable: false,
        zIndex: 0,
      },
    ];

    return [...groupNodes, ...agentNodes];
  }, [phases, activePhase, modelConfig, sceneLoopActive, chapterLoopActive, progressLabel]);

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];

    for (const [target, deps] of Object.entries(PHASE_DEPENDENCIES)) {
      for (const source of deps) {
        result.push({
          id: `${source}->${target}`,
          source,
          target,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          animated: phases[source]?.status === 'running',
          zIndex: 2,
        });
      }
    }

    // Loopback edge: literary_editor → prose_writer (curved right side, shows per-chapter loop)
    result.push({
      id: 'loopback-chapter',
      source: 'literary_editor',
      target: 'prose_writer',
      type: 'loopback',
      label: 'next chapter',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 3', opacity: 0.7 },
      animated: chapterLoopActive,
      zIndex: 2,
    } as Edge);

    return result;
  }, [phases, chapterLoopActive]);

  return (
    <div className="h-full w-full relative">
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
        onNodeClick={(event, node) => {
          if (node.id.startsWith('__')) return; // ignore group nodes
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
