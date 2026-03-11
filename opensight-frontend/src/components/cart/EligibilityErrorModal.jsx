import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';

export default function EligibilityErrorModal({ isOpen, onClose, message }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold heading-font text-gray-800 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Access Restricted
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="mb-4 p-4 rounded-lg border-2 border-red-500 bg-red-50">
            <p className="text-red-800 font-medium whitespace-pre-wrap">
              {message || 'You are not eligible to proceed with this transaction.'}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              className="px-5 py-3 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

