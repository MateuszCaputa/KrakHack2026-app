'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
}

function TooltipPopover({ text, anchorRef }: { text: string; anchorRef: React.RefObject<HTMLSpanElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
    >
      <div className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 leading-relaxed w-64 shadow-xl">
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-zinc-700" />
      </div>
    </div>,
    document.body,
  );
}

export function Tooltip({ text }: TooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-800 text-[10px] text-zinc-500 cursor-help border border-zinc-700 leading-none"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => e.stopPropagation()}
    >
      ?
      {show && <TooltipPopover text={text} anchorRef={ref} />}
    </span>
  );
}

interface InlineTooltipProps {
  children: React.ReactNode;
  text: string;
}

export function InlineTooltip({ children, text }: InlineTooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      className="cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <TooltipPopover text={text} anchorRef={ref} />}
    </span>
  );
}
