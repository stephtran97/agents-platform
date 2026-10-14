import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
function App() { const [question, setQuestion] = useState(''); const [answer, setAnswer] = useState(''); async function ask() { const response = await fetch('/v1/conversations/demo/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: question, knowledgeBaseIds: ['default'] }) }); const body = await response.json(); setAnswer(body.answer ?? 'No answer'); } return <main><h1>Knowledge Q&A</h1><p>Upload documents, then ask grounded questions.</p><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question" /><button onClick={ask}>Ask</button>{answer && <article>{answer}</article>}</main>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
