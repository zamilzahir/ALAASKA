import React from 'react';
import api from '../api/axios';

// Renders images inside chat/answer Markdown. Drawings from the writing pad are
// stored on the backend as "/figures/<id>", so point those at the API server.
export default function MarkdownImage({ src = '', alt = '', node, ...props }) {
  const url = src.startsWith('/figures/') ? `${api.defaults.baseURL || ''}${src}` : src;
  return (
    <img
      src={url}
      alt={alt}
      style={{ maxWidth: '100%', maxHeight: 320, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6 }}
      {...props}
    />
  );
}
