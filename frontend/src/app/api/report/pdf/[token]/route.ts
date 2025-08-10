import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/sessionStore'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Enhanced PDF report with modern design and professional layout
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const session = sessionStore.get(params.token)
  const url = new URL(req.url)
  const payload = url.searchParams.get('payload')
  if (!session && !payload) return new NextResponse('Not found', { status: 404 })

  // Prepare report data
  let f: any = session?.fields ?? {}
  let latestSummary = session?.cachedSummaryText || 'Summary not available.'
  let latestHighlights: string[] = (session?.cachedHighlights || [])
  const prevSummaries = (session?.summaries || []).slice(1)

  // Allow stateless render from payload (base64url JSON)
  if (payload && (!latestSummary || latestSummary === 'Summary not available.')) {
    try {
      const jsonStr = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
      const parsed = JSON.parse(jsonStr)
      latestSummary = parsed.summary || latestSummary
      latestHighlights = Array.isArray(parsed.highlights) ? parsed.highlights : latestHighlights
      f = parsed.fields || f
    } catch {}
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [595.28, 841.89] // A4
  let page = pdfDoc.addPage(pageSize)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Enhanced color palette
  const brand = { r: 0.12, g: 0.67, b: 0.56 } // CARe brand teal
  const brandLight = { r: 0.85, g: 0.95, b: 0.93 } // Light teal background
  const brandDark = { r: 0.08, g: 0.45, b: 0.38 } // Dark teal
  const accent = { r: 0.96, g: 0.76, b: 0.05 } // Gold accent
  const grey = { r: 0.7, g: 0.7, b: 0.7 }
  const lightGrey = { r: 0.95, g: 0.95, b: 0.95 }
  const mediumGrey = { r: 0.55, g: 0.55, b: 0.55 }
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 1, g: 1, b: 1 }
  const shadow = { r: 0.9, g: 0.9, b: 0.9 }

  const margin = 40
  const headerH = 80
  const footerH = 40
  let x = margin
  let y = page.getHeight() - margin
  const lineGap = 18
  const maxWidth = page.getWidth() - margin * 2

  // Create modern gradient-style header with multiple layers
  const headerBg1 = { r: 0.08, g: 0.45, b: 0.38 } // Dark teal
  const headerBg2 = { r: 0.12, g: 0.67, b: 0.56 } // Brand teal
  
  // Create enhanced header with professional design elements
  // Main header background
  page.drawRectangle({ 
    x: 0, 
    y: page.getHeight() - headerH, 
    width: page.getWidth(), 
    height: headerH, 
    color: rgb(headerBg1.r, headerBg1.g, headerBg1.b) 
  })
  
  // Top accent stripe
  page.drawRectangle({ 
    x: 0, 
    y: page.getHeight() - 8, 
    width: page.getWidth(), 
    height: 8, 
    color: rgb(accent.r, accent.g, accent.b) 
  })
  
  // Logo background circle
  page.drawCircle({
    x: margin + 25,
    y: page.getHeight() - 40,
    size: 20,
    color: rgb(white.r, white.g, white.b),
    opacity: 0.1
  })
  
  // Enhanced brand text with shadow effect - better aligned
  page.drawText('CARe', { 
    x: margin + 2, 
    y: page.getHeight() - 35, 
    size: 32, 
    font: bold, 
    color: rgb(0, 0, 0),
    opacity: 0.1
  })
  
  page.drawText('CARe', { 
    x: margin, 
    y: page.getHeight() - 37, 
    size: 32, 
    font: bold, 
    color: rgb(white.r, white.g, white.b) 
  })
  
  // Subtitle with enhanced styling - better vertical alignment
  page.drawText('PATIENT INTAKE REPORT', { 
    x: margin + 115, 
    y: page.getHeight() - 28, 
    size: 16, 
    font: bold, 
    color: rgb(accent.r, accent.g, accent.b) 
  })
  
  page.drawText('AI-Powered Healthcare Assessment', { 
    x: margin + 115, 
    y: page.getHeight() - 45, 
    size: 11, 
    font, 
    color: rgb(0.9, 0.9, 0.9) 
  })
  
  // Enhanced metadata with better icons and spacing - improved alignment
  const reportDate = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  })
  const sessionId = (session?.token || params.token).slice(0, 12).toUpperCase()
  
  // Date section with icon - better vertical positioning
  page.drawCircle({
    x: margin + 8,
    y: page.getHeight() - 62,
    size: 5,
    color: rgb(accent.r, accent.g, accent.b)
  })
  
  page.drawText('Generated:', { 
    x: margin + 18, 
    y: page.getHeight() - 66, 
    size: 9, 
    font: bold, 
    color: rgb(0.9, 0.9, 0.9) 
  })
  
  page.drawText(reportDate, { 
    x: margin + 75, 
    y: page.getHeight() - 66, 
    size: 9, 
    font, 
    color: rgb(0.8, 0.8, 0.8) 
  })
  
  // Session section with icon - better alignment
  page.drawRectangle({
    x: margin + 300,
    y: page.getHeight() - 67,
    width: 8,
    height: 8,
    color: rgb(accent.r, accent.g, accent.b),
    opacity: 0.7
  })
  
  page.drawText('Session ID:', { 
    x: margin + 315, 
    y: page.getHeight() - 66, 
    size: 9, 
    font: bold, 
    color: rgb(0.9, 0.9, 0.9) 
  })
  
  page.drawText(sessionId, { 
    x: margin + 375, 
    y: page.getHeight() - 66, 
    size: 9, 
    font, 
    color: rgb(0.8, 0.8, 0.8) 
  })

  // Update starting y below header
  y = page.getHeight() - headerH - 30

  const addPage = () => {
    page = pdfDoc.addPage(pageSize)
    
    // Redraw enhanced header on new page
    page.drawRectangle({ 
      x: 0, 
      y: page.getHeight() - headerH, 
      width: page.getWidth(), 
      height: headerH, 
      color: rgb(headerBg1.r, headerBg1.g, headerBg1.b) 
    })
    
    // Accent stripe
    page.drawRectangle({ 
      x: 0, 
      y: page.getHeight() - 8, 
      width: page.getWidth(), 
      height: 8, 
      color: rgb(accent.r, accent.g, accent.b) 
    })
    
    // Header text
    page.drawText('CARe', { 
      x: margin, 
      y: page.getHeight() - 32, 
      size: 24, 
      font: bold, 
      color: rgb(white.r, white.g, white.b) 
    })
    
    page.drawText('PATIENT INTAKE REPORT', { 
      x: margin + 80, 
      y: page.getHeight() - 28, 
      size: 12, 
      font: bold, 
      color: rgb(accent.r, accent.g, accent.b) 
    })
    
    // Reset cursor
    x = margin
    y = page.getHeight() - headerH - 30
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < footerH + margin + 20) addPage()
  }

  const drawCard = (height: number, bgColor = lightGrey, borderColor = brand) => {
    const cardY = y - height
    // Shadow effect
    page.drawRectangle({ 
      x: margin + 2, 
      y: cardY - 2, 
      width: maxWidth, 
      height: height, 
      color: rgb(shadow.r, shadow.g, shadow.b) 
    })
    // Main card
    page.drawRectangle({ 
      x: margin, 
      y: cardY, 
      width: maxWidth, 
      height: height, 
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
      borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
      borderWidth: 1.5
    })
    return cardY
  }

  const drawRule = () => {
    ensureSpace(20)
    // Modern gradient line
    page.drawLine({ 
      start: { x: margin, y }, 
      end: { x: page.getWidth() - margin, y }, 
      thickness: 2, 
      color: rgb(brand.r, brand.g, brand.b),
      opacity: 0.3
    })
    y -= 20
  }

  const drawText = (text: string, opts?: { bold?: boolean; size?: number; color?: { r: number; g: number; b: number }; indent?: number }) => {
    const size = opts?.size ?? 12
    const fnt = opts?.bold ? bold : font
    const color = opts?.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(black.r, black.g, black.b)
    const indent = opts?.indent ?? 0
    const textX = x + indent
    const textMaxWidth = maxWidth - indent
    const lines = wrapText(text, fnt, size, textMaxWidth)
    for (const ln of lines) {
      ensureSpace(lineGap + 2)
      page.drawText(ln, { x: textX, y, size, font: fnt, color })
      y -= lineGap
    }
  }

  const section = (title: string, icon?: string) => {
    y -= 25
    ensureSpace(45)
    
    // Section header with perfect alignment
    const sectionHeaderHeight = 28
    page.drawRectangle({ 
      x: margin, 
      y: y - sectionHeaderHeight, 
      width: maxWidth, 
      height: sectionHeaderHeight, 
      color: rgb(brandLight.r, brandLight.g, brandLight.b),
      borderColor: rgb(brand.r, brand.g, brand.b),
      borderWidth: 1
    })
    
    // Left accent bar with precise width
    page.drawRectangle({ 
      x: margin, 
      y: y - sectionHeaderHeight, 
      width: 4, 
      height: sectionHeaderHeight, 
      color: rgb(brand.r, brand.g, brand.b)
    })
    
    // Icon/symbol with consistent positioning
    if (icon) {
      let safeIcon = icon
      // Enhanced icon replacements with better symbols
      safeIcon = safeIcon.replace(/🤖/g, 'AI')
      safeIcon = safeIcon.replace(/⚡/g, '!')
      safeIcon = safeIcon.replace(/📋/g, 'i')
      safeIcon = safeIcon.replace(/📈/g, '^')
      
      // Icon background circle with precise sizing
      page.drawCircle({
        x: margin + 18,
        y: y - (sectionHeaderHeight / 2),
        size: 7,
        color: rgb(accent.r, accent.g, accent.b),
        opacity: 0.3
      })
      
      page.drawText(safeIcon, { 
        x: margin + 14, 
        y: y - 16, 
        size: 11, 
        font: bold, 
        color: rgb(brandDark.r, brandDark.g, brandDark.b) 
      })
      
      // Title with precise spacing from icon
      page.drawText(title, { 
        x: margin + 32, 
        y: y - 16, 
        size: 13, 
        font: bold, 
        color: rgb(brandDark.r, brandDark.g, brandDark.b) 
      })
    } else {
      page.drawText(title, { 
        x: margin + 10, 
        y: y - 16, 
        size: 13, 
        font: bold, 
        color: rgb(brandDark.r, brandDark.g, brandDark.b) 
      })
    }
    
    y -= sectionHeaderHeight + 12
  }

  // Enhanced Summary section with perfect alignment
  section('AI Assessment Summary', 'AI')
  
  ensureSpace(110)
  const summaryCardHeight = 85
  const summaryCardY = y - summaryCardHeight
  
  // Summary card with precise positioning
  page.drawRectangle({ 
    x: margin, 
    y: summaryCardY, 
    width: maxWidth, 
    height: summaryCardHeight, 
    color: rgb(brandLight.r, brandLight.g, brandLight.b),
    borderColor: rgb(brand.r, brand.g, brand.b),
    borderWidth: 1.5
  })
  
  // Left accent bar for summary
  page.drawRectangle({ 
    x: margin, 
    y: summaryCardY, 
    width: 4, 
    height: summaryCardHeight, 
    color: rgb(brand.r, brand.g, brand.b)
  })
  
  // Summary content with precise padding
  const cardPadding = 12
  let summaryY = summaryCardY + summaryCardHeight - 18
  let summaryX = margin + cardPadding + 4 // Account for accent bar
  
  // Summary title with better positioning
  page.drawText('CLINICAL SUMMARY', { 
    x: summaryX, 
    y: summaryY, 
    size: 10, 
    font: bold, 
    color: rgb(brandDark.r, brandDark.g, brandDark.b) 
  })
  
  summaryY -= 18
  
  // Clean and format summary text with consistent wrapping
  const cleanSummary = latestSummary.replace(/```[\s\S]*?```/g, '').trim()
  const summaryTextWidth = maxWidth - (cardPadding * 2) - 8 // Account for padding and accent bar
  const summaryLines = wrapText(cleanSummary, font, 9, summaryTextWidth)
  
  for (const ln of summaryLines.slice(0, 4)) { // Limit lines for clean appearance
    page.drawText(ln, { 
      x: summaryX, 
      y: summaryY, 
      size: 9, 
      font, 
      color: rgb(0.25, 0.25, 0.25) 
    })
    summaryY -= 12
  }
  
  // Update position after summary card
  y = summaryCardY - 25

  // Enhanced Key Points section with perfect alignment
  if (latestHighlights.length) {
    section('Critical Findings', '!')
    
    ensureSpace(35 + (latestHighlights.length * 28))
    
    for (let i = 0; i < latestHighlights.length; i++) {
      const h = latestHighlights[i]
      ensureSpace(28)
      
      // Create a precisely aligned card for each finding
      const findingHeight = 22
      const findingY = y - findingHeight
      
      page.drawRectangle({ 
        x: margin, 
        y: findingY, 
        width: maxWidth, 
        height: findingHeight, 
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.92, 0.92, 0.92),
        borderWidth: 0.5
      })
      
      // Priority indicator for high-risk items - positioned consistently
      if (h.toLowerCase().includes('high') || h.toLowerCase().includes('emergency') || h.toLowerCase().includes('acute')) {
        page.drawText('!', { 
          x: margin + 8, 
          y: findingY + 7, 
          size: 11, 
          font: bold,
          color: rgb(0.8, 0.2, 0.2) 
        })
      }
      
      // Bullet point with consistent positioning
      page.drawCircle({
        x: margin + 20,
        y: findingY + (findingHeight / 2),
        size: 3,
        color: rgb(accent.r, accent.g, accent.b)
      })
      
      // Highlight text with precise alignment
      const textStartX = margin + 30
      const textWidth = maxWidth - 35
      const highlightLines = wrapText(h, font, 9, textWidth)
      
      // Only show first line to maintain consistent height
      if (highlightLines.length > 0) {
        page.drawText(highlightLines[0], { 
          x: textStartX, 
          y: findingY + 7, 
          size: 9, 
          font: bold,
          color: rgb(0.15, 0.15, 0.15) 
        })
      }
      
      y = findingY - 6
    }
    
    y -= 15
  }

  // Enhanced Intake Details section with precise alignment
  section('Patient Information', 'i')
  
  const fields: Array<[string, string | undefined, string?]> = [
    ['Primary Symptoms', f.symptoms, '>'],
    ['Symptom Onset', f.onset, 't'],
    ['Medical Conditions & Allergies', f.conditionsAllergies, '!'],
    ['Current Medications', f.medications, 'Rx'],
    ['Pain Level (1-10)', f.painScale, '#'],
    ['Recent Exposures', f.exposure, '~'],
    ['Age', f.age, 'P'],
    ['Gender', f.gender, 'o'],
    ['Additional Notes', f.notes, '*'],
  ]
  
  // Perfectly aligned two-column layout
  const fieldRowHeight = 20
  const iconWidth = 22
  const labelWidth = 135
  const valueStartX = margin + iconWidth + labelWidth + 8
  
  for (const [k, v, icon] of fields) {
    if (!v || v.toString().trim() === '') continue // Skip empty fields
    
    ensureSpace(fieldRowHeight + 3)
    
    const fieldY = y - fieldRowHeight
    
    // Alternating row background for better readability
    const filteredFields = fields.filter(([, val]) => val && val.toString().trim())
    const currentIndex = filteredFields.findIndex(([label]) => label === k)
    const isEvenRow = currentIndex % 2 === 0
    
    if (isEvenRow) {
      page.drawRectangle({ 
        x: margin, 
        y: fieldY, 
        width: maxWidth, 
        height: fieldRowHeight, 
        color: rgb(0.985, 0.985, 0.985)
      })
    }
    
    // Icon with precise positioning and background
    if (icon) {
      page.drawCircle({
        x: margin + 11,
        y: fieldY + (fieldRowHeight / 2),
        size: 7,
        color: rgb(brandLight.r, brandLight.g, brandLight.b),
        borderColor: rgb(brand.r, brand.g, brand.b),
        borderWidth: 0.5
      })
      
      page.drawText(icon, { 
        x: margin + 8, 
        y: fieldY + 6, 
        size: 9, 
        font: bold, 
        color: rgb(brandDark.r, brandDark.g, brandDark.b) 
      })
    }
    
    // Field label with consistent alignment
    page.drawText(k, { 
      x: margin + iconWidth, 
      y: fieldY + 6, 
      size: 9, 
      font: bold, 
      color: rgb(brandDark.r, brandDark.g, brandDark.b) 
    })
    
    // Field value with precise positioning
    const valText = v.toString()
    const valueMaxWidth = maxWidth - (iconWidth + labelWidth + 15)
    const vLines = wrapText(valText, font, 9, valueMaxWidth)
    
    if (vLines.length > 0) {
      page.drawText(vLines[0], { 
        x: valueStartX, 
        y: fieldY + 6, 
        size: 9, 
        font, 
        color: rgb(0.25, 0.25, 0.25) 
      })
    }
    
    y = fieldY - 3
  }

  // Enhanced Previous summaries section with better alignment
  if (prevSummaries.length) {
    section(`Assessment History (${prevSummaries.length} previous)`, '^')
    
    for (let i = 0; i < Math.min(prevSummaries.length, 3); i++) { // Limit to 3 most recent
      const s = prevSummaries[i]
      ensureSpace(55)
      
      // History item card with proper dimensions
      const historyCardHeight = 45
      const historyY = y - historyCardHeight
      
      page.drawRectangle({ 
        x: margin, 
        y: historyY, 
        width: maxWidth, 
        height: historyCardHeight, 
        color: rgb(0.97, 0.99, 0.98),
        borderColor: rgb(mediumGrey.r, mediumGrey.g, mediumGrey.b),
        borderWidth: 0.5
      })
      
      // Left accent bar
      page.drawRectangle({ 
        x: margin, 
        y: historyY, 
        width: 3, 
        height: historyCardHeight, 
        color: rgb(brand.r, brand.g, brand.b)
      })
      
      // Date badge with better positioning
      const dateStr = new Date(s.createdAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      // Date icon
      page.drawCircle({
        x: margin + 18,
        y: historyY + 32,
        size: 6,
        color: rgb(accent.r, accent.g, accent.b),
        opacity: 0.3
      })
      
      page.drawText('>', { 
        x: margin + 15, 
        y: historyY + 29, 
        size: 8, 
        font: bold, 
        color: rgb(accent.r, accent.g, accent.b) 
      })
      
      page.drawText(dateStr, { 
        x: margin + 30, 
        y: historyY + 29, 
        size: 9, 
        font: bold, 
        color: rgb(mediumGrey.r, mediumGrey.g, mediumGrey.b) 
      })
      
      // Summary text with proper wrapping and positioning
      const histSummaryLines = wrapText(s.summary, font, 9, maxWidth - 40)
      for (let j = 0; j < Math.min(histSummaryLines.length, 2); j++) {
        page.drawText(histSummaryLines[j], { 
          x: margin + 15, 
          y: historyY + 15 - (j * 11), 
          size: 9, 
          font, 
          color: rgb(0.4, 0.4, 0.4) 
        })
      }
      
      y = historyY - 10
    }
  }

  // Enhanced footer with modern design - improved alignment
  const pages = pdfDoc.getPages()
  pages.forEach((p, idx) => {
    // Footer background with gradient effect
    p.drawRectangle({ 
      x: 0, 
      y: 0, 
      width: p.getWidth(), 
      height: footerH, 
      color: rgb(0.98, 0.98, 0.98) 
    })
    
    // Footer accent line with gradient simulation
    p.drawLine({ 
      start: { x: 0, y: footerH }, 
      end: { x: p.getWidth(), y: footerH }, 
      thickness: 3, 
      color: rgb(brand.r, brand.g, brand.b) 
    })
    
    // Subtle decorative elements - better positioned
    p.drawCircle({
      x: margin + 12,
      y: footerH / 2,
      size: 2,
      color: rgb(accent.r, accent.g, accent.b)
    })
    
    p.drawCircle({
      x: p.getWidth() - margin - 12,
      y: footerH / 2,
      size: 2,
      color: rgb(accent.r, accent.g, accent.b)
    })
    
    // Footer content with better typography and alignment
    const footerText = `Generated by CARe AI Healthcare Platform`
    const pageText = `Page ${idx + 1} of ${pages.length}`
    const confidentialText = 'CONFIDENTIAL MEDICAL DOCUMENT'
    
    p.drawText(footerText, { 
      x: margin + 22, 
      y: footerH / 2 + 4, 
      size: 10, 
      font: bold, 
      color: rgb(brandDark.r, brandDark.g, brandDark.b) 
    })
    
    // Page number in a subtle badge - better centering
    const pageNumWidth = font.widthOfTextAtSize(pageText, 9)
    p.drawRectangle({
      x: p.getWidth() - margin - pageNumWidth - 25,
      y: footerH / 2 - 8,
      width: pageNumWidth + 15,
      height: 16,
      color: rgb(brandLight.r, brandLight.g, brandLight.b),
      borderColor: rgb(brand.r, brand.g, brand.b),
      borderWidth: 0.5
    })
    
    p.drawText(pageText, { 
      x: p.getWidth() - margin - pageNumWidth - 18, 
      y: footerH / 2 - 2, 
      size: 9, 
      font, 
      color: rgb(brandDark.r, brandDark.g, brandDark.b) 
    })
    
    p.drawText(confidentialText, { 
      x: margin + 22, 
      y: footerH / 2 - 8, 
      size: 7, 
      font, 
      color: rgb(0.6, 0.6, 0.6) 
    })
    
    // Subtle document watermark
    const watermarkText = 'CARe'
    p.drawText(watermarkText, {
      x: p.getWidth() - 120,
      y: p.getHeight() - 120,
      size: 48,
      font: bold,
      color: rgb(0.97, 0.97, 0.97),
      opacity: 0.03
    })
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="intake-${(session?.token || params.token)}.pdf"`,
      'Cache-Control': 'no-store',
    }
  })
}

// Enhanced text wrapper with better line breaking
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!text || text.trim() === '') return []
  
  const words = String(text).trim().split(/\s+/)
  const lines: string[] = []
  let current = ''
  
  for (const w of words) {
    const test = current ? current + ' ' + w : w
    const width = font.widthOfTextAtSize(test, size)
    
    if (width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      // Handle very long words by breaking them
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let longWord = w
        while (longWord.length > 0) {
          let chunk = longWord
          while (font.widthOfTextAtSize(chunk, size) > maxWidth && chunk.length > 1) {
            chunk = chunk.slice(0, -1)
          }
          lines.push(chunk)
          longWord = longWord.slice(chunk.length)
        }
        current = ''
      } else {
        current = w
      }
    }
  }
  
  if (current) lines.push(current)
  
  // Preserve explicit newlines in input
  return lines.flatMap((ln) => String(ln).split(/\n/))
}
