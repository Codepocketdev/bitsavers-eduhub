import { useRef, useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export default function EventVideoFrame({ src, tags }) {
  const videoRef = useRef(null)
  const [muted, setMuted] = useState(true)
  const [showMuteBtn, setShowMuteBtn] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  const handleFrameClick = (e) => {
    e.stopPropagation()
    setShowMuteBtn((prev) => !prev)
  }

  const handleMuteToggle = (e) => {
    e.stopPropagation()
    setMuted((prev) => !prev)
  }

  return (
    <div className="h-56 overflow-hidden relative" onClick={handleFrameClick}>
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />

      <div className="absolute top-4 left-4 flex gap-2">
        {tags.map((tag) => (
          <span key={tag} className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {showMuteBtn && (
        <button
          onClick={handleMuteToggle}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all"
        >
          {muted
            ? <VolumeX className="w-4 h-4 text-white" />
            : <Volume2 className="w-4 h-4 text-white" />
          }
        </button>
      )}
    </div>
  )
}
