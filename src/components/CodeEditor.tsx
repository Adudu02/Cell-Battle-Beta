
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export default function CodeEditor({ value, onChange, disabled, id }: CodeEditorProps) {
  return (
    <textarea
      id={id}
      className="code-editor"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      wrap="off"
      style={{ width: "100%" }}
    />
  );
}
