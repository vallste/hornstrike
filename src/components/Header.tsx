import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  back?: boolean | string
  right?: React.ReactNode
}

export default function Header({ title, back, right }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 px-6 pt-16 pb-4">
      {back && (
        <button
          onClick={() => typeof back === 'string' ? navigate(back) : navigate(-1)}
          className="text-white text-2xl font-bold w-8"
        >
          ←
        </button>
      )}
      <h1 className="flex-1 text-[24px] font-bold text-white leading-tight">{title}</h1>
      {right}
    </div>
  )
}
