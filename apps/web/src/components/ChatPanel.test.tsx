import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from './ChatPanel.js';

const base = { traceId: 't1' };

async function askQuestion(text = 'What is the policy?') {
  await userEvent.type(screen.getByLabelText('Your question'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Ask question' }));
}

describe('ChatPanel', () => {
  it('renders the answer with its citations', async () => {
    const ask = vi.fn().mockResolvedValue({
      ...base,
      answer: 'Refunds within 30 days.',
      citations: [{ documentId: 'd1', chunkId: 'c7', filename: 'policy.md', score: 0.9 }],
    });
    render(<ChatPanel ask={ask} />);
    await askQuestion();
    expect(await screen.findByText('Refunds within 30 days.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sources' })).toBeInTheDocument();
    expect(screen.getByText('policy.md · c7')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith('What is the policy?');
  });

  it('renders a no-answer response without fake citations', async () => {
    const ask = vi.fn().mockResolvedValue({ ...base, answer: 'I could not find relevant information.', citations: [] });
    render(<ChatPanel ask={ask} />);
    await askQuestion();
    expect(await screen.findByText('I could not find relevant information.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows an error and no answer when the service fails', async () => {
    render(<ChatPanel ask={vi.fn().mockRejectedValue(new Error('x'))} />);
    await askQuestion();
    expect(await screen.findByText('The Q&A service is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('ANSWER')).not.toBeInTheDocument();
  });

  it('keeps asking disabled for blank input and while disabled', async () => {
    const { rerender } = render(<ChatPanel ask={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Your question'), '   ');
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled();
    rerender(<ChatPanel ask={vi.fn()} disabled disabledReason="Wait for a document." />);
    await userEvent.type(screen.getByLabelText('Your question'), 'hello');
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled();
    expect(screen.getByText('Wait for a document.')).toBeInTheDocument();
  });
});
