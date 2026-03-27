'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// bpmn-js requires these stylesheets for proper rendering
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

interface BpmnViewerProps {
  xml: string;
}

function BpmnViewerInner({ xml }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;

    async function initViewer() {
      if (!containerRef.current) return;

      try {
        const BpmnViewerModule = await import(
          // @ts-expect-error - bpmn-js types
          'bpmn-js/dist/bpmn-viewer.development.js'
        );
        const BpmnViewerClass =
          BpmnViewerModule.default ?? BpmnViewerModule;

        viewer = new BpmnViewerClass({
          container: containerRef.current,
        });

        const result = await viewer.importXML(xml);
        if (result.warnings?.length > 0) {
          console.warn('BPMN import warnings:', result.warnings);
        }
        const canvas = viewer.get('canvas');
        canvas.zoom('fit-viewport');
        // If diagram is too wide, zoom to readable level instead of squashing
        const currentZoom = canvas.zoom();
        if (currentZoom < 0.4) {
          canvas.zoom(0.6);
          canvas.scroll({ dx: 0, dy: 0 }); // reset to top-left
        }
        setLoading(false);
      } catch (err) {
        console.error('BPMN render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render BPMN');
        setLoading(false);
      }
    }

    initViewer();

    return () => {
      if (viewer) {
        try { viewer.destroy(); } catch { /* ignore */ }
      }
    };
  }, [xml]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-red-400">Failed to render BPMN diagram</p>
        <p className="text-xs text-zinc-500 max-w-md text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Loading BPMN diagram…
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

const BpmnViewerDynamic = dynamic(
  () => Promise.resolve(BpmnViewerInner),
  { ssr: false }
);

export function BpmnViewer({ xml }: BpmnViewerProps) {
  return (
    <div className="w-full h-[600px] bg-white border border-zinc-800 rounded-lg overflow-auto">
      <BpmnViewerDynamic xml={xml} />
    </div>
  );
}
