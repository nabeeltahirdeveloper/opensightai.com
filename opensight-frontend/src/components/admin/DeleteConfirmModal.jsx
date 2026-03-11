import React from 'react';

export default function DeleteConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel}></div>
      <div className="glass-card w-full max-w-md p-6 rounded-xl relative z-10">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fas fa-exclamation-triangle text-red-400 text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-2">{title || 'Confirm Delete'}</h3>
            <p className="text-gray-300 text-sm">
              {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="action-btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-btn btn-danger"
            onClick={onConfirm}
          >
            <i className="fas fa-trash mr-2"></i>Delete
          </button>
        </div>
      </div>
    </div>
  );
}
