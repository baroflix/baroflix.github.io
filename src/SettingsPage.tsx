import { Link } from 'react-router-dom'
import { ArrowLeft, Palette, Monitor, Languages } from 'lucide-react'
import { THEME_PRESETS } from './hooks'
import type { ThemeSettings, ThemeId } from './hooks'

export function SettingsPage({
  settings,
  onChange,
}: {
  settings: ThemeSettings
  onChange: (newSettings: Partial<ThemeSettings>) => void
}) {
  const theme = THEME_PRESETS[settings.theme]

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Themes, subtitles, and preferences</p>
          </div>
        </div>

        {/* Live Preview Banner */}
        <div
          className="mb-8 p-5 flex items-center gap-4"
          style={{
            borderRadius: 16,
            background: `linear-gradient(135deg, ${theme.glow.replace(/0\.(35|30|28)/, '0.12')}, transparent)`,
            border: `1px solid ${theme.glow.replace(/0\.(35|30|28)/, '0.20')}`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: theme.glow.replace(/0\.(35|30|28)/, '0.15'), color: theme.accent }}
          >
            <Monitor className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Active Theme: {theme.label}</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Accent <span style={{ color: theme.accent }}>{theme.accent}</span>
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-full animate-pulse-glow"
            style={{ background: theme.accent, boxShadow: `0 0 16px ${theme.glow}` }}
          />
        </div>

        <div className="space-y-6">
          {/* Theme Presets */}
          <section
            className="p-5"
            style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Palette className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold text-white">Theme Preset</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(THEME_PRESETS).map(([id, preset]) => {
                const isActive = settings.theme === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ theme: id as ThemeId })}
                    className="text-left p-4 transition-all"
                    style={{
                      borderRadius: 14,
                      background: isActive ? preset.glow.replace(/0\.(35|30|28)/, '0.10') : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? preset.glow.replace(/0\.(35|30|28)/, '0.38') : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: isActive ? `0 0 24px ${preset.glow}` : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">{preset.label}</span>
                      {isActive && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: preset.glow.replace(/0\.(35|30|28)/, '0.15'), color: preset.accent }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div className="h-2 rounded-full" style={{ background: preset.accent }} />
                    <div className="h-1 rounded-full mt-1.5 opacity-40" style={{ background: preset.glow }} />
                  </button>
                )
              })}
            </div>
          </section>
          
          {/* Language Selector */}
          <section
            className="p-5"
            style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Languages className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold text-white">Language</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['en', 'pl'] as const).map(lang => {
                const isActive = settings.language === lang
                return (
                  <button
                    key={lang}
                    onClick={() => onChange({ language: lang })}
                    className="p-4 text-left transition-all"
                    style={{
                      borderRadius: 14,
                      background: isActive ? theme.glow.replace('0.35', '0.12').replace('0.30', '0.10').replace('0.28', '0.08') : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? theme.accent + '60' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: isActive ? `0 0 24px ${theme.glow}` : 'none',
                    }}
                  >
                    <div className="font-semibold text-white">{lang === 'en' ? 'English' : 'Polski'}</div>
                  </button>
                )
              })}
            </div>
          </section>


        </div>


      </div>
    </div>
  )
}
