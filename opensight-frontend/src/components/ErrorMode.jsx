import React from 'react'

export default function ErrorMode() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-12 border border-white/20">
        <div className="text-center">
          {/* Icon */}
          <div className="mb-6">
            <svg 
              className="w-20 h-20 mx-auto text-yellow-400 animate-pulse" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Error Mode
          </h1>

          {/* Main Message */}
          <div className="space-y-4 text-gray-200 text-lg leading-relaxed">
            <p className="text-xl text-white font-semibold">
              We are currently experiencing technical issues. Please try again later.
            </p>
            
            <p>
              If the problem persists, please contact our support team.
            </p>
            
            <p className="text-yellow-300 font-medium">
              Support is available 24/7.
            </p>
            
            <p>
              Thank you for your patience and understanding.
            </p>
            
            <p className="pt-4 border-t border-white/20">
              Thank you for your patience.
            </p>
          </div>

          {/* Decorative elements */}
          <div className="mt-8 flex justify-center space-x-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}



