import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { serverApi } from '@/api/serverApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ResellerLogin() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const user = await serverApi.auth.resellerLogin({ username, password })
            // Always redirect to reseller dashboard
            navigate('/reseller-dashboard')
        } catch (err) {
            setError(String(err?.message || err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-purple-100">
                <h1 className="text-2xl font-bold mb-2 text-slate-900">Reseller Partner Login</h1>
                <p className="text-slate-500 mb-6">Sign in to access your reseller dashboard</p>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} type="text" required placeholder="yourresellerusername" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="••••••••" />
                    </div>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
                </form>
            </div>
        </div>
    )
}


