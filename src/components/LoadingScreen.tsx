export default function LoadingScreen({ label = 'Lädt…' }: { label?: string }) {
  return (
    <div className="w-full h-dvh min-h-screen bg-app flex flex-col items-center justify-center gap-5">
      <div className="w-10 h-10 rounded-full border-2 border-accent-pink/30 border-t-unicorn-pink animate-spin" />
      <p className="text-fg/50 text-sm tracking-wide">{label}</p>
    </div>
  )
}
