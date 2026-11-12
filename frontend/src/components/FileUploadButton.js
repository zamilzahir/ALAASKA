import React, { useRef, useState } from 'react';
import api from '../api/axios';
import '../styles/writing_pad.css';

// "Upload file" button: the student attaches a photo of their work or a PDF.
// Each image / PDF page is stored on the server and inserted into the answer
// as ![name](/figures/<id>), which the chat shows and sends to the tutor as an image.
export default function FileUploadButton({ onInsert, compact = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB');
      return;
    }
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/uploads/attach', form);
      const { filename, items, truncated, total_pages: total } = res.data;
      const label = filename.replace(/[[\]]/g, '');
      const lines = items.map((it) =>
        items.length > 1 ? `![${label}, page ${it.page}](${it.url})` : `![${label}](${it.url})`
      );
      if (truncated) lines.push(`_(Only the first ${items.length} of ${total} pages were attached.)_`);
      onInsert(`\n${lines.join('\n\n')}\n`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ''; // allow choosing the same file again
    }
  };

  return (
    <>
      <button
        type="button"
        className={compact ? 'composer-icon' : 'writing-pad-toggle'}
        aria-label="Attach a file"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Attach a photo of your work or a PDF (max 10 MB, first 5 PDF pages)"
      >
        {busy ? '…' : (compact ? '📎' : '📎 Upload file')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => upload(e.target.files[0])}
      />
      {error && <span className="upload-error">{error}</span>}
    </>
  );
}
