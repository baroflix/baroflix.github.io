import { useEffect, useState } from 'react'
import { Monitor, Apple, Loader2 } from 'lucide-react'
import { locales } from './locales'
import { useAuth } from './context/AuthContext'

function LinuxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2a2 2 0 0 0-2 2v2a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2z" />
      <path d="M12 6c-3 0-5 2-5 5v3c0 2 1.5 3 3 4 .5.5 1 1 1 2 0 1.5-1.5 2-3 2h8c-1.5 0-3-.5-3-2 0-1 .5-1.5 1-2 1.5-1 3-2 3-4v-3c0-3-2-5-5-5z" />
      <path d="M8 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
      <path d="M16 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  )
}

// ─── GitHub Release detection ─────────────────────────────────────────────────

const GITHUB_REPO = 'baroflix/baroflix-desktop'

interface ReleaseLinks {
  windows: string | null
  mac: string | null
  linux: string | null
  version: string
  releaseUrl: string
}

function detectAssets(assets: { name: string; browser_download_url: string }[]): Pick<ReleaseLinks, 'windows' | 'mac' | 'linux'> {
  let windows: string | null = null
  let mac: string | null = null
  let linux: string | null = null

  for (const { name, browser_download_url } of assets) {
    const n = name.toLowerCase()
    if (!windows && (n.includes('win') || n.endsWith('.exe'))) {
      windows = browser_download_url
    } else if (!mac && (n.includes('mac') || n.endsWith('.dmg') || n.includes('darwin'))) {
      mac = browser_download_url
    } else if (!linux && (n.includes('linux') || n.endsWith('.appimage') || n.endsWith('.tar.gz') || n.endsWith('.deb') || n.endsWith('.rpm'))) {
      linux = browser_download_url
    }
  }

  return { windows, mac, linux }
}

async function fetchLatestRelease(): Promise<ReleaseLinks> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return {
    ...detectAssets(data.assets ?? []),
    version: data.tag_name ?? '',
    releaseUrl: data.html_url ?? `https://github.com/${GITHUB_REPO}/releases/latest`,
  }
}

// ─── OS detection ─────────────────────────────────────────────────────────────

type OS = 'windows' | 'mac' | 'linux' | 'unknown'

function detectOS(): OS {
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

const OS_LABELS: Record<string, string> = {
  windows: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DownloadPage() {
  const [os, setOs] = useState<OS>('unknown')
  const [release, setRelease] = useState<ReleaseLinks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { settings } = useAuth()
  const t = locales[settings.language ?? 'en'].download

  useEffect(() => {
    setOs(detectOS())
    fetchLatestRelease()
      .then(setRelease)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const primary = (os === 'unknown' ? 'windows' : os) as 'windows' | 'mac' | 'linux'
  const others = (['windows', 'mac', 'linux'] as const).filter(o => o !== primary)

  const href = (platform: 'windows' | 'mac' | 'linux') =>
    release?.[platform] ?? release?.releaseUrl ?? `https://github.com/${GITHUB_REPO}/releases/latest`

  const PrimaryIcon = primary === 'windows' ? Monitor : primary === 'mac' ? Apple : LinuxIcon

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            {t.heading}
          </h1>
          <p className="text-lg text-white/60">
            {t.subtitle}
          </p>
          {/* Version badge */}
          {release?.version && (
            <a
              href={release.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold px-3 py-1 rounded-full transition-colors hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
            >
              {release.version} · {t.releaseNotes}
            </a>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-8 space-y-6">

          {/* Primary — detected OS */}
          {loading ? (
            <div className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
              <span className="text-white/40 font-medium">{t.checking}</span>
            </div>
          ) : (
            <a
              href={href(primary)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-lg font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
              style={{ background: 'var(--accent)', boxShadow: '0 8px 32px var(--accent-dim)' }}
            >
              <PrimaryIcon className="w-6 h-6" />
              {t.downloadFor} {OS_LABELS[primary]}
            </a>
          )}

          {/* Other platforms */}
          <div className="pt-8 border-t border-white/10">
            <p className="text-sm text-white/40 mb-4 font-medium uppercase tracking-wider">{t.otherPlatforms}</p>
            <div className="flex flex-col gap-3">
              {others.map(o => {
                const Icon = o === 'windows' ? Monitor : o === 'mac' ? Apple : LinuxIcon
                return (
                  <a
                    key={o}
                    href={loading ? '#' : href(o)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border transition-colors text-white/80 hover:text-white font-medium"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    onClick={loading ? e => e.preventDefault() : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{t.downloadFor} {OS_LABELS[o]}</span>
                    {!loading && !release?.[o] && (
                      <span className="ml-auto text-xs text-white/30">{t.unavailable}</span>
                    )}
                  </a>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-white/30">
              {t.fetchError}{' '}
              <a
                href={`https://github.com/${GITHUB_REPO}/releases/latest`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white/60"
              >
                {t.openGitHub}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
