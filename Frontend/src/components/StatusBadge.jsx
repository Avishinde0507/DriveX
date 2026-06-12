import React from 'react';
import { getStatusBadgeClass } from '../utils/helpers';

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${getStatusBadgeClass(status)}`} style={{ textTransform: 'capitalize' }}>
      {String(status)}
    </span>
  );
}
