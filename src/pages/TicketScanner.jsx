// Adapted from CashuWallet QRScanner — generic version for ticket verification
import { useRef, useState, useEffect } from 'react'
import QrScanner from 'qr-scanner'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function TicketScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameras, setCameras] = useState([])
  const [facingMode, setFacingMode] = useState('environment')

  useEffect(() => {
    let isActive = true

    const cleanup = () => {
      isActive = false
      if (scannerRef.current) {
        scannerRef.current.stop()
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }

    const initScanner = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) { setError('No camera found on this device.'); return }
        if (!videoRef.current || !isActive) return

        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (!isActive || !result?.data) return
            cleanup()
            onScan(result.data)
          },
          { returnDetailedScanResult: true, highlightScanRegion: false, highlightCodeOutline: false }
        )

        await scannerRef.current.start()
        setScanning(true)

        const cameraList = await QrScanner.listCameras(true)
        setCameras(cameraList)
        if (cameraList.length > 1) await scannerRef.current.setCamera(facingMode)

      } catch (err) {
        if (!isActive) return
        if (err.name === 'NotAllowedError') setError('Camera permission denied.')
        else if (err.name === 'NotFoundError') setError('No camera found.')
        else if (err.name === 'NotReadableError') setError('Camera is busy — close other apps.')
        else setError(`Camera error: ${err.message}`)
      }
    }

    initScanner()
    return cleanup
  }, [facingMode])

  const toggleCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return
    const next = facingMode === 'environment' ? 'user' : 'environment'
    try { await scannerRef.current.setCamera(next); setFacingMode(next) } catch {}
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: 'rgba(247,147,26,0.95)', color: '#000', textAlign: 'center', fontWeight: 800, fontSize: 15 }}>
        Scan Ticket QR Code
      </div>

      {error && (
        <div style={{ margin: 16, padding: 20, background: 'rgba(239,68,68,0.9)', borderRadius: 12, color: '#fff', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, display:'flex', alignItems:'center', gap:6 }}><AlertTriangle size={14} /> {error}</div>
          <div style={{ fontSize: 13 }}>Close other camera apps and reload</div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', maxWidth: 500, borderRadius: 16, display: error ? 'none' : 'block', objectFit: 'cover' }} playsInline muted />

        {scanning && !error && (
          <>
            {/* Scan frame */}
            <div style={{ position: 'absolute', width: 260, height: 260, border: '3px solid #F7931A', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
              {[['top','-3px','left','-3px'],['top','-3px','right','-3px'],['bottom','-3px','left','-3px'],['bottom','-3px','right','-3px']].map(([v,vv,h,hh],i) => (
                <div key={i} style={{ position:'absolute', [v]:vv, [h]:hh, width:40, height:40,
                  [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]:'5px solid #F7931A',
                  [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]:'5px solid #F7931A'
                }} />
              ))}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,#F7931A,transparent)', animation:'scan 2s linear infinite' }} />
            </div>

            {cameras.length > 1 && (
              <button onClick={toggleCamera} style={{ position:'absolute', top:20, right:20, width:48, height:48, borderRadius:'50%', background:'rgba(247,147,26,0.9)', border:'none', cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <RefreshCw size={20} />
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ padding: '20px 24px 36px', background: 'rgba(0,0,0,0.95)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onClose} style={{ width:'100%', padding:'14px', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          CLOSE
        </button>
      </div>

      <style>{`@keyframes scan{0%{transform:translateY(0)}100%{transform:translateY(260px)}}`}</style>
    </div>
  )
}

