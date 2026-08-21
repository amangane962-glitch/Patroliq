import jsQR from 'jsqr'

/**
 * Normalizes raw payload from QR codes, NFC tags, URLs, JSON, or BarcodeDetector output
 * into clean tag codes (e.g. "QR-N483", "NFC-F239", "QR-P102", "QR-X901").
 */
export const extractTagCode = (input) => {
  if (!input) return ''
  let str = String(input).trim()

  // 1. Check if input is a URL or query string containing scan= or tag= or code=
  try {
    if (str.includes('scan=') || str.includes('tag=') || str.includes('code=')) {
      const urlString = (str.startsWith('http://') || str.startsWith('https://')) 
        ? str 
        : 'http://dummy.com' + (str.startsWith('/') || str.startsWith('?') ? str : '/' + str)
      
      const urlObj = new URL(urlString)
      const code = urlObj.searchParams.get('scan') || 
                 urlObj.searchParams.get('tag') || 
                 urlObj.searchParams.get('code')
      if (code) return code.trim()
    }
  } catch (e) {}

  // 2. Check JSON payload
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str)
      if (parsed.tag_code) return String(parsed.tag_code).trim()
      if (parsed.scan) return String(parsed.scan).trim()
      if (parsed.code) return String(parsed.code).trim()
      if (parsed.tag) return String(parsed.tag).trim()
    } catch (e) {}
  }

  // 3. Remove "PATROLIQ:" prefix if present
  if (str.toUpperCase().startsWith('PATROLIQ:')) {
    return str.substring(9).trim()
  }

  // 4. Return clean string
  return str
}

/**
 * Multi-Stage QR Decoder for Image Files & Video Frame Elements.
 * Tries Native BarcodeDetector -> Multi-Scale jsQR -> Center-Crop jsQR -> Contrast Inversion
 */
export const decodeQRFromImage = async (imageSource) => {
  if (!imageSource) return null

  // STAGE 1: Native BarcodeDetector API (Chrome / Android / iOS standard)
  if ('BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const barcodes = await detector.detect(imageSource)
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        const extracted = extractTagCode(barcodes[0].rawValue)
        if (extracted) return extracted
      }
    } catch (err) {}
  }

  // Helper to run jsQR on canvas context
  const runJsQR = (ctx, w, h) => {
    try {
      const imageData = ctx.getImageData(0, 0, w, h)
      const result = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' })
      if (result && result.data) {
        return extractTagCode(result.data)
      }
    } catch (e) {}
    return null
  }

  // Prepare processing canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  const srcWidth = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width || 800
  const srcHeight = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height || 600

  // STAGE 2: Multi-Scale Full Image Scans
  const targetScales = [1200, 800, 640, 480]
  for (const scale of targetScales) {
    let w = srcWidth
    let h = srcHeight
    if (w > h) {
      if (w > scale) { h = Math.round((h * scale) / w); w = scale; }
    } else {
      if (h > scale) { w = Math.round((w * scale) / h); h = scale; }
    }
    
    canvas.width = w
    canvas.height = h
    ctx.drawImage(imageSource, 0, 0, w, h)

    const code = runJsQR(ctx, w, h)
    if (code) return code
  }

  // STAGE 3: Center Crop 70% & 50% High Resolution Scans
  const cropRatios = [0.7, 0.5]
  for (const ratio of cropRatios) {
    const cropSize = Math.min(srcWidth, srcHeight) * ratio
    const cropX = (srcWidth - cropSize) / 2
    const cropY = (srcHeight - cropSize) / 2

    canvas.width = 640
    canvas.height = 640
    ctx.drawImage(imageSource, cropX, cropY, cropSize, cropSize, 0, 0, 640, 640)

    const code = runJsQR(ctx, 640, 640)
    if (code) return code
  }

  return null
}
