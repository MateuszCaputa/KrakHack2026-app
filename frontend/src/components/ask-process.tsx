'use client';

import { useState, useEffect, useRef } from 'react';
import { askProcess } from '@/lib/api';

interface QAPair {
  question: string;
  answer: string;
}

interface AskProcessProps {
  processId: string;
  initialQuestion?: string;
  onPrefillConsumed?: () => void;
}

export function AskProcess({ processId, initialQuestion, onPrefillConsumed }: AskProcessProps) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(false);
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialQuestion || submittedRef.current === initialQuestion) return;
    submittedRef.current = initialQuestion;
    onPrefillConsumed?.();
    const q = initialQuestion.trim();
    setLoading(true);
    setQuestion('');
    askProcess(processId, q)
      .then(({ answer }) => setHistory(prev => [...prev.slice(-2), { question: q, answer }]))
      .catch(() => setHistory(prev => [...prev.slice(-2), { question: q, answer: 'Failed to get answer. Make sure the backend is running.' }]))
      .finally(() => setLoading(false));
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setQuestion('');
    try {
      const { answer } = await askProcess(processId, q);
      setHistory((prev) => [...prev.slice(-2), { question: q, answer }]);
    } catch {
      setHistory((prev) => [
        ...prev.slice(-2),
        { question: q, answer: 'Failed to get answer. Make sure the backend is running.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this process..."
          className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          aria-label="Ask a question about the process"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
          aria-label="Submit question"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </form>

      {loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex gap-1 text-zinc-500">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
          </div>
        </div>
      )}

      {history
        .slice()
        .reverse()
        .map((qa, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
            <p className="text-xs text-blue-400 font-medium">Q: {qa.question}</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{qa.answer}</p>
          </div>
        ))}
    </div>
  );
}
