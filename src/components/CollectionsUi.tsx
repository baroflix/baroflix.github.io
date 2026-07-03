import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Image as ImageIcon, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCustomLists } from '../hooks'
import type { CustomList } from '../hooks'
import type { MediaItem } from '../types'
import { titleFromItem, mediaTypeFromItem, imageUrl } from '../lib/tmdb'

// ─── Image Upload (Canvas Optimizer) ─────────────────────────────────────────

export function ImageUpload({ onImageOptimized, currentImage }: { onImageOptimized: (dataUrl: string) => void, currentImage?: string | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Target poster aspect ratio 2:3, max width 300px
        const MAX_WIDTH = 300
        const MAX_HEIGHT = 450
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // Draw image and extract as webp (very small footprint)
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/webp', 0.7)
        onImageOptimized(dataUrl)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click() }}
      className="relative flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all"
      style={{
        width: 120,
        height: 180,
        
        background: 'rgba(255,255,255,0.05)',
        border: '1px dashed rgba(255,255,255,0.2)',
      }}
    >
      {currentImage ? (
        <img src={currentImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <ImageIcon className="w-8 h-8 opacity-40 mb-2" />
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
        <span className="text-xs font-semibold text-white">Upload</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}

// ─── Add To Collection Modal ────────────────────────────────────────────────

export function AddToCollectionModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [lists, setLists] = useCustomLists()
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListCover, setNewListCover] = useState<string | null>(null)

  const kind = mediaTypeFromItem(item)

  const handleToggle = (listId: string) => {
    const nextLists = lists.map((list: CustomList) => {
      if (list.id === listId) {
        const exists = list.items.some((i: any) => i.id === item.id && i.mediaType === kind)
        if (exists) {
          return { ...list, items: list.items.filter((i: any) => !(i.id === item.id && i.mediaType === kind)) }
        } else {
          return {
            ...list,
            items: [
              ...list.items,
              {
                mediaType: kind,
                id: item.id,
                title: titleFromItem(item),
                posterPath: item.poster_path,
                backdropPath: item.backdrop_path,
                addedAt: Date.now(),
              }
            ]
          }
        }
      }
      return list
    })
    setLists(nextLists)
  }

  const handleCreate = () => {
    if (!newListName.trim()) return
    const newList: CustomList = {
      id: Math.random().toString(36).substring(2, 9),
      name: newListName.trim(),
      coverImage: newListCover,
      items: [
        {
          mediaType: kind,
          id: item.id,
          title: titleFromItem(item),
          posterPath: item.poster_path,
          backdropPath: item.backdrop_path,
          addedAt: Date.now(),
        }
      ]
    }
    setLists([...lists, newList])
    setIsCreating(false)
    setNewListName('')
    setNewListCover(null)
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden flex flex-col"
        style={{
          background: 'rgba(20,20,20,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          maxHeight: '85vh'
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-semibold text-white">Save to Collection</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isCreating ? (
            <div className="p-4 flex flex-col items-center gap-4">
              <ImageUpload onImageOptimized={setNewListCover} currentImage={newListCover} />
              <input
                autoFocus
                type="text"
                placeholder="List Name"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[var(--accent)]"
              />
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newListName.trim()}
                  className="flex-1 py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {lists.map((list: CustomList) => {
                const inList = list.items.some((i: any) => i.id === item.id && i.mediaType === kind)
                return (
                  <button
                    key={list.id}
                    onClick={() => handleToggle(list.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/10 overflow-hidden shrink-0">
                        {list.coverImage ? (
                          <img src={list.coverImage} className="w-full h-full object-cover" />
                        ) : list.items[0]?.posterPath ? (
                          <img src={imageUrl(list.items[0].posterPath, 'w342')} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5 backdrop-blur-md">
                            <span className="text-xl font-black text-white/30">{list.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{list.name}</div>
                        <div className="text-xs text-white/50">{list.items.length} items</div>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center shrink-0" style={{ background: inList ? 'var(--accent)' : 'transparent', borderColor: inList ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}>
                      {inList && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                )
              })}
              
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-4 p-3 mt-2 rounded-xl border border-dashed border-white/20 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Plus className="w-6 h-6 text-white/50" />
                </div>
                <div className="font-semibold text-white/80">New Collection</div>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )

  return createPortal(modal, document.body)
}

// ─── Star Rating Component ──────────────────────────────────────────────────

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  
  const displayValue = hoverValue !== null ? hoverValue : value

  return (
    <div className="flex items-center" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const isHalfActive = displayValue >= starIndex - 0.5 && displayValue < starIndex
        const isFullActive = displayValue >= starIndex

        const isFilled = isFullActive
        const isHalf = isHalfActive

        return (
          <div key={starIndex} className="relative cursor-pointer w-7 h-7 flex items-center justify-center group" style={{ color: isFilled || isHalf ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>
            {/* Left half hit target */}
            <div 
              className="absolute left-0 top-0 w-1/2 h-full z-10 outline-none focus:bg-white/10" 
              tabIndex={0}
              onMouseEnter={() => setHoverValue(starIndex - 0.5)}
              onClick={() => onChange(starIndex - 0.5)}
              onKeyDown={(e) => { if (e.key === 'Enter') onChange(starIndex - 0.5) }}
            />
            {/* Right half hit target */}
            <div 
              className="absolute right-0 top-0 w-1/2 h-full z-10 outline-none focus:bg-white/10" 
              tabIndex={0}
              onMouseEnter={() => setHoverValue(starIndex)}
              onClick={() => onChange(starIndex)}
              onKeyDown={(e) => { if (e.key === 'Enter') onChange(starIndex) }}
            />
            
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill={isFilled ? "currentColor" : "none"} 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={`w-5 h-5 transition-transform ${isFilled || isHalf ? 'scale-110' : ''}`}
            >
              {isHalf && (
                <defs>
                  <linearGradient id={`half-${starIndex}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="1" />
                  </linearGradient>
                </defs>
              )}
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={isHalf ? `url(#half-${starIndex})` : isFilled ? 'currentColor' : 'none'} />
            </svg>
          </div>
        )
      })}
      <span className="ml-3 font-semibold text-sm tabular-nums" style={{ color: displayValue > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
        {displayValue > 0 ? displayValue.toFixed(1) : 'Rate'}
      </span>
    </div>
  )
}
