import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react'
import { useCustomLists, useRatings } from './hooks'
import type { CustomList } from './hooks'
import { MediaGrid } from './ui'
import { ImageUpload } from './components/CollectionsUi'

export default function CollectionsPage() {
  const [lists, setLists] = useCustomLists()
  const [ratingsRaw] = useRatings()
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'name'>('date')
  
  // Modals state
  const [editingList, setEditingList] = useState<CustomList | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const watchedItems = Object.values(ratingsRaw || {})
    .filter((r: any) => typeof r === 'object' && r.rating)
    .map((r: any) => ({
      mediaType: r.mediaType,
      id: r.id,
      title: r.title,
      posterPath: r.posterPath,
      backdropPath: r.backdropPath,
      addedAt: r.addedAt,
      rating: r.rating
    }))
    .sort((a, b) => b.rating - a.rating)

  const watchedList: CustomList = {
    id: 'watched',
    name: 'Watched & Rated',
    coverImage: null,
    items: watchedItems as any
  }

  const allLists = [watchedList, ...lists]
  const activeList = allLists.find((l: CustomList) => l.id === activeListId)

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (!deleteConfirmId) return
    setLists(lists.filter((l: CustomList) => l.id !== deleteConfirmId))
    if (activeListId === deleteConfirmId) setActiveListId(null)
    setDeleteConfirmId(null)
  }

  const saveEdit = () => {
    if (!editingList) return
    const isNew = !lists.some((l: CustomList) => l.id === editingList.id)
    if (isNew) {
      setLists([...lists, editingList])
    } else {
      setLists(lists.map((l: CustomList) => l.id === editingList.id ? editingList : l))
    }
    setEditingList(null)
  }

  // --- List View ---
  if (activeList) {
    return (
      <div className="pt-20 sm:pt-24 pb-20 max-w-screen-2xl mx-auto px-4 sm:px-6 w-full">
        <button 
          onClick={() => setActiveListId(null)}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Collections
        </button>
        
        <div className="flex items-end gap-6 mb-10">
          <div className="w-32 h-48 rounded-xl bg-white/5 overflow-hidden shrink-0 border border-white/10 shadow-2xl">
             {activeList.coverImage ? (
                <img src={activeList.coverImage} className="w-full h-full object-cover" />
             ) : activeList.items[0]?.posterPath ? (
                <img src={`https://image.tmdb.org/t/p/w342${activeList.items[0].posterPath}`} className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-4 text-center border border-white/10">
                   <span className="text-4xl font-black text-white/20 mb-2">{activeList.name.charAt(0).toUpperCase()}</span>
                   <span className="text-xs font-semibold text-white/40 uppercase tracking-widest break-words w-full line-clamp-2">{activeList.name}</span>
                </div>
             )}
          </div>
          <div className="pb-2 flex-1">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">{activeList.name}</h1>
            <p className="text-white/50">{activeList.items.length} items in this collection</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSortBy('date')} 
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${sortBy === 'date' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              Date Added
            </button>
            <button 
              onClick={() => setSortBy('rating')} 
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${sortBy === 'rating' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              Rating
            </button>
            <button 
              onClick={() => setSortBy('name')} 
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${sortBy === 'name' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              Name
            </button>
          </div>
        </div>

        {/* Map WatchlistEntry to MediaItem format for MediaGrid */}
        <MediaGrid 
          items={[...activeList.items].sort((a: any, b: any) => {
            if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '')
            if (sortBy === 'rating') {
              const ratingA = a.rating || (typeof ratingsRaw[`${a.mediaType}-${a.id}`] === 'object' ? ratingsRaw[`${a.mediaType}-${a.id}`]?.rating : ratingsRaw[`${a.mediaType}-${a.id}`]) || 0
              const ratingB = b.rating || (typeof ratingsRaw[`${b.mediaType}-${b.id}`] === 'object' ? ratingsRaw[`${b.mediaType}-${b.id}`]?.rating : ratingsRaw[`${b.mediaType}-${b.id}`]) || 0
              return ratingB - ratingA
            }
            return (b.addedAt || 0) - (a.addedAt || 0)
          }).map((i: any) => ({
            id: i.id,
            media_type: i.mediaType,
            title: i.title,
            name: i.title,
            poster_path: i.posterPath,
            backdrop_path: i.backdropPath,
          })) as any[]}
          loading={false}
          emptyLabel="Add items to this collection from any movie or show page."
          stagger
        />
      </div>
    )
  }

  // --- Grid View ---
  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-screen-2xl mx-auto px-4 sm:px-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Collections</h1>
          <p className="text-white/50 mt-1">Create custom lists to organize your favorite movies and shows.</p>
        </div>
        <button
          onClick={() => setEditingList({ id: Math.random().toString(36).substr(2, 9), name: 'New Collection', coverImage: null, items: [] })}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" /> Create List
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <AnimatePresence>
          {allLists.map((list: CustomList) => (
            <motion.div
              layout
              key={list.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group relative cursor-pointer"
              tabIndex={0}
              onClick={() => setActiveListId(list.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setActiveListId(list.id)
              }}
            >
              <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10 relative transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-xl group-hover:shadow-[var(--accent-glow)]">
                {list.coverImage ? (
                  <img src={list.coverImage} className="w-full h-full object-cover" />
                ) : list.items[0]?.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w342${list.items[0].posterPath}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-4 text-center">
                     <span className="text-4xl font-black text-white/20 mb-2">{list.name.charAt(0).toUpperCase()}</span>
                     <span className="text-xs font-semibold text-white/40 uppercase tracking-widest break-words w-full line-clamp-2">{list.name}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                  
                  {/* Action buttons (hover) */}
                  {list.id !== 'watched' && (
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingList(list) }}
                        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 hover:text-white text-white/70 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(list.id, e)}
                        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-red-500/80 hover:text-white hover:border-red-500/50 text-white/70 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white text-lg leading-tight truncate drop-shadow-md">{list.name}</h3>
                    <p className="text-xs text-white/60 font-medium drop-shadow-sm mt-0.5">{list.items.length} items</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      {/* Edit/Create Modal */}
      {editingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <h3 className="text-xl font-bold text-white mb-6">
              {lists.some((l: CustomList) => l.id === editingList.id) ? 'Edit Collection' : 'New Collection'}
            </h3>
            
            <ImageUpload 
              currentImage={editingList.coverImage} 
              onImageOptimized={(dataUrl: string) => setEditingList({ ...editingList, coverImage: dataUrl })} 
            />
            
            <div className="w-full mt-6 space-y-4">
              <input
                autoFocus
                type="text"
                placeholder="Collection Name"
                value={editingList.name}
                onChange={e => setEditingList({ ...editingList, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[var(--accent)]"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingList(null)}
                  className="flex-1 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!editingList.name.trim()}
                  className="flex-1 py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-xl font-bold text-white mb-2">Delete Collection</h3>
            <p className="text-white/60 mb-6 text-sm">Are you sure you want to permanently delete this collection? This action cannot be undone.</p>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors shadow-[0_0_24px_rgba(239,68,68,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
