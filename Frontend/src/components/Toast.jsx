import React from 'react';
import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toast } = useApp();
  return (
    <div
      className={`vrms-toast ${toast.show ? 'show' : ''} ${toast.type === 'error' ? 'error' : ''}`}
      role="alert"
    >
      <i className={`fas ${toast.type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'} me-2`}></i>
      {toast.message}
    </div>
  );
}
