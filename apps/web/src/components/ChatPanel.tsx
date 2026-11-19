import { useState } from 'react';
import type { AgentResponse } from '@agents-platform/contracts';
import { CitationList } from './CitationList.js';

interface ChatPanelProps {
  ask: (question: string) => Promise<AgentResponse>;
  disabled?: boolean;
  disabledReason?: string;
}

export function ChatPanel({ ask, disabled = false, disabledReason }: ChatPanelProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AgentResponse | null>(null);
  const [error, setError] = useState('');
  const [stack, setStack] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!question.trim() || loading || disabled) return;
    setLoading(true);
    setError('');
    setStack('');
    try {
      setAnswer(await ask(question));
    } catch (caught) {
      setAnswer(null);
      setError('The Q&A service is unavailable.');
      setStack(caught instanceof Error ? (caught.stack ?? '') : '');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="panel">
        <label htmlFor="question">Your question</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What would you like to know?"
        />
        <button disabled={disabled || loading || !question.trim()} onClick={submit}>
          {loading ? 'Thinking…' : 'Ask question'}
        </button>
        {disabled && disabledReason && <p className="hint">{disabledReason}</p>}
        {error && <p className="error">{error}</p>}
        {error && stack && (
          <details>
            <summary>Stack trace</summary>
            <pre>{stack}</pre>
          </details>
        )}
      </section>
      {answer && (
        <section className="answer">
          <span className="eyebrow">ANSWER</span>
          <p>{answer.answer}</p>
          <CitationList citations={answer.citations} />
        </section>
      )}
    </>
  );
}
