import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';

const EMPTY = '<p></p>';

function normalizeHtml(s) {
  if (!s || !String(s).trim()) return EMPTY;
  return String(s);
}

function Toolbar({ editor }) {
  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('ใส่ URL ลิงก์', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div
      className="admin-pdpa-editor__toolbar"
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="จัดรูปแบบข้อความ"
    >
      <button
        type="button"
        className={editor.isActive('bold') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        ตัวหนา
      </button>
      <button
        type="button"
        className={editor.isActive('italic') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        ตัวเอียง
      </button>
      <button
        type="button"
        className={editor.isActive('underline') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        เส้นใต้
      </button>
      <button
        type="button"
        className={editor.isActive('strike') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        ขีดฆ่า
      </button>
      <span className="admin-pdpa-editor__sep" aria-hidden />
      <button
        type="button"
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        type="button"
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <span className="admin-pdpa-editor__sep" aria-hidden />
      <button
        type="button"
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        จุด
      </button>
      <button
        type="button"
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        ลำดับ
      </button>
      <span className="admin-pdpa-editor__sep" aria-hidden />
      <button type="button" onClick={setLink}>
        ลิงก์
      </button>
      <span className="admin-pdpa-editor__sep" aria-hidden />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        เลิกทำ
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        ทำซ้ำ
      </button>
    </div>
  );
}

/**
 * Rich text สำหรับหน้าแอดมิน PDPA — ใช้ TipTap (รองรับ React 19, ไม่ใช้ findDOMNode)
 */
export default function AdminPdpaRichTextEditor({ initialHtml, onChange, placeholder, disabled }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'พิมพ์เนื้อหานโยบายที่นี่...',
      }),
    ],
    content: normalizeHtml(initialHtml),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  return (
    <div className={`admin-pdpa-editor${disabled ? ' admin-pdpa-editor--disabled' : ''}`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="admin-pdpa-editor__content" />
    </div>
  );
}
