import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Clock } from 'lucide-react';

export default function TransactionBlockedModal({ isOpen, message }) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[95vw] sm:max-w-xl overflow-x-hidden" hideClose={true}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold heading-font text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Payment Attempt Blocked
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="mb-4 p-4 rounded-lg border-2 border-orange-500 bg-orange-50">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <p className="text-orange-800 font-medium whitespace-pre-wrap">
                {message || 'Your payment attempts are temporarily blocked. Please try again later.'}
              </p>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <p>This security measure helps protect your payment information from potential misuse.</p>
          </div>

          <div className="flex justify-end">
            <button
              className="px-5 py-3 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition-colors"
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


