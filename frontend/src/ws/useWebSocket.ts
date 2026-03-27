import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { WsEvent } from '../types/events';

const WS_BASE = `ws://${window.location.hostname}:8000`;
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT = 8;

export function useWebSocket(projectId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  useStore(); // subscribe to ensure re-renders

  useEffect(() => {
    if (!projectId) return;

    let stopped = false;

    function connect() {
      if (stopped) return;
      const ws = new WebSocket(`${WS_BASE}/ws/${projectId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as WsEvent;
          handleEvent(msg);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        if (!stopped && reconnectCount.current < MAX_RECONNECT) {
          reconnectCount.current++;
          setTimeout(connect, RECONNECT_DELAY * Math.min(reconnectCount.current, 4));
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [projectId]);

  const send = (event: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  };

  return { send };
}

function handleEvent(msg: WsEvent) {
  const s = useStore.getState();

  switch (msg.event) {
    case 'state_sync': {
      const m = msg as any;
      s.initPhases(m.phases);
      s.setProjectStatus(m.pipeline_status);
      s.setAutoPilot(m.auto_pilot);
      s.setActivePhase(m.active_phase);
      // Restore per-expert model config
      if (m.model_assignments) {
        s.setModelConfig(m.model_assignments);
      }
      // Restore pending choice if any phase is awaiting one
      const hasAwaitingChoice = m.pipeline_status === 'awaiting_choice' ||
        (Array.isArray(m.phases) && m.phases.some((p: any) => p.status === 'awaiting_choice'));
      if (hasAwaitingChoice) {
        fetch(`/api/projects/${m.project_id}/choices/pending`)
          .then(r => r.json())
          .then((choice: any) => {
            if (choice && choice.id) {
              useStore.getState().setPendingChoice({
                choice_id: choice.id,
                phase_key: choice.phase_key,
                options: choice.options_json,
              });
            }
          })
          .catch(() => {});
      }
      // Restore artifact content for any phases that have stored artifacts
      const hasArtifacts = m.phases.some((p: any) => p.artifact_id !== null);
      if (hasArtifacts) {
        fetch(`/api/projects/${m.project_id}/artifacts`)
          .then(r => r.json())
          .then(data => {
            for (const [type, art] of Object.entries(data as Record<string, any>)) {
              useStore.getState().setArtifact(type, (art as any).id, (art as any).version, (art as any).content);
            }
          })
          .catch(err => console.error('Failed to restore artifacts:', err));
      }
      break;
    }
    case 'phase_started':
      s.setPhaseStatus(msg.phase_key!, 'running', (msg as any).iteration);
      s.setActivePhase(msg.phase_key!);
      break;
    case 'phase_completed':
      s.setPhaseStatus(msg.phase_key!, 'complete', (msg as any).iteration);
      if (s.activePhase === msg.phase_key) s.setActivePhase(null);
      break;
    case 'phase_rolled_back':
      s.setPhaseStatus(msg.phase_key!, 'rolled_back');
      break;
    case 'phase_error':
      s.setPhaseStatus(msg.phase_key!, 'error');
      break;
    case 'stream_chunk':
      s.appendStreamChunk(msg.phase_key!, (msg as any).chunk, (msg as any).message_id);
      break;
    case 'stream_end':
      s.finalizeStream(msg.phase_key!, (msg as any).message_id, (msg as any).full_content);
      break;
    case 'artifact_ready':
    case 'artifact_updated': {
      const m = msg as any;
      // Trigger artifact fetch
      fetch(`/api/projects/${m.project_id}/artifacts`)
        .then(r => r.json())
        .then(data => {
          for (const [type, art] of Object.entries(data as Record<string, any>)) {
            useStore.getState().setArtifact(type, art.id, art.version, art.content);
          }
        });
      // Auto-switch artifact tab
      useStore.getState().setActiveArtifactTab(m.artifact_type);
      break;
    }
    case 'choice_ready': {
      const m = msg as any;
      s.setPendingChoice({ choice_id: m.choice_id, phase_key: m.phase_key, options: m.options });
      s.setPhaseStatus(m.phase_key, 'awaiting_choice');
      break;
    }
    case 'choice_consumed':
      s.setPendingChoice(null);
      break;
    case 'pipeline_started':
      s.setProjectStatus('running');
      break;
    case 'pipeline_paused':
      s.setProjectStatus('paused');
      break;
    case 'pipeline_resumed':
      s.setProjectStatus('running');
      break;
    case 'pipeline_complete':
      s.setProjectStatus('complete');
      s.setActivePhase(null);
      break;
    case 'pipeline_error':
      s.setProjectStatus('error');
      break;
    case 'rate_limit_waiting': {
      const m = msg as any;
      s.setRateLimitWaiting({ seconds: m.wait_seconds, phase_key: m.phase_key });
      s.setProjectStatus('rate_limited');
      break;
    }
    case 'rate_limit_resumed':
      s.setRateLimitWaiting(null);
      s.setProjectStatus('running');
      break;
    case 'interrupt_acknowledged': {
      const m = msg as any;
      s.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `✓ Interrupt acknowledged: ${m.agent_summary}`,
        is_interrupt: false,
        phase_key: m.phase_key,
        timestamp: Date.now(),
      });
      break;
    }
    case 'chapter_started': {
      const m = msg as any;
      s.setChapterProgress({ currentChapter: m.chapter_number, totalChapters: m.total_chapters, activePhase: null });
      break;
    }
    case 'chapter_phase_progress': {
      const m = msg as any;
      s.setChapterProgress({ currentChapter: m.chapter_number, totalChapters: m.total_chapters, activePhase: m.phase_key });
      break;
    }
    case 'chapter_completed': {
      const m = msg as any;
      s.setChapterProgress({ currentChapter: m.chapter_number, totalChapters: m.total_chapters, activePhase: null });
      s.setViewingChapter(m.chapter_number);
      break;
    }
  }
}
