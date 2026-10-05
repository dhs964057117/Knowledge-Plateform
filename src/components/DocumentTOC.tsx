import React, { useEffect, useState } from 'react'
import { AlignLeft } from 'lucide-react'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface DocumentTOCProps {
  contentHtml?: string
}

export const DocumentTOC: React.FC<DocumentTOCProps> = ({ contentHtml }) => {
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (!contentHtml) {
      setHeadings([])
      return
    }

    // Find all headings inside rendered article
    const docContainer = document.getElementById('feishu-doc-article')
    if (!docContainer) return

    const headingNodes = docContainer.querySelectorAll('h1, h2, h3')
    const items: TOCItem[] = []

    headingNodes.forEach((node, index) => {
      const text = node.textContent?.trim() || ''
      if (!text) return

      let id = node.id
      if (!id) {
        id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')}`
        node.id = id
      }

      const level = parseInt(node.tagName.substring(1), 10)
      items.push({ id, text, level })
    })

    setHeadings(items)

    // Scroll spy
    const handleScroll = () => {
      const scrollPos = window.scrollY + 120
      for (let i = items.length - 1; i >= 0; i--) {
        const el = document.getElementById(items[i].id)
        if (el && el.offsetTop <= scrollPos) {
          setActiveId(items[i].id)
          return
        }
      }
      if (items.length > 0) setActiveId(items[0].id)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [contentHtml])

  if (headings.length === 0) return null

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = el.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="w-64 sticky top-24 self-start hidden xl:block pl-6 text-sm">
      <div className="flex items-center gap-2 font-semibold text-xs text-[#8f959e] uppercase tracking-wider mb-3">
        <AlignLeft className="w-3.5 h-3.5" />
        <span>文档大纲目录</span>
      </div>
      <nav className="space-y-1 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
        {headings.map((item) => {
          const isActive = activeId === item.id
          const paddingLeft = item.level === 1 ? 'pl-2' : item.level === 2 ? 'pl-4' : 'pl-6'

          return (
            <button
              key={item.id}
              onClick={() => scrollToHeading(item.id)}
              className={`block w-full text-left truncate py-1.5 pr-2 rounded text-xs transition-colors ${paddingLeft} ${
                isActive
                  ? 'text-feishu-600 font-semibold bg-feishu-50 border-l-2 border-feishu-600'
                  : 'text-[#646a73] hover:text-[#1f2329] hover:bg-gray-100'
              }`}
            >
              {item.text}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
