import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './RichTextEditor.css';

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  readOnly = false,
  compact = false
}) => {
  // Define toolbar options
  const modules = useMemo(() => ({
    toolbar: compact ? [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ] : [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ]
  }), [compact]);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link'
  ];

  return (
    <div className={`rich-text-editor ${compact ? 'compact' : ''} ${readOnly ? 'read-only' : ''}`}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={readOnly ? { toolbar: false } : modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
};

// Component to safely render rich text HTML content
export const RichTextDisplay = ({ content, className = '' }) => {
  if (!content) return null;

  // Check if content looks like HTML (has tags)
  const isHtml = /<[^>]+>/.test(content);

  if (isHtml) {
    return (
      <div
        className={`rich-text-display ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Plain text - just render as-is
  return <span className={className}>{content}</span>;
};

export default RichTextEditor;
