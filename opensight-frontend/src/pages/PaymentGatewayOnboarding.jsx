import { useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLocation } from 'react-router-dom'

export default function PaymentGatewayOnboarding() {
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const location = useLocation()

  // Copy to clipboard function
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Fetch markdown file
  useEffect(() => {
    async function fetchMarkdown() {
      try {
        const response = await fetch('/PAYMENT_GATEWAY_ONBOARDING.md')
        if (!response.ok) {
          throw new Error('Documentation file not found')
        }
        const text = await response.text()
        setMarkdown(text)
      } catch (error) {
        console.error('Error loading documentation:', error)
        setMarkdown('# Error\n\nUnable to load documentation. Please contact support.')
      } finally {
        setLoading(false)
      }
    }
    fetchMarkdown()
  }, [])

  // Extract table of contents from markdown
  const tableOfContents = useMemo(() => {
    if (!markdown) return []
    
    const lines = markdown.split('\n')
    const toc = []
    
    lines.forEach((line, index) => {
      // Match heading lines (## Heading or ### Heading)
      const match = line.match(/^(#{2,4})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        
        toc.push({ level, text, id, index })
      }
    })
    
    return toc
  }, [markdown])

  // Handle scroll to update active section
  useEffect(() => {
    const handleScroll = () => {
      const sections = tableOfContents.map(toc => {
        const element = document.getElementById(toc.id)
        return { ...toc, element }
      }).filter(item => item.element)

      const scrollPosition = window.scrollY + 100

      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [tableOfContents])

  // Handle hash changes
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1)
      setTimeout(() => {
        const element = document.getElementById(id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setActiveSection(id)
        }
      }, 100)
    }
  }, [location.hash])

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', `#${id}`)
      setActiveSection(id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documentation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Payment Gateway Onboarding
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Version 1.0
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50">
          <nav className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-6 px-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Table of Contents
            </h2>
            <ul className="space-y-1">
              {tableOfContents.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } ${
                      item.level === 2 ? 'font-medium' : item.level === 3 ? 'pl-6 text-gray-500' : 'pl-10 text-gray-400'
                    }`}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <article className="prose prose-lg prose-blue max-w-none px-6 sm:px-8 lg:px-12 py-12 prose-table:overflow-x-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom heading renderer with IDs
                h1: ({ node, ...props }) => {
                  const id = props.children?.[0]?.toString().toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                  return <h1 id={id} className="text-4xl font-bold text-gray-900 mt-12 mb-4 pb-3 border-b border-gray-200" {...props} />
                },
                h2: ({ node, ...props }) => {
                  const text = props.children?.[0]?.toString() || ''
                  const id = text.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                  return (
                    <h2 
                      id={id} 
                      className="text-3xl font-bold text-gray-900 mt-12 mb-4 pb-2 border-b border-gray-200 scroll-mt-16" 
                      {...props} 
                    />
                  )
                },
                h3: ({ node, ...props }) => {
                  const text = props.children?.[0]?.toString() || ''
                  const id = text.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                  return (
                    <h3 
                      id={id} 
                      className="text-2xl font-semibold text-gray-900 mt-8 mb-3 scroll-mt-16" 
                      {...props} 
                    />
                  )
                },
                h4: ({ node, ...props }) => {
                  const text = props.children?.[0]?.toString() || ''
                  const id = text.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                  return (
                    <h4 
                      id={id} 
                      className="text-xl font-semibold text-gray-900 mt-6 mb-2 scroll-mt-16" 
                      {...props} 
                    />
                  )
                },
                p: ({ node, ...props }) => (
                  <p className="text-gray-700 leading-7 mb-4" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="ml-4 mb-1" {...props} />
                ),
                code: ({ node, inline, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const language = match ? match[1] : ''
                  const codeText = String(children).replace(/\n$/, '')
                  // Create a stable ID based on code content hash
                  const codeId = `code-${codeText.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}-${codeText.length}`
                  
                  if (!inline && (language || codeText.includes('\n'))) {
                    return (
                      <div className="relative mb-4 rounded-lg overflow-hidden border border-gray-200 group">
                        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-mono">{language || 'text'}</span>
                          <button
                            onClick={() => copyToClipboard(codeText, codeId)}
                            className="text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1.5 text-xs"
                            title="Copy code"
                          >
                            {copiedId === codeId ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm font-mono">
                          <code {...props}>
                            {codeText}
                          </code>
                        </pre>
                      </div>
                    )
                  }
                  
                  return (
                    <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ node, ...props }) => (
                  <pre className="mb-4" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-6 -mx-6 sm:mx-0">
                    <table className="min-w-full divide-y divide-gray-300 border border-gray-300 rounded-lg overflow-hidden shadow-sm" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-gray-50 border-b-2 border-gray-300" {...props} />
                ),
                tbody: ({ node, ...props }) => (
                  <tbody className="bg-white divide-y divide-gray-200" {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider border-r border-gray-200 last:border-r-0" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 align-top" {...props} />
                ),
                hr: ({ node, ...props }) => (
                  <hr className="my-8 border-gray-300" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-semibold text-gray-900" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-blue-600 hover:text-blue-800 underline" {...props} />
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </main>
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => {
            const sidebar = document.getElementById('mobile-sidebar')
            const overlay = document.getElementById('mobile-sidebar-overlay')
            sidebar?.classList.toggle('hidden')
            overlay?.classList.toggle('hidden')
          }}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        id="mobile-sidebar-overlay"
        className="lg:hidden hidden fixed inset-0 z-40 bg-black bg-opacity-50"
        onClick={() => {
          const sidebar = document.getElementById('mobile-sidebar')
          sidebar?.classList.add('hidden')
          const overlay = document.getElementById('mobile-sidebar-overlay')
          overlay?.classList.add('hidden')
        }}
      ></div>

      {/* Mobile Sidebar */}
      <aside
        id="mobile-sidebar"
        className="lg:hidden hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-xl"
      >
        <div className="h-full overflow-y-auto py-6 px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Contents
            </h2>
            <button
              onClick={() => {
                const sidebar = document.getElementById('mobile-sidebar')
                const overlay = document.getElementById('mobile-sidebar-overlay')
                sidebar?.classList.add('hidden')
                overlay?.classList.add('hidden')
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="space-y-1">
            {tableOfContents.map((item) => (
              <li key={item.id}>
                <button
              onClick={() => {
                scrollToSection(item.id)
                const sidebar = document.getElementById('mobile-sidebar')
                const overlay = document.getElementById('mobile-sidebar-overlay')
                sidebar?.classList.add('hidden')
                overlay?.classList.add('hidden')
              }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  } ${
                    item.level === 2 ? 'font-medium' : item.level === 3 ? 'pl-6 text-gray-500' : 'pl-10 text-gray-400'
                  }`}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

