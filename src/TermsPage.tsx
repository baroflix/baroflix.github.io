import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function TermsPage() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm mb-10 transition-colors no-bg-hover"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Terms &amp; Conditions</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Last updated: June 2025
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-8" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.75', fontSize: '0.9rem' }}>

          <Section title="1. Overview">
            <p>
              Baroflix is a private, invitation-only personal media tracking and discovery platform. Access is
              restricted to a closed group of invited users and is not open to the general public. The platform is
              operated on a strictly non-commercial basis — there is no subscription fee, no advertising revenue,
              and no monetisation of any kind.
            </p>
          </Section>

          <Section title="2. Nature of the Service">
            <p>
              Baroflix functions exclusively as a <strong className="text-white/80">frontend interface and personal media tracker</strong>. It provides
              users with tools to discover titles, track their watch history, maintain watchlists, rate content,
              and engage socially with other invited members.
            </p>
            <p className="mt-3">
              The platform does <strong className="text-white/80">not</strong> host, upload, store, transcode, cache, or distribute
              any audio, video, or media files of any description. No media content of any kind resides on
              Baroflix's servers or infrastructure.
            </p>
          </Section>

          <Section title="3. Third-Party Embeds">
            <p>
              Where playback functionality is available, it is facilitated solely through embedded players
              sourced from independent, third-party websites. These external sources are entirely outside
              the control, ownership, or affiliation of Baroflix. The platform acts only as an
              interface that surfaces links to content already publicly indexed on the wider internet —
              it does not itself transmit, relay, or proxy any media streams.
            </p>
            <p className="mt-3">
              Baroflix assumes no responsibility for the availability, legality, accuracy, or content of
              any material provided by third-party sources. Users access such content entirely at their own
              discretion and risk.
            </p>
          </Section>

          <Section title="4. Copyright &amp; Intellectual Property">
            <p>
              Baroflix respects the intellectual property rights of copyright holders. The platform does not
              encourage, facilitate, or condone the infringement of copyright or any other intellectual
              property rights. All title metadata, artwork, and descriptive information displayed on the
              platform is sourced from publicly available databases (such as The Movie Database — TMDb) under
              their respective usage terms.
            </p>
            <p className="mt-3">
              Baroflix has no affiliation with any film studio, television network, streaming service, or
              rights holder, and makes no claim of ownership over any third-party intellectual property
              displayed for informational or identification purposes.
            </p>
          </Section>

          <Section title="5. DMCA &amp; Takedown Requests">
            <p>
              As Baroflix does not host any media files, there is no infringing content to remove from its
              servers. If you are a rights holder and believe that content accessible through a third-party
              embed linked via this platform infringes your copyright, the appropriate course of action is to
              direct your takedown request to the operator of the relevant third-party source.
            </p>
            <p className="mt-3">
              Notwithstanding the above, if you have a genuine concern relating to this platform specifically,
              you may reach out via the contact details associated with this project for good-faith resolution.
            </p>
          </Section>

          <Section title="6. User Responsibilities">
            <p>
              Users are solely responsible for ensuring that their use of this platform complies with the laws
              and regulations applicable in their jurisdiction. Access to or use of content streamed via
              third-party embeds may be restricted or regulated in certain countries. Baroflix makes no
              representation that use of the platform is lawful in every jurisdiction, and accepts no liability
              for any consequences arising from a user's failure to comply with applicable local law.
            </p>
          </Section>

          <Section title="7. No Warranty">
            <p>
              This platform is provided on an <em>"as is"</em> and <em>"as available"</em> basis, without
              warranty of any kind, express or implied. Baroflix does not guarantee uninterrupted access,
              accuracy of information, or the continued availability of any feature.
            </p>
          </Section>

          <Section title="8. Changes to These Terms">
            <p>
              These terms may be updated from time to time to reflect changes in the platform or applicable
              law. Continued use of the platform following any such update constitutes acceptance of the
              revised terms.
            </p>
          </Section>

        </div>

        {/* Footer note */}
        <div
          className="mt-12 pt-8 text-xs text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' }}
        >
          Baroflix is a private, non-commercial project. &copy; {new Date().getFullYear()} Baroflix.
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {children}
      </div>
    </div>
  )
}
