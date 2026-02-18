import { useState, useRef } from 'react'

// Upload to ImgBB — free, permanent, no expiry
async function uploadImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

  const json = await res.json()
  const url = json?.data?.display_url
  if (!url) throw new Error('No URL returned from ImgBB')
  return url
}

export default function ImageUpload({ currentUrl, onUploaded, size = 86 }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const [error, setError] = useState('')
  const inputRef = useRef()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type & size (max 5MB)
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setError('')
    setUploading(true)

    try {
      const hostedUrl = await uploadImage(file)
      setPreview(hostedUrl)
      onUploaded(hostedUrl)
    } catch (err) {
      setError(err.message || 'Upload failed. Try again.')
      setPreview(currentUrl || '')
    } finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      e.target.value = ''
    }
  }

  const initials = '📷'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Avatar + tap to change */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          position: 'relative',
          width: size, height: size,
          borderRadius: '50%',
          cursor: uploading ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {/* Image or placeholder */}
        {preview ? (
          <img
            src={preview}
            alt="avatar"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #F7931A', display: 'block' }}
            onError={() => setPreview('')}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'linear-gradient(135deg, #F7931A, #b8690f)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, border: '3px solid #F7931A',
          }}>
            {initials}
          </div>
        )}

        {/* Overlay when uploading */}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 22, height: 22, border: '3px solid #F7931A',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {/* Camera badge */}
        {!uploading && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 26, height: 26, borderRadius: '50%',
            background: '#F7931A', border: '2px solid #080808',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            📷
          </div>
        )}
      </div>

      {/* Hidden file input — opens device gallery/files */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {/* Status text */}
      {uploading && (
        <div style={{ fontSize: 12, color: '#F7931A', fontFamily: 'monospace' }}>
          Uploading to nostr.build…
        </div>
      )}
      {!uploading && !error && (
        <div style={{ fontSize: 12, color: '#666' }}>
          Tap photo to change
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', maxWidth: 200 }}>
          ⚠️ {error}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

