interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CodeEditor({ value, onChange, disabled = false }: CodeEditorProps) {
  const lineCount = Math.max(value.split("\n").length, 14);

  return (
    <div className="code-editor">
      <div className="code-editor__gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <textarea
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="code-editor__input"
        aria-label="Algorithm editor"
      />
    </div>
  );
}
