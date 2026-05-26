"use client";

import type { ChangeEvent, ReactNode } from "react";

interface LocalizedTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  dir?: "ltr";
  multiline?: boolean;
  error?: string;
}

function LocalizedTextField({
  value,
  onChange,
  placeholder,
  dir,
  multiline = false,
  error
}: LocalizedTextFieldProps) {
  const commonProps = {
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    placeholder,
    ...(dir ? { dir } : {})
  };

  return (
    <div className="field">
      {multiline ? (
        <textarea className="textarea" {...commonProps} />
      ) : (
        <input className="input" {...commonProps} />
      )}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

interface BilingualEditorFieldProps {
  label: string;
  arValue: string;
  enValue: string;
  onArChange: (value: string) => void;
  onEnChange: (value: string) => void;
  multiline?: boolean;
}

export function BilingualEditorField({
  label,
  arValue,
  enValue,
  onArChange,
  onEnChange,
  multiline = false
}: BilingualEditorFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="editor-fields-2">
        <LocalizedTextField value={arValue} onChange={onArChange} placeholder="العربية" multiline={multiline} />
        <LocalizedTextField value={enValue} onChange={onEnChange} placeholder="English" dir="ltr" multiline={multiline} />
      </div>
    </div>
  );
}

interface BilingualNameFieldsProps {
  arValue: string;
  enValue: string;
  onArChange: (value: string) => void;
  onEnChange: (value: string) => void;
  arError?: string;
  enError?: string;
}

export function BilingualNameFields({
  arValue,
  enValue,
  onArChange,
  onEnChange,
  arError,
  enError
}: BilingualNameFieldsProps) {
  return (
    <>
      <div className="field">
        <label>الاسم بالعربية</label>
        <LocalizedTextField value={arValue} onChange={onArChange} placeholder="" error={arError} />
      </div>
      <div className="field">
        <label>Name (English)</label>
        <LocalizedTextField value={enValue} onChange={onEnChange} placeholder="" dir="ltr" error={enError} />
      </div>
    </>
  );
}

interface ImageFieldCardProps {
  title: string;
  uploadSlot: ReactNode;
  error?: string;
}

export function ImageFieldCard({ title, uploadSlot, error }: ImageFieldCardProps) {
  return (
    <section className="card">
      <div className="card__head"><h3 className="card__title">{title}</h3></div>
      <div className="card__body">
        {uploadSlot}
        {error ? <div className="field-error" style={{ marginTop: 6 }}>{error}</div> : null}
      </div>
    </section>
  );
}

interface EditorActionsProps {
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
}

export function EditorActions({ cancelLabel, saveLabel, onCancel, onSave }: EditorActionsProps) {
  return (
    <div className="editor-actions">
      <button className="btn btn--ghost" onClick={onCancel}>{cancelLabel}</button>
      <button className="btn btn--primary" onClick={onSave}>{saveLabel}</button>
    </div>
  );
}
