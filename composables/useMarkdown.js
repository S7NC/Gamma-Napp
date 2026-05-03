import { marked } from 'marked'
import DOMPurify from 'dompurify'

export const useMarkdown = () => {

  /**
   * Configure marked options for better rendering
   */
  const configureMarked = () => {
    marked.setOptions({
      headerIds: false,
      mangle: false,
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    })
  }

  /**
   * Convert markdown text to sanitized HTML.
   * @param {string} markdown - The markdown text to convert
   * @returns {string} Sanitized HTML string
   */
  const markdownToHtml = (markdown) => {
    if (!markdown || typeof markdown !== 'string') {
      return ''
    }

    try {
      configureMarked()
      return DOMPurify.sanitize(marked(markdown))
    } catch (error) {
      console.error('Error converting markdown to HTML:', error)
      return ''
    }
  }

  /**
   * Extract the first image from markdown content
   * @param {string} markdown - The markdown content
   * @returns {string|null} First image URL found or null
   */
  const extractFirstImage = (markdown) => {
    if (!markdown) return null
    
    // Look for markdown image syntax ![alt](url)
    const imageRegex = /!\[.*?\]\((.*?)\)/
    const match = markdown.match(imageRegex)
    
    if (match && match[1]) {
      return match[1]
    }
    
    // Look for HTML img tags
    const htmlImageRegex = /<img[^>]+src="([^">]+)"/
    const htmlMatch = markdown.match(htmlImageRegex)
    
    if (htmlMatch && htmlMatch[1]) {
      return htmlMatch[1]
    }
    
    return null
  }

  /**
   * Strip markdown syntax to get plain text
   * @param {string} markdown - The markdown text
   * @returns {string} Plain text without markdown syntax
   */
  const stripMarkdown = (markdown) => {
    if (!markdown) return ''
    
    return markdown
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to just text
      .replace(/[*_`~]/g, '') // Remove formatting characters
      .replace(/#+\s/g, '') // Remove headers
      .replace(/>\s/g, '') // Remove blockquotes
      .replace(/^\s*[-*+]\s/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s/gm, '') // Remove numbered list markers
      .trim()
  }

  return {
    markdownToHtml,
    extractFirstImage,
    stripMarkdown
  }
}
