import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Scan } from 'lucide-react'

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export const BarcodeScanner = ({ isOpen, onClose, onScan }: BarcodeScannerProps) => {
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
      setIsScanning(false)
      return
    }

    const startScanner = async () => {
      try {
        setError(null)
        
        // Check if running on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        if (!isMobile) {
          setError('الماسح الضوئي متاح فقط على الهواتف المحمولة والأجهزة اللوحية')
          return
        }

        // Get available cameras
        const devices = await Html5Qrcode.getCameras()
        
        if (devices.length === 0) {
          setError('لم يتم العثور على كاميرا')
          return
        }

        // Prefer back camera on mobile
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'))
        const cameraId = backCamera?.id || devices[devices.length - 1]?.id

        if (!cameraId) {
          setError('لم يتم العثور على كاميرا مناسبة')
          return
        }

        // Initialize scanner
        if (containerRef.current) {
          scannerRef.current = new Html5Qrcode('barcode-scanner-container')
          
          await scannerRef.current.start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              // Success callback
              onScan(decodedText)
              handleClose()
            },
            () => {
              // Error callback - ignore scan errors (no QR code found)
            }
          )
          
          setIsScanning(true)
        }
      } catch (err) {
        console.error('Scanner error:', err)
        setError('حدث خطأ أثناء تشغيل الماسح الضوئي. تأكد من السماح بالوصول إلى الكاميرا.')
      }
    }

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(startScanner, 100)

    return () => {
      clearTimeout(timeout)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [isOpen])

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setIsScanning(false)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-xl p-4 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scan className="text-purple-600" size={24} />
            <h3 className="text-lg font-bold text-gray-800">مسح الباركود</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <div 
                id="barcode-scanner-container" 
                ref={containerRef}
                className="w-full aspect-square bg-black rounded-lg overflow-hidden"
              />
              
              {/* Scan overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-purple-500 rounded-lg">
                  {/* Corner markers */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-purple-500 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-purple-500 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-purple-500 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-purple-500 rounded-br" />
                </div>
                
                {/* Scan line animation */}
                <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-40 h-0.5 bg-purple-500 shadow-lg animate-pulse" />
              </div>
            </div>

            <p className="text-center text-sm text-gray-600 mt-4">
              {isScanning ? 'وجه الكاميرا نحو الباركود' : 'جاري تشغيل الماسح الضوئي...'}
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default BarcodeScanner
