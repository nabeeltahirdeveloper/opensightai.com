import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProceedChangeModal({ isOpen, onClose, selectedCreditPackage, onProceed, onChange }) {
  const handleClose = () => {
    onClose && onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent hideClose className="w-[95vw] sm:max-w-xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold heading-font text-gray-800">Confirm Your Selection</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <div className="mb-4 p-4 rounded-lg border-2 border-amber-500 bg-amber-50">
            <h4 className="font-extrabold text-gray-900 text-lg">Selected Package</h4>
            <p className="text-amber-800 font-extrabold text-lg">
              {selectedCreditPackage?.name} — {selectedCreditPackage?.unlimited ? 'Unlimited Credits' : `${selectedCreditPackage?.credits} Credits`}
            </p>
          </div>

          <p className="text-gray-600 mb-6">Proceed to secure checkout or go back to change your credit package.</p>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              className="px-5 py-3 whitespace-nowrap flex items-center justify-center gap-2 rounded-lg border-2 border-amber-500 text-amber-800 font-extrabold bg-white hover:bg-amber-50"
              onClick={onChange}
            >
              <i className="fas fa-sync-alt" aria-hidden="true"></i>
              <span>Change Package</span>
            </button>
            <button
              className="btn-premium text-base px-5 py-3 whitespace-nowrap flex items-center justify-center gap-2"
              onClick={onProceed}
            >
              <i className="fas fa-lock" aria-hidden="true"></i>
              <span>Proceed to Checkout</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


