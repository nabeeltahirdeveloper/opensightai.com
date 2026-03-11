import React, { useEffect } from 'react'
import { User } from '@/api/entities'

export default function LandingScripts() {
  useEffect(() => {
    // Helper: dynamic asset price formatting (2-8 decimals based on magnitude)
    const formatAsset = (val) => {
      const num = Number(val)
      if (!Number.isFinite(num)) return '—'
      const abs = Math.abs(num)
      let d = 2
      if (abs >= 1) d = 2
      else if (abs >= 0.1) d = 3
      else if (abs >= 0.01) d = 4
      else if (abs >= 0.001) d = 5
      else if (abs >= 0.0001) d = 6
      else if (abs >= 0.00001) d = 7
      else d = 8
      try { return num.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) } catch (_e) {}
      return num.toFixed(d)
    }

    // Expose functions expected by the static markup to window
    window.toggleMobileMenu = function() {
      const menu = document.getElementById('mobileMenu');
      if (menu) menu.classList.toggle('hidden');
    }

    window.openModal = function(modalId) {
      const el = document.getElementById(modalId)
      if (el) el.classList.add('active')
    }

    window.closeModal = function(modalId) {
      const el = document.getElementById(modalId)
      if (el) el.classList.remove('active')
    }

    function animateCounters() {
      const counters = document.querySelectorAll('.stats-counter');
      counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'))
        const duration = 2000
        const increment = target / (duration / 16)
        let current = 0
        const timer = setInterval(() => {
          current += increment
          if (current >= target) {
            counter.textContent = target.toLocaleString()
            clearInterval(timer)
          } else {
            counter.textContent = Math.floor(current).toLocaleString()
          }
        }, 16)
      })
    }

    window.switchTab = function(tabId) {
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'))
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'))
      const target = document.getElementById(tabId)
      if (target) target.classList.add('active')
      const btnMatch = document.querySelector(`.tab-button[data-tab="${tabId}"]`)
      if (btnMatch) btnMatch.classList.add('active')
    }

    // Demo analysis limit and backend base
    const getBackendBase = () => {
      try {
        const env = (import.meta && import.meta.env) ? import.meta.env : {}
        const v = env?.VITE_API_URL
        if (typeof v === 'string' && v.trim() !== '') return v.trim()
      } catch (_e) {}
      return 'https://api-dev.OpenSightai.com'
    }

    async function compressImageToDataUrl(blob, maxDim = 1024, quality = 0.75) {
      return new Promise((resolve, reject) => {
        try {
          const img = new Image()
          img.onload = () => {
            let { width, height } = img
            if (width > height && width > maxDim) {
              height = Math.round((height / width) * maxDim)
              width = maxDim
            } else if (height > maxDim) {
              width = Math.round((width / height) * maxDim)
              height = maxDim
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
            const out = canvas.toDataURL(type, quality)
            resolve(out)
          }
          img.onerror = reject
          img.src = URL.createObjectURL(blob)
        } catch (e) { reject(e) }
      })
    }

    async function fetchClientIpInfo() {
      try {
        const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
    
        if (json && json.success !== false) {
          // Normalize shape similar to what you expect elsewhere
          window.__ipInfo = {
            countryCode: json.country_code,  // e.g. "SA", "PK"
            country: json.country,
            query: json.ip,
          };
          window.__clientIp = json.ip;
        }
      } catch (_e) {}
    }
    
    async function fetchDemoState() {
      try {
        const base = getBackendBase()
        // prefer POST with ip info if available
        let res
        if (window.__ipInfo) {
          res = await fetch(`${base}/api/demo/visit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ip_info: window.__ipInfo, client_ip: window.__clientIp })
          })
        } else {
          res = await fetch(`${base}/api/demo/visit`, { credentials: 'include' })
        }
        const json = await res.json().catch(() => null)
        if (res.ok && json) {
          window.__demoLimit = Number(json.limit || 3)
          window.__demoTries = Number(json.demo_tries || 0)
          window.__demoRemaining = Math.max(0, window.__demoLimit - window.__demoTries)
          const el = document.getElementById('demoTryCounter')
          if (el) el.textContent = `${window.__demoTries}/${window.__demoLimit}`
        }
      } catch (_e) {}
    }

    async function startDemoAnalysisWithFile(file) {
      try {
        const progressContainer = document.getElementById('analysisProgress')
        const resultsContainer = document.getElementById('analysisResults')
        const progressFill = document.getElementById('progressFill')
        const progressText = document.getElementById('progressText')
        if (progressContainer && resultsContainer) {
          progressContainer.classList.remove('hidden')
          resultsContainer.classList.add('hidden')
        }
        if (progressFill) progressFill.style.width = '0%'
        if (progressText) progressText.textContent = '0%'

        // show a fake progress while the request runs
        let progress = 0
        const interval = setInterval(() => {
          progress = Math.min(95, progress + Math.random() * 12)
          if (progressFill) progressFill.style.width = progress + '%'
          if (progressText) progressText.textContent = Math.floor(progress) + '%'
        }, 300)

        // prepare payload
        let dataUrl
        try {
          dataUrl = await compressImageToDataUrl(file)
        } catch (_e) {
          // fallback raw
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        }

        const base = getBackendBase()
        const res = await fetch(`${base}/api/demo/analyze`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image_data_url: dataUrl, symbol: '', ip_info: window.__ipInfo || null, client_ip: window.__clientIp || null })
        })

        clearInterval(interval)
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          if (res.status === 429) {
            window.__demoRemaining = 0
            window.showNotification('Demo limit reached. Sign up to continue analyzing charts.', 'warning')
          } else {
            window.showNotification('Failed to analyze chart: ' + (text || `HTTP ${res.status}`), 'error')
          }
          if (progressContainer) progressContainer.classList.add('hidden')
          return
        }

        const json = await res.json()
        // update remaining
        if (json?.meta) {
          window.__demoLimit = Number(json.meta.limit || 3)
          window.__demoTries = Number(json.meta.demo_tries || 0)
          window.__demoRemaining = Math.max(0, window.__demoLimit - window.__demoTries)
          const el = document.getElementById('demoTryCounter')
          if (el) el.textContent = `${window.__demoTries}/${window.__demoLimit}`
        }

        if (progressFill) progressFill.style.width = '100%'
        if (progressText) progressText.textContent = '100%'

        setTimeout(() => {
          if (progressContainer) progressContainer.classList.add('hidden')
          if (resultsContainer) resultsContainer.classList.remove('hidden')
          window.showAnalysisResults(json?.analysis)
          window.showNotification('Chart analysis completed successfully!', 'success')
        }, 400)
      } catch (err) {
        window.showNotification('Unexpected error: ' + (err?.message || 'Unknown'), 'error')
      }
    }

    window.handleChartUpload = async function(input) {
      if (input && input.files && input.files[0]) {
        const file = input.files[0]
        if (!(file.type && file.type.startsWith('image/'))) {
          window.showNotification('Please upload a valid image file', 'error')
          return
        }
        if (typeof window.__demoRemaining === 'number' && window.__demoRemaining <= 0) {
          window.showNotification('You have used all 3 free demo analyses. Please purchase a package to get premium account..', 'warning')
          return
        }
        await startDemoAnalysisWithFile(file)
      }
    }

    window.simulateAnalysis = function() {
      const progressContainer = document.getElementById('analysisProgress')
      const resultsContainer = document.getElementById('analysisResults')
      const progressFill = document.getElementById('progressFill')
      const progressText = document.getElementById('progressText')
      if (!progressContainer || !resultsContainer || !progressFill || !progressText) return
      progressContainer.classList.remove('hidden')
      resultsContainer.classList.add('hidden')
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 15
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          setTimeout(() => {
            progressContainer.classList.add('hidden')
            resultsContainer.classList.remove('hidden')
            window.showAnalysisResults()
          }, 500)
        }
        progressFill.style.width = progress + '%'
        progressText.textContent = Math.floor(progress) + '%'
      }, 300)
    }

    window.showAnalysisResults = function(analysis) {
      const results = document.getElementById('analysisResults')
      if (!results) return
      if (!analysis || typeof analysis !== 'object') {
        results.innerHTML = `<div class="p-4 bg-red-50 rounded-lg border-l-4 border-red-400"><p class="text-red-700 text-sm">Failed to load analysis result.</p></div>`
        return
      }
      const trend = analysis.trend_direction || 'unknown'
      const conf = typeof analysis.confidence_level === 'number' ? Math.round(analysis.confidence_level * 100) + '%' : '—'
      const entry = analysis.entry_price != null ? formatAsset(analysis.entry_price) : '—'
      const stop = analysis.stop_loss != null ? formatAsset(analysis.stop_loss) : '—'
      const tp1 = analysis.take_profit_1 != null ? formatAsset(analysis.take_profit_1) : '—'
      const tp2 = analysis.take_profit_2 != null ? formatAsset(analysis.take_profit_2) : '—'
      const rr = analysis.risk_reward_ratio != null ? formatAsset(analysis.risk_reward_ratio) : '—'
      const tf = analysis.time_frame || '—'
      const strat = analysis.trading_strategy || '—'
      const summary = analysis.analysis_summary || '—'
      const levels = Array.isArray(analysis.key_levels) ? analysis.key_levels.slice(0, 4) : []
      results.innerHTML = `
        <div class="space-y-4">
          <div class="p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
            <h5 class="font-semibold text-green-800 mb-1">Analysis Complete</h5>
            <p class="text-green-700 text-sm">Confidence ${conf}</p>
          </div>
          <div class="grid md:grid-cols-2 gap-4 text-sm">
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Trend</div><div class="${trend === 'bullish' ? 'text-green-600' : trend === 'bearish' ? 'text-red-600' : 'text-gray-700'}">${trend}</div></div>
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Risk/Reward</div><div class="text-gray-700">${rr}</div></div>
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Entry</div><div class="text-blue-700">${entry}</div></div>
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Stop</div><div class="text-red-700">${stop}</div></div>
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Target 1</div><div class="text-emerald-700">${tp1}</div></div>
            <div class="p-3 bg-gray-50 rounded-lg"><div class="font-semibold text-gray-800">Target 2</div><div class="text-emerald-700">${tp2}</div></div>
          </div>
          ${levels.length ? `<div class="p-4 bg-amber-50 rounded-lg"><h6 class="font-semibold text-amber-800 mb-2">Key Levels</h6><ul class="text-amber-900 text-sm space-y-1">${levels.map(l => `<li>• ${l.type || 'level'}: ${l.price != null ? formatAsset(l.price) : '—'} ${l.strength ? `(${l.strength})` : ''}</li>`).join('')}</ul></div>` : ''}
          <div class="p-4 bg-blue-50 rounded-lg">
            <h6 class="font-semibold text-blue-800 mb-2">Strategy (${tf})</h6>
            <p class="text-blue-900 text-sm mb-2">${strat}</p>
            <p class="text-blue-900 text-sm">${summary}</p>
          </div>
        </div>`
    }

    async function fetchTutorState() {
      try {
        const base = getBackendBase()
        const res = await fetch(`${base}/api/tutor/visit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ip_info: window.__ipInfo || null, client_ip: window.__clientIp || null })
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json) {
          window.__tutorLimit = Number(json.limit || 20)
          window.__tutorUsed = Number(json.tutor_messages_used || 0)
          window.__tutorRemaining = Math.max(0, window.__tutorLimit - window.__tutorUsed)
          const el = document.getElementById('tutorCreditsCounter')
          if (el) el.textContent = `${window.__tutorUsed}/${window.__tutorLimit}`
        }
      } catch (_e) {}
    }

    window.sendTutorMessage = async function() {
      const input = document.getElementById('tutorInput')
      if (!input) return
      const message = input.value.trim()
      if (!message) return
      if (typeof window.__tutorRemaining === 'number' && window.__tutorRemaining <= 0) {
        window.showNotification('You have reached your 20 free tutor messages. Please purchase a package to get premium account.', 'warning')
        return
      }

      // push user message
        window.addTutorMessage(message, 'user')
        input.value = ''

      // collect last few messages for context
      const chatContainer = document.querySelector('#ai-tutor .space-y-3')
      let previous = []
      if (chatContainer) {
        previous = Array.from(chatContainer.querySelectorAll('.chat-message')).slice(-6).map(div => {
          const isUser = div.classList.contains('user')
          const text = div.textContent || ''
          return { role: isUser ? 'user' : 'ai', content: text }
        })
      }

      // show typing placeholder
      const typing = document.createElement('div')
      typing.className = 'chat-message ai'
      typing.innerHTML = '<p>…</p>'
      if (chatContainer) {
        chatContainer.appendChild(typing)
        chatContainer.scrollTop = chatContainer.scrollHeight
      }

      try {
        const base = getBackendBase()
        const res = await fetch(`${base}/api/tutor/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message, previous_messages: previous, ip_info: window.__ipInfo || null, client_ip: window.__clientIp || null })
        })
        const text = await res.text()
        if (!res.ok) {
          // remove typing
          if (typing && typing.remove) typing.remove()
          if (res.status === 429) {
            window.__tutorRemaining = 0
            window.showNotification('Tutor message limit reached. Please purchase a package to get premium account.', 'warning')
          } else {
            window.showNotification('Failed to send message: ' + (text || `HTTP ${res.status}`), 'error')
          }
          return
        }
        const json = JSON.parse(text)
        // update credits
        if (json?.meta) {
          window.__tutorLimit = Number(json.meta.limit || 20)
          const used = Number(json.meta.tutor_messages_used || 0)
          window.__tutorRemaining = Math.max(0, window.__tutorLimit - used)
          const el = document.getElementById('tutorCreditsCounter')
          if (el) el.textContent = `${used}/${window.__tutorLimit}`
        }
        // replace typing with actual reply
        if (typing && typing.parentNode) typing.parentNode.removeChild(typing)
        window.addTutorMessage(json?.reply || '...', 'ai')
      } catch (err) {
        if (typing && typing.remove) typing.remove()
        window.showNotification('Unexpected error: ' + (err?.message || 'Unknown'), 'error')
      }
    }

    window.addTutorMessage = function(message, sender) {
      const chatContainer = document.querySelector('#ai-tutor .space-y-3')
      if (!chatContainer) return
      const messageDiv = document.createElement('div')
      messageDiv.className = `chat-message ${sender}`
      // Basic markdown-ish formatting: bold for headings, line breaks preserved
      const safe = String(message || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const formatted = safe
        .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
        .replace(/^##\s+(.+)$/gm, '<strong>$1</strong>')
        .replace(/^#\s+(.+)$/gm, '<strong>$1</strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>')
      messageDiv.innerHTML = `<p>${formatted}</p>`
      chatContainer.appendChild(messageDiv)
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
    async function loadTutorHistory() {
      try {
        const base = getBackendBase()
        let res
        if (window.__ipInfo || window.__clientIp) {
          res = await fetch(`${base}/api/tutor/history`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ip_info: window.__ipInfo || null, client_ip: window.__clientIp || null })
          })
        } else {
          res = await fetch(`${base}/api/tutor/history`, { credentials: 'include' })
        }
        const json = await res.json().catch(() => null)
        if (res.ok && json && Array.isArray(json.history)) {
          const chatContainer = document.querySelector('#ai-tutor .space-y-3')
          if (!chatContainer) return
          chatContainer.innerHTML = ''
          json.history.forEach((m) => {
            const role = m.role === 'user' ? 'user' : 'ai'
            window.addTutorMessage(String(m.content || ''), role)
          })
        }
      } catch (_e) {}
    }

    window.toggleFaq = function(index) {
      const content = document.getElementById(`faq-content-${index}`)
      const icon = document.getElementById(`faq-icon-${index}`)
      if (!content || !icon) return
      content.classList.toggle('hidden')
      icon.classList.toggle('rotate-180')
    }

    window.selectPlan = function(planName) {
      const plans = {
        essential: { name: 'Essential', code: 'starter', price: '€250', features: ['10 chart analyses', 'Basic AI teacher', 'Education center'] },
        professional: { name: 'Professional', code: 'pro', price: '€500', features: ['50 chart analyses', 'Advanced AI teacher', 'Full education center'] },
        expert: { name: 'Expert', code: 'expert', price: '€750', features: ['Unlimited analyses', 'Premium AI teacher', 'Premium education center'] }
      }
      const plan = plans[planName]
      const selectedPlanDiv = document.getElementById('selectedPlan')
      if (!plan || !selectedPlanDiv) return
      window.__selectedPlan = { key: planName, ...plan }
      selectedPlanDiv.innerHTML = `
        <div class="text-center">
          <h4 class="text-xl font-bold text-gray-800 mb-2">${plan.name} Plan</h4>
          <div class="text-3xl font-bold text-gold mb-4">${plan.price}<span class="text-lg text-gray-600"> One-time</span></div>
          <ul class="text-gray-700 space-y-1">${plan.features.map(f => `<li>• ${f}</li>`).join('')}</ul>
        </div>`
      window.openModal('paymentModal')
    }

    window.handleLogin = async function(event) {
      try {
        if (event && typeof event.preventDefault === 'function') event.preventDefault()
        const form = event?.target?.closest('form') || document.querySelector('#loginModal form')
        const emailInput = form?.querySelector('input[type="email"]')
        const passwordInput = form?.querySelector('input[type="password"]')
        const email = String(emailInput?.value || '').trim()
        const password = String(passwordInput?.value || '')
        if (!email || !password) {
          window.showNotification('Please enter email and password', 'error')
          return
        }
        window.showNotification('Signing in...', 'info')
        await User.login({ email, password })
        window.showNotification('Login successful! Redirecting to dashboard...', 'success')
        setTimeout(() => { window.location.href = '/dashboard' }, 500)
      } catch (err) {
        const message = err?.message || 'Login failed'
        window.showNotification(String(message), 'error')
      }
    }

    window.handleSignup = function(event) {
      window.showNotification('Account created successfully! Please check your email.', 'success')
      setTimeout(() => { window.closeModal('signupModal') }, 2000)
    }

    window.processPayment = async function(event) {
      try {
        const form = event?.target
        if (!form) return
        const firstName = form.querySelector('input[placeholder="First Name"]').value.trim()
        const lastName = form.querySelector('input[placeholder="Last Name"]').value.trim()
        const email = form.querySelector('input[placeholder="Email Address"]').value.trim()
        const plan = window.__selectedPlan?.code || null
        if (!email) {
          window.showNotification('Email is required', 'error')
          return
        }
        window.showNotification('Processing payment...', 'info')
        // Simulate payment success, then create user in DB
        const base = (import.meta?.env?.VITE_API_URL || 'https://api-dev.OpenSightai.com')
        const res = await fetch(`${base}/api/users`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, full_name: `${firstName} ${lastName}`.trim(), plan })
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text)
        }
        const json = await res.json()
        window.showNotification('Payment successful! User created. Credentials will be emailed.', 'success')
        window.closeModal('paymentModal')
        // Optionally store user info locally for continuity
        try { localStorage.setItem('last_purchase_user', JSON.stringify(json?.user)) } catch(_e) {}
      } catch (err) {
        window.showNotification('Failed to complete purchase: ' + (err?.message || 'Unknown error'), 'error')
      }
    }

    window.submitContactForm = function(event) {
      window.showNotification('Thank you! Your message has been sent successfully.', 'success')
      if (event && event.target && event.target.reset) event.target.reset()
    }

    window.toggleChat = function() {
      const chatWidget = document.getElementById('chatWidget')
      if (chatWidget) chatWidget.classList.toggle('hidden')
    }

    window.sendChatMessage = function() {
      const input = document.getElementById('chatInput')
      const message = input?.value?.trim()
      if (message) {
        const chatContainer = document.querySelector('#chatWidget .overflow-y-auto')
        if (!chatContainer) return
        const userMessage = document.createElement('div')
        userMessage.className = 'chat-message user mb-2'
        userMessage.innerHTML = `<p class="text-sm">${message}</p>`
        chatContainer.appendChild(userMessage)
        input.value = ''
        chatContainer.scrollTop = chatContainer.scrollHeight
        setTimeout(() => {
          const supportMessage = document.createElement('div')
          supportMessage.className = 'chat-message ai mb-2'
          supportMessage.innerHTML = '<p class="text-sm">Thank you for your message! A support agent will assist you shortly.</p>'
          chatContainer.appendChild(supportMessage)
          chatContainer.scrollTop = chatContainer.scrollHeight
        }, 1000)
      }
    }

    window.showNotification = function(message, type = 'info') {
      const notification = document.getElementById('notification')
      const icon = document.getElementById('notificationIcon')
      const text = document.getElementById('notificationText')
      if (!notification || !icon || !text) return
      const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', info: 'fas fa-info-circle', warning: 'fas fa-exclamation-triangle' }
      icon.className = icons[type] || icons.info
      text.textContent = message
      notification.classList.add('show')
      setTimeout(() => notification.classList.remove('show'), 5000)
    }

    function initPortfolioChart() {
      const canvas = document.getElementById('portfolioChart')
      if (!canvas || !window.Chart) return
      const ctx = canvas.getContext('2d')
      new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Portfolio Value',
            data: [100000, 108500, 112300, 105600, 118900, 125430],
            borderColor: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: false, ticks: { callback: (value) => '$' + Number(value).toLocaleString() } } }
        }
      })
    }

    // On mount: animate counters when they appear
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounters()
          observer.unobserve(entry.target)
        }
      })
    })
    const statsSection = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-4')
    if (statsSection) observer.observe(statsSection)

    // init chart after slight delay
    const chartTimer = setTimeout(initPortfolioChart, 1000)

    // first get client IP info, then report visits/credits for both demo and tutor
    fetchClientIpInfo().finally(() => { fetchDemoState(); fetchTutorState(); loadTutorHistory() })

    // smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault()
        const target = document.querySelector(this.getAttribute('href'))
        if (target) target.scrollIntoView({ behavior: 'smooth' })
      })
    })

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active') })
    })

    // Handle Enter key in chat inputs
    const tutorInput = document.getElementById('tutorInput')
    if (tutorInput) tutorInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') window.sendTutorMessage() })
    const chatInput = document.getElementById('chatInput')
    if (chatInput) chatInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') window.sendChatMessage() })

    // expose helpers for CTA
    window.startFreeTrial = function() {
      window.switchTab('chart-analysis')
      const chartAnalysis = document.getElementById('chart-analysis')
      if (chartAnalysis) {
        chartAnalysis.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
      const features = document.getElementById('features')
        if (features) features.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.openChartAnalyzer = function() {
      window.switchTab('chart-analysis')
      const chartAnalysis = document.getElementById('chart-analysis')
      if (chartAnalysis) {
        chartAnalysis.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
      const features = document.getElementById('features')
        if (features) features.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.startLearning = function() { window.switchTab('ai-tutor') }

    window.viewAllTestimonials = function() {
      if (document.getElementById('reviewsPage')) return
      // Updated reviews dataset (5 pages, 4 per page)
      window.__allReviews = [
        { name: 'Jonathan Reed', title: 'Senior Portfolio Manager', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face', text: "OpenSightAI has completely transformed our investment analysis process. The AI's ability to identify market patterns with exceptional accuracy has given us a significant competitive edge. Our portfolio performance has improved substantially since implementation." },
        { name: 'Dr. Sarah Chen', title: 'Chief Investment Officer', img: 'https://res.cloudinary.com/dpalshngt/image/upload/v1755788355/photo_2025-08-21_18.44.40_bzghp8.jpg', text: "As someone who's been in finance for 20 years, I've never seen anything like OpenSightAI. The educational component is exceptional - it's like having a PhD-level market analyst available 24/7. The platform delivers exceptional value." },
        { name: 'Marcus Thompson', title: 'Hedge Fund Director', img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face', text: "The institutional-grade analysis capabilities are remarkable. We've integrated OpenSightAI into our daily operations, and it consistently identifies opportunities our team might have missed. The return on investment has been extraordinary." },
        { name: 'Alexandra Mitchell', title: 'Senior Technical Analyst', img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=60&h=60&fit=crop&crop=face', text: "The pattern recognition technology is absolutely mind-blowing. OpenSightAI identifies complex formations like head-and-shoulders, triangles, and flag patterns with incredible precision. It's like having years of experience compressed into instant analysis." },
        { name: 'Robert Kim', title: 'Quantitative Researcher', img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=60&h=60&fit=crop&crop=face', text: "I've tested dozens of analysis tools, but nothing comes close to OpenSightAI's accuracy. The AI processes over 50 technical indicators simultaneously and presents clear, actionable insights. It's revolutionized how we approach market research." },
        { name: 'Linda Foster', title: 'Market Strategist', img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face', text: "The real-time analysis capabilities are game-changing. Whether I upload a chart from TradingView, MetaTrader, or any other platform, OpenSightAI delivers consistent, professional-grade analysis in seconds. The time savings alone justify the investment." },
        { name: 'James Wilson', title: 'Junior Investment Analyst', img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=60&h=60&fit=crop&crop=face', text: "The AI Agent Teacher is incredible! I went from novice to confident analyst in just 3 months. The personalized learning approach adapted to my pace, and now I can identify market opportunities that senior analysts miss. It's like having a personal mentor available 24/7." },
        { name: 'David Park', title: 'Trading Coach', img: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=60&h=60&fit=crop&crop=face', text: "I use OpenSightAI to train new analysts, and the results are phenomenal. Students learn complex market concepts 5x faster than traditional methods. The AI explains everything in simple terms while maintaining technical accuracy. It's the future of financial education." },
        { name: 'Catherine Moore', title: 'Risk Management Director', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face', text: "The market assessment tools are exceptional for evaluation. OpenSightAI helps us identify potential market conditions before they impact our positions. Our analysis accuracy has improved significantly since implementation." },
        { name: 'Andrew Liu', title: 'Portfolio Optimization Specialist', img: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=60&h=60&fit=crop&crop=face', text: "The portfolio tracking and optimization features are world-class. OpenSightAI analyzes correlations, volatility, and market conditions to suggest optimal allocations. Our Sharpe ratio improved significantly after following the AI's recommendations." },
        { name: 'Rachel Stevens', title: 'Compliance Officer', img: 'https://images.unsplash.com/photo-1546512565-39d4dc75e556?w=60&h=60&fit=crop&crop=face', text: "What impressed me most is the platform's compliance-friendly approach. All analysis focuses on education and market assessment rather than predictions. It's perfect for institutional use and meets all regulatory requirements. The documentation is comprehensive." },
        { name: 'Hans Mueller', title: 'European Fund Manager', img: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=60&h=60&fit=crop&crop=face', text: "OpenSightAI works flawlessly across all European markets. From DAX to FTSE, the AI provides consistent, accurate analysis regardless of the instrument or timeframe. Our fund's performance has improved significantly." },
        { name: 'Yuki Tanaka', title: 'Asia-Pacific Strategist', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face', text: "The platform's ability to analyze Asian markets is impressive. Whether it's Nikkei, Hang Seng, or emerging markets, OpenSightAI delivers accurate insights. The one-time payment model is perfect for our budget." },
        { name: 'Thomas Anderson', title: 'Investment Committee Chairman', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face', text: "After 6 months with OpenSightAI, our investment committee's decision-making has improved dramatically. The AI provides objective, data-driven analysis that removes emotional bias from our process. Every member now relies on the platform." },
        { name: 'Anna Brown', title: 'Senior Analyst', img: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=60&h=60&fit=crop&crop=face', text: "The speed and accuracy of OpenSightAI is remarkable. I can get high-quality insights on any chart within seconds. The educational value alone makes this platform worth every penny." },
        { name: 'Chris Lee', title: 'Market Research Analyst', img: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=60&h=60&fit=crop&crop=face', text: "OpenSightAI has become an essential part of my daily workflow. The analysis is reliable, accurate, and presented in a clear, professional format. I use it every single day without fail." },
        { name: 'Sofia Turner', title: 'Portfolio Analyst', img: 'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?w=60&h=60&fit=crop&crop=face', text: "The education center has been invaluable for our junior team. OpenSightAI's learning modules helped our new analysts develop advanced skills quickly. The knowledge transfer capabilities are exceptional." },
        { name: 'Mark Evans', title: 'Quantitative Researcher', img: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=60&h=60&fit=crop&crop=face', text: "The pattern recognition technology is absolutely incredible. OpenSightAI identifies complex market formations with precision that rivals the best analysts. It saves us countless hours of manual analysis." },
        { name: 'Daniel Green', title: 'Senior Market Analyst', img: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=60&h=60&fit=crop&crop=face', text: "OpenSightAI has become a must-have tool for technical analysis. The depth of insight and educational value make it indispensable for serious market professionals. Highly recommended." },
        { name: 'Olivia Harris', title: 'Investment Research Director', img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=60&h=60&fit=crop&crop=face', text: "The consistency and quality of OpenSightAI's analysis is outstanding. The user experience is seamless, and the results are always professionally presented. It's transformed our research capabilities." }
      ]
      window.__reviewsPerPage = 4
      window.__currentReviewsPage = 1
      const container = document.createElement('div')
      container.id = 'reviewsPage'
      container.className = 'fixed inset-0 bg-white z-50 overflow-y-auto'
      container.innerHTML = `
        <div class="max-w-6xl mx-auto px-6 py-12">
          <div class="flex justify-between items-center mb-8">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 gradient-gold rounded-lg flex items-center justify-center"><i class="fas fa-chart-line text-white text-xl"></i></div>
              <h1 class="text-3xl md:text-4xl font-bold heading-font text-gray-800">Customer Reviews</h1>
            </div>
            <button onclick="closeReviewsPage()" class="text-gray-400 hover:text-gray-600 text-3xl"><i class="fas fa-times"></i></button>
          </div>
          <div id="reviewsContent" class="grid lg:grid-cols-2 gap-8"></div>
          <div class="flex items-center justify-center gap-2 mt-10" id="reviewsPagination"></div>
        </div>`
      document.body.appendChild(container)
      window.renderReviewsPage()
    }

    window.renderReviewsPage = function() {
      const content = document.getElementById('reviewsContent')
      const pagination = document.getElementById('reviewsPagination')
      if (!content || !pagination) return
      const total = window.__allReviews.length
      const per = window.__reviewsPerPage || 4
      const totalPages = Math.max(1, Math.ceil(total / per))
      let page = window.__currentReviewsPage || 1
      if (page < 1) page = 1
      if (page > totalPages) page = totalPages
      window.__currentReviewsPage = page
      const start = (page - 1) * per
      const end = Math.min(start + per, total)
      const slice = window.__allReviews.slice(start, end)
      content.innerHTML = slice.map(r => `
        <div class="testimonial-card">
          <div class="flex items-center mb-4">
            <img src="${r.img}" alt="${r.name}" class="w-12 h-12 rounded-full mr-4">
            <div><h4 class="font-semibold text-gray-800">${r.name}</h4><p class="text-gray-600 text-sm">${r.title}</p></div>
          </div>
          <div class="flex text-gold mb-4"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
          <p class="text-gray-700 italic">"${r.text}"</p>
        </div>
      `).join('')
      // pagination controls (numbered buttons only)
      pagination.innerHTML = Array.from({ length: totalPages }, (_, idx) => idx + 1)
        .map(i => `<button class="page-button ${i === page ? 'active' : ''}" onclick="changeReviewsPage(${i})">${i}</button>`)
        .join('')
    }

    window.changeReviewsPage = function(action) {
      const total = window.__allReviews.length
      const per = window.__reviewsPerPage || 4
      const totalPages = Math.max(1, Math.ceil(total / per))
      let page = window.__currentReviewsPage || 1
      if (action === 'prev') page = Math.max(1, page - 1)
      else if (action === 'next') page = Math.min(totalPages, page + 1)
      else if (typeof action === 'number') page = Math.min(totalPages, Math.max(1, action))
      window.__currentReviewsPage = page
      window.renderReviewsPage()
    }

    window.closeReviewsPage = function() {
      const el = document.getElementById('reviewsPage')
      if (el) el.remove()
    } 
  }, [])
  return null
}


