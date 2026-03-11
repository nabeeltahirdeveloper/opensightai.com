import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary.jsx'
import '@/i18n/config.js' // Initialize i18n
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div><p className="mt-4 text-gray-600">Loading...</p></div></div>}>
            <App />
        </Suspense>
    </ErrorBoundary>
)