// Portfolio placeholder — intended metrics layout with an empty state.
// Logic (live positions, realized yield, risk, history) lands in a later pass.
export default function Portfolio() {
  return (
    <div className="flex flex-col gap-12">
      <header>
        <h1 className="display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Portfolio
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          Your positions, realized yield, risk, and the full history of every
          verified action.
        </p>
      </header>

      {/* Metrics layout (empty placeholders) */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
        <Metric label="Total value" />
        <Metric label="Realized yield" />
        <Metric label="Current risk" />
        <Metric label="Active positions" />
      </section>

      {/* Positions + history */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Positions
        </h2>
        <div className="mt-6 rounded-xl border border-dashed border-hairline p-12 text-center">
          <p className="text-base font-medium text-ink">No positions yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Once the agent opens a position within your mandate, it will show up
            here with its live value, yield, and the committee attestations
            behind every move.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          History
        </h2>
        <div className="mt-6 rounded-xl border border-dashed border-hairline p-12 text-center">
          <p className="text-base font-medium text-ink">Nothing to show</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            A timeline of proposed, verified, and executed actions will appear
            here.
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label }: { label: string }) {
  return (
    <div className="bg-paper p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-muted/40">
        —
      </div>
    </div>
  );
}
